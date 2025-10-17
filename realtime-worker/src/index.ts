import * as admin from 'firebase-admin';
import WebSocket from 'ws';
import http from 'http';

// Initialize Firebase Admin SDK
admin.initializeApp();
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
        private topicPrefix: string
    ) {}

    public connect = async () => {
        console.log(`[${this.name}] Attempting to connect...`);
        try {
            const response = await fetch(this.tokenEndpoint, { method: 'POST' });
            const tokenData = await response.json();
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
                this.handleMessage(data.toString());
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
            const symbol = message.topic.replace(this.topicPrefix, '');
            const priceData = message.data;
            
            let price: number | undefined;
            if(this.name === 'SPOT'){
                price = parseFloat(priceData.price);
            } else { // FUTURES
                price = priceData.markPrice;
            }

            if (price) {
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
            this.currentSubscriptions.forEach(symbol => {
                this.ws?.send(JSON.stringify({
                    id: Date.now(),
                    type: 'subscribe',
                    topic: `${this.topicPrefix}${symbol}`,
                    response: true
                }));
            });
             console.log(`[${this.name}] Resubscribed to ${this.currentSubscriptions.size} symbols.`);
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
            this.ws?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: `${this.topicPrefix}${symbol}` }));
            this.currentSubscriptions.add(symbol);
        });

        toRemove.forEach(symbol => {
            this.ws?.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic: `${this.topicPrefix}${symbol}` }));
            this.currentSubscriptions.delete(symbol);
        });

        if(toAdd.size > 0 || toRemove.size > 0) {
            console.log(`[${this.name}] Subscription change: +${toAdd.size} / -${toRemove.size}`);
        }
    }
}


// --- Main Application Logic ---

const spotManager = new WebSocketManager('SPOT', KUCOIN_SPOT_TOKEN_ENDPOINT, '/market/ticker:');
const futuresManager = new WebSocketManager('FUTURES', KUCOIN_FUTURES_TOKEN_ENDPOINT, '/contractMarket/tickerV2:');

spotManager.connect();
futuresManager.connect();

async function collectAllSymbols() {
    const spotSymbols = new Set<string>();
    const futuresSymbols = new Set<string>();

    const triggersSnapshot = await db.collectionGroup('tradeTriggers').get();
    triggersSnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
        const trigger = doc.data();
        if (trigger.type === 'spot') spotSymbols.add(trigger.symbol);
        if (trigger.type === 'futures') futuresSymbols.add(trigger.symbol);
    });

    const positionsSnapshot = await db.collectionGroup('openPositions').get();
    positionsSnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
        const position = doc.data();
        if (position.positionType === 'spot') spotSymbols.add(position.symbol);
        if (position.positionType === 'futures') futuresSymbols.add(position.symbol);
    });
    
    spotManager.updateSubscriptions(spotSymbols);
    futuresManager.updateSubscriptions(futuresSymbols);
}

// Check for symbols to monitor every 30 seconds
setInterval(collectAllSymbols, 30000);
collectAllSymbols(); // Initial run

async function processPriceUpdate(symbol: string, price: number) {
    if (!symbol || !price) return;
    
    // Check for open positions to hit SL/TP
    const positionsQuery = db.collectionGroup('openPositions').where('symbol', '==', symbol);
    const positionsSnapshot = await positionsQuery.get();
    positionsSnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
        const pos = doc.data();
        if (pos.details?.status === 'closing') return;

        const slHit = pos.details?.stopLoss && ((pos.side === 'long' || pos.side === 'buy') ? price <= pos.details.stopLoss : price >= pos.details.stopLoss);
        const tpHit = pos.details?.takeProfit && ((pos.side === 'long' || pos.side === 'buy') ? price >= pos.details.takeProfit : price <= pos.details.takeProfit);

        if (slHit || tpHit) {
            console.log(`[EXECUTION] Closing position ${doc.id} for user ${doc.ref.parent.parent?.parent.id} due to ${slHit ? 'Stop Loss' : 'Take Profit'}`);
            doc.ref.update({ 'details.status': 'closing' });
        }
    });

    // Check for active trade triggers
    const triggersQuery = db.collectionGroup('tradeTriggers').where('symbol', '==', symbol);
    const triggersSnapshot = await triggersQuery.get();
    triggersSnapshot.forEach(async (doc: admin.firestore.QueryDocumentSnapshot) => {
        const trigger = doc.data();
        const conditionMet = (trigger.condition === 'above' && price >= trigger.targetPrice) || (trigger.condition === 'below' && price <= trigger.targetPrice);

        if (conditionMet) {
            console.log(`[EXECUTION] Firing trigger ${doc.id} for user ${doc.ref.parent.parent?.parent.id}`);
            // This is a simplified execution. A robust version would use a transactional Cloud Function.
            // For now, we'll mark it for deletion and assume a separate cleanup process.
            // In a full implementation, you'd create the position, update balance, etc., here.
            await doc.ref.delete(); 
        }
    });
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
