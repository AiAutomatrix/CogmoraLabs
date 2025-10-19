
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
}

interface OpenPosition {
  id: string;
  userId: string; // Add userId to track ownership
  docPath: string; // Add path to easily reference the document
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
  price: number;
  side: 'buy' | 'sell' | 'long' | 'short';
  leverage: number | null;
  timestamp: number;
  status: 'open' | 'closed';
  pnl?: number | null;
}

interface TradeTriggerDetails {
    status: 'active' | 'executed' | 'canceled';
}

interface TradeTrigger {
  id: string;
  userId: string; // Add userId to track ownership
  docPath: string; // Add path to easily reference the document
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

// --- In-Memory State and Update Queue ---
let inMemoryPositions: Map<string, OpenPosition> = new Map();
let inMemoryTriggers: Map<string, TradeTrigger> = new Map();
let firestoreUpdateQueue: Map<string, { type: 'update' | 'delete', path: string, data?: any }> = new Map();
const WRITE_INTERVAL = 10000; // 10 seconds


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
                // Instead of calling processPriceUpdate directly, we now queue it for internal processing
                processPriceUpdate(symbol, price);
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
    }

    private scheduleReconnect = () => {
        if (this.reconnectTimeout) return;
        this.reconnectAttempts++;
        const delay = Math.min(1000 * (2 ** this.reconnectAttempts), 30000);
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
            this.currentSubscriptions = newSymbols;
            return;
        }
        const toAdd = new Set([...newSymbols].filter(s => !this.currentSubscriptions.has(s)));
        const toRemove = new Set([...this.currentSubscriptions].filter(s => !newSymbols.has(s)));
        toAdd.forEach(symbol => {
            this.ws?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: this.getTopic(symbol) }));
            this.currentSubscriptions.add(symbol);
        });
        toRemove.forEach(symbol => {
            this.ws?.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic: this.getTopic(symbol) }));
            this.currentSubscriptions.delete(symbol);
        });
        if(toAdd.size > 0 || toRemove.size > 0) {
            console.log(`[${this.name}] Subscription change: +${toAdd.size} / -${toRemove.size}`);
        }
    }
}

// --- Main Application Logic ---

const spotManager = new WebSocketManager('SPOT', KUCOIN_SPOT_TOKEN_ENDPOINT, (symbol) => `/market/snapshot:${symbol}`);
const futuresManager = new WebSocketManager('FUTURES', KUCOIN_FUTURES_TOKEN_ENDPOINT, (symbol) => `/contractMarket/snapshot:${symbol}`);

spotManager.connect();
futuresManager.connect();

async function cacheAllPositionsAndTriggers() {
    console.log("[WORKER_CACHE] Refreshing in-memory cache for positions and triggers...");
    const newPositions = new Map<string, OpenPosition>();
    const newTriggers = new Map<string, TradeTrigger>();
    const spotSymbols = new Set<string>();
    const futuresSymbols = new Set<string>();

    try {
        const positionsSnapshot = await db.collectionGroup('openPositions').where('details.status', '==', 'open').get();
        positionsSnapshot.forEach((doc) => {
            const pos = doc.data() as Omit<OpenPosition, 'userId' | 'docPath'>;
            const userId = doc.ref.parent.parent?.id;
            if (userId) {
                const fullPos = { ...pos, userId, docPath: doc.ref.path, id: doc.id };
                newPositions.set(doc.id, fullPos);
                if (pos.positionType === 'spot') spotSymbols.add(pos.symbol);
                else futuresSymbols.add(pos.symbol);
            }
        });

        const triggersSnapshot = await db.collectionGroup('tradeTriggers').where('details.status', '==', 'active').get();
        triggersSnapshot.forEach((doc) => {
            const trigger = doc.data() as Omit<TradeTrigger, 'userId' | 'docPath'>;
            const userId = doc.ref.parent.parent?.id;
            if (userId) {
                 const fullTrigger = { ...trigger, userId, docPath: doc.ref.path, id: doc.id };
                newTriggers.set(doc.id, fullTrigger);
                if (trigger.type === 'spot') spotSymbols.add(trigger.symbol);
                else futuresSymbols.add(trigger.symbol);
            }
        });

        inMemoryPositions = newPositions;
        inMemoryTriggers = newTriggers;

        console.log(`[WORKER_CACHE] Caching complete. Positions: ${inMemoryPositions.size}, Triggers: ${inMemoryTriggers.size}.`);
        console.log(`[WORKER_CACHE] Watching ${spotSymbols.size} spot and ${futuresSymbols.size} futures symbols.`);

        spotManager.updateSubscriptions(spotSymbols);
        futuresManager.updateSubscriptions(futuresSymbols);
    } catch (e) {
        console.error("[WORKER_CRITICAL] Failed to refresh cache due to Firestore query error.", e);
    }
}

