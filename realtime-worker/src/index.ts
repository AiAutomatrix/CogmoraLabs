
import * as admin from 'firebase-admin';
import WebSocket from 'ws';
import http from 'http';
import fetch from 'node-fetch'; // Use node-fetch for CommonJS compatibility

// Type definitions moved here to make the worker self-contained.
interface OpenPositionDetails {
  stopLoss?: number;
  takeProfit?: number;
  triggeredBy?: string;
  status?: 'open' | 'closing';
  closePrice?: number;
}

interface OpenPosition {
  id: string;
  positionType: 'spot' | 'futures';
  symbol: string;
  symbolName: string;
  size: number;
  averageEntryPrice: number;
  currentPrice: number;
  side: 'buy' | 'long' | 'short';
  leverage?: number | null;
  unrealizedPnl?: number;
  priceChgPct?: number;
  liquidationPrice?: number;
  details?: OpenPositionDetails;
}

interface PaperTrade {
  id?: string;
  positionId: string;
  positionType: 'spot' | 'futures';
  symbol: string;
  symbolName: string;
  size: number;
  entryPrice: number;
  closePrice?: number | null;
  side: 'buy' | 'sell' | 'long' | 'short';
  leverage: number | null;
  openTimestamp: number;
  closeTimestamp?: any;
  status: 'open' | 'closed';
  pnl?: number | null;
}

interface TradeTriggerDetails {
    status: 'active' | 'executed' | 'canceled';
}

interface TradeTrigger {
  id: string;
  symbol: string;
  symbolName: string;
  type: 'spot' | 'futures';
  condition: 'above' | 'below';
  targetPrice: number;
  action: 'buy' | 'long' | 'short';
  amount: number;
  leverage: number;
  cancelOthers?: boolean;
  stopLoss?: number;
  takeProfit?: number;
  details: TradeTriggerDetails;
}


// Initialize Firebase Admin SDK for Cloud Run environment
// This uses the service account associated with the Cloud Run instance
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();


const KUCOIN_SPOT_TOKEN_ENDPOINT = "https://api.kucoin.com/api/v1/bullet-public";
const KUCOIN_FUTURES_TOKEN_ENDPOINT = "https://api-futures.kucoin.com/api/v1/bullet-public";

// --- WebSocket Connection Manager ---
class WebSocketManager {
    private ws: WebSocket | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private reconnectAttempts = 0;
    private currentSubscriptions = new Set<string>();

    constructor(
        private name: string,
        private tokenEndpoint: string,
        private getTopic: (symbol: string) => string,
    ) {}

    public connect = async () => {
        console.log(`[${this.name}] Attempting to connect...`);
        try {
            const response = await fetch(this.tokenEndpoint, { method: 'POST' });
            const tokenData = await response.json() as any;
            if (tokenData.code !== '200000') throw new Error(tokenData.msg);

            const { token, instanceServers } = tokenData.data;
            const wsUrl = `${instanceServers[0].endpoint}?token=${token}`;

            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                console.log(`[${this.name}] WebSocket connection established.`);
                this.reconnectAttempts = 0;
                this.setupPing(instanceServers[0].pingInterval);
                this.resubscribe();
            });

            this.ws.on('message', (data: string) => {
                this.handleMessage(data);
            });

            this.ws.on('close', this.handleClose);
            this.ws.on('error', this.handleError);

        } catch (error) {
            console.error(`[${this.name}] Failed to get token:`, error);
            this.scheduleReconnect();
        }
    }

    private handleMessage = (data: string) => {
        const message = JSON.parse(data);
        if (message.type === 'message' && message.topic) {
            let symbol: string | undefined;
            const priceData = message.data;
            
            let price: number | undefined;

            if (this.name === 'SPOT') {
                symbol = message.topic.replace('/market/snapshot:', '');
                price = parseFloat(priceData?.data?.lastTradedPrice);

            } else { // FUTURES
                symbol = message.topic.replace('/contractMarket/snapshot:', '');
                price = message.data.markPrice;
            }

            if (price && symbol) {
                processPriceUpdate(symbol, price).catch(e => console.error(`[WORKER] Error in processPriceUpdate for ${symbol}:`, e));
            }
        }
    }

    private setupPing = (interval: number) => {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ id: Date.now(), type: 'ping' }));
            }
        }, interval / 2);
    }

    private handleClose = () => {
        console.log(`[${this.name}] WebSocket closed.`);
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.scheduleReconnect();
    }

    private handleError = (error: Error) => {
        console.error(`[${this.name}] WebSocket error:`, error.message);
        // handleClose will be called automatically after an error.
    }

    private scheduleReconnect = () => {
        if (this.reconnectTimeout) return;
        this.reconnectAttempts++;
        const delay = Math.min(1000 * (2 ** this.reconnectAttempts), 30000); // Exponential backoff
        console.log(`[${this.name}] Scheduling reconnect in ${delay / 1000}s...`);
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
        }, delay);
    }
    
    private resubscribe = () => {
        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log(`[${this.name}] Resubscribing to ${this.currentSubscriptions.size} symbols.`);
            this.currentSubscriptions.forEach(symbol => {
                this.ws?.send(JSON.stringify({
                    id: Date.now(),
                    type: 'subscribe',
                    topic: this.getTopic(symbol),
                    response: true
                }));
            });
        }
    }

    public updateSubscriptions = (newSymbols: Set<string>) => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
            this.currentSubscriptions = newSymbols; // Will be subscribed on connect
            return;
        }

        const toAdd = new Set([...newSymbols].filter(s => !this.currentSubscriptions.has(s)));
        const toRemove = new Set([...this.currentSubscriptions].filter(s => !newSymbols.has(s)));

        toAdd.forEach(symbol => {
            console.log(`[${this.name}] Subscribing to ${symbol}`);
            this.ws?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: this.getTopic(symbol) }));
            this.currentSubscriptions.add(symbol);
        });

        toRemove.forEach(symbol => {
            console.log(`[${this.name}] Unsubscribing from ${symbol}`);
            this.ws?.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic: this.getTopic(symbol) }));
            this.currentSubscriptions.delete(symbol);
        });

        if(toAdd.size > 0 || toRemove.size > 0) {
            console.log(`[${this.name}] Subscription change complete: +${toAdd.size} / -${toRemove.size}`);
        }
    }
}