// Refresh cache every 30 seconds
setInterval(cacheAllPositionsAndTriggers, 30000);
// Initial run after a short delay
setTimeout(cacheAllPositionsAndTriggers, 5000);

async function commitBatchUpdates() {
    if (firestoreUpdateQueue.size === 0) return;

    console.log(`[WORKER_FIRESTORE] Committing batch of ${firestoreUpdateQueue.size} updates...`);
    const batch = db.batch();
    const queue = new Map(firestoreUpdateQueue);
    firestoreUpdateQueue.clear();

    queue.forEach(update => {
        const docRef = db.doc(update.path);
        if (update.type === 'update') {
            batch.update(docRef, update.data);
        } else if (update.type === 'delete') {
            batch.delete(docRef);
        }
    });

    try {
        await batch.commit();
        console.log('[WORKER_FIRESTORE] Batch commit successful.');
    } catch (error) {
        console.error('[WORKER_FIRESTORE] Batch commit failed:', error);
    }
}

// Commit updates every 10 seconds
setInterval(commitBatchUpdates, WRITE_INTERVAL);


function processPriceUpdate(symbol: string, price: number) {
    console.log(`[WORKER_TICK] Received price for ${symbol}: ${price}`);

    // Update positions in memory
    for (const [posId, pos] of inMemoryPositions.entries()) {
        if (pos.symbol === symbol) {
            pos.currentPrice = price;
            pos.unrealizedPnl = (price - pos.averageEntryPrice) * pos.size * (pos.side === 'short' ? -1 : 1);
            
            // Queue P&L update for Firestore
            firestoreUpdateQueue.set(posId, {
                type: 'update',
                path: pos.docPath,
                data: { currentPrice: pos.currentPrice, unrealizedPnl: pos.unrealizedPnl }
            });

            // Check for SL/TP
            const isLong = pos.side === 'long' || pos.side === 'buy';
            const slHit = pos.details?.stopLoss && (isLong ? price <= pos.details.stopLoss : price >= pos.details.stopLoss);
            const tpHit = pos.details?.takeProfit && (isLong ? price >= pos.details.takeProfit : price <= pos.details.takeProfit);

            if (slHit || tpHit) {
                console.log(`[WORKER_INTERNAL] Position ${posId} for user ${pos.userId} hit ${slHit ? 'Stop Loss' : 'Take Profit'}. Queuing for closure.`);
                inMemoryPositions.delete(posId); // Remove from memory to prevent re-processing
                firestoreUpdateQueue.set(posId, {
                    type: 'update',
                    path: pos.docPath,
                    data: { 'details.status': 'closing' }
                });
            }
        }
    }

    // Check triggers in memory
    for (const [triggerId, trigger] of inMemoryTriggers.entries()) {
        if (trigger.symbol === symbol) {
            const conditionMet = (trigger.condition === 'above' && price >= trigger.targetPrice) || (trigger.condition === 'below' && price <= trigger.targetPrice);

            if (conditionMet) {
                console.log(`[WORKER_INTERNAL] Trigger ${triggerId} for user ${trigger.userId} met condition. Queuing for execution.`);
                // For simplicity, we just delete the trigger. The backend function will create the position.
                // A more advanced worker could create the position directly here.
                inMemoryTriggers.delete(triggerId); // Remove from memory
                firestoreUpdateQueue.set(triggerId, {
                    type: 'delete',
                    path: trigger.docPath
                });
                 // TODO: A more robust system would also queue the position creation here.
            }
        }
    }
}

// --- Basic HTTP Server to satisfy Cloud Run's requirements ---
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Real-time paper trading engine is running and connected to WebSockets.\n');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`[WORKER] Server listening on port ${PORT}`);
});