// --- Main Application Logic ---

const spotManager = new WebSocketManager('SPOT', KUCOIN_SPOT_TOKEN_ENDPOINT, (symbol) => `/market/snapshot:${symbol}`);
const futuresManager = new WebSocketManager('FUTURES', KUCOIN_FUTURES_TOKEN_ENDPOINT, (symbol) => `/contractMarket/snapshot:${symbol}`);


spotManager.connect();
futuresManager.connect();

async function collectAllSymbols() {
    console.log("[WORKER] Collecting symbols to monitor from open positions and triggers...");
    const spotSymbols = new Set<string>();
    const futuresSymbols = new Set<string>();

    try {
        // Collect from tradeTriggers
        const triggersSnapshot = await db.collectionGroup('tradeTriggers').get();
        triggersSnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
            const trigger = doc.data();
            if (trigger.type === 'spot') spotSymbols.add(trigger.symbol);
            if (trigger.type === 'futures') futuresSymbols.add(trigger.symbol);
        });

        // Collect from openPositions
        const positionsSnapshot = await db.collectionGroup('openPositions').get();
        positionsSnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
            const position = doc.data();
            if (position.positionType === 'spot') spotSymbols.add(position.symbol);
            if (position.positionType === 'futures') futuresSymbols.add(position.symbol);
        });
        
        console.log(`[WORKER] Found ${spotSymbols.size} spot and ${futuresSymbols.size} futures symbols to watch.`);
        spotManager.updateSubscriptions(spotSymbols);
        futuresManager.updateSubscriptions(futuresSymbols);
    } catch (e) {
        console.error("[WORKER] CRITICAL: Failed to collect symbols due to Firestore query error.", e);
    }
}

// Check for symbols to monitor every 30 seconds
setInterval(collectAllSymbols, 30000);
// Initial run after a short delay
setTimeout(collectAllSymbols, 5000);


async function processPriceUpdate(symbol: string, price: number) {
    if (!symbol || !price) return;
    
    const batch = db.batch();
    let writes = 0;

    try {
        // Check for open positions to hit SL/TP
        // THIS QUERY IS NOW MORE SPECIFIC TO MATCH AN EXISTING INDEX
        const positionsQuery = db.collectionGroup('openPositions')
            .where('symbol', '==', symbol)
            .where('details.status', '==', 'open');
        const positionsSnapshot = await positionsQuery.get();
        
        positionsSnapshot.forEach((doc) => {
            const pos = doc.data() as OpenPosition;
            // No need to check for 'closing' status here as the query now handles it
            const isLong = pos.side === 'long' || pos.side === 'buy';
            const slHit = pos.details?.stopLoss && (isLong ? price <= pos.details.stopLoss : price >= pos.details.stopLoss);
            const tpHit = pos.details?.takeProfit && (isLong ? price >= pos.details.takeProfit : price <= pos.details.takeProfit);

            if (slHit || tpHit) {
                const userId = doc.ref.parent.parent?.parent?.id;
                if (!userId) return;
                console.log(`[EXECUTION] Closing position ${doc.id} for user ${userId} due to ${slHit ? 'Stop Loss' : 'Take Profit'}`);
                batch.update(doc.ref, { 'details.status': 'closing', 'details.closePrice': price });
                writes++;
            }
        });

        // Check for active trade triggers
        const triggersQuery = db.collectionGroup('tradeTriggers').where('symbol', '==', symbol).where('details.status', '==', 'active');
        const triggersSnapshot = await triggersQuery.get();
        triggersSnapshot.forEach((doc) => {
            const trigger = doc.data() as TradeTrigger;
            const conditionMet = (trigger.condition === 'above' && price >= trigger.targetPrice) || (trigger.condition === 'below' && price <= trigger.targetPrice);

            if (conditionMet) {
                const userId = doc.ref.parent.parent?.parent?.id;
                if (!userId) return; // Add null check for safety
                console.log(`[EXECUTION] Firing trigger ${doc.id} for user ${userId}`);
                
                const executedTriggerRef = doc.ref.parent.parent.collection('executedTriggers').doc(doc.id);
                batch.set(executedTriggerRef, { ...trigger, currentPrice: price });
                
                batch.delete(doc.ref); 
                writes++;
                
                if (trigger.cancelOthers) {
                  // This part is a bit tricky in a single batch, better to handle in a separate step if needed
                }
            }
        });

        if (writes > 0) {
            await batch.commit();
        }
    } catch (err) {
        console.error(`Failed to process price update batch for symbol ${symbol}:`, err);
    }
}


// --- Basic HTTP Server to satisfy Cloud Run's requirements ---
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Real-time paper trading engine is running and connected to WebSockets.\n');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
