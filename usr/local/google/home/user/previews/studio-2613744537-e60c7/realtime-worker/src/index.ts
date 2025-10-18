
// Worker now uses Firebase Admin SDK to write directly to Firestore.
// This bypasses security rules and prevents PERMISSION_DENIED errors.
import * as admin from 'firebase-admin';
import WebSocket from 'ws';
import http from 'http';
import fetch from 'node-fetch';

// Initialize Firebase Admin SDK for Cloud Run
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- Startup Firestore Write Test ---
(async () => {
  try {
    const docRef = await db.collection('test').add({
      message: 'Startup Firestore write test',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`✅ Startup Firestore write successful: ${docRef.path}`);
  } catch (err) {
    console.error('❌ Startup Firestore write failed:', err);
  }
})();

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

            this.ws.on('message', (data: string) => this.handleMessage(data));
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
            let price: number | undefined;
            const priceData = message.data;

            if (this.name === 'SPOT') {
                if (message.topic === '/market/ticker:all') {
                    symbol = priceData.symbol;
                    price = parseFloat(priceData.price);
                } else {
                    symbol = message.topic.replace('/market/snapshot:', '');
                    price = parseFloat(priceData?.data?.lastTradedPrice);
                }
            } else {
                symbol = message.topic.replace('/contractMarket/tickerV2:', '');
                price = priceData.markPrice;
            }

            if (symbol && price) {
                processPriceUpdate(symbol, price).catch(e =>
                    console.error(`Error in processPriceUpdate for ${symbol}:`, e)
                );
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
            console.log(`[${this.name}] Connection not open. Subscriptions will apply on connect.`);
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
    }
}

// --- Main Application Logic ---
const spotManager = new WebSocketManager('SPOT', KUCOIN_SPOT_TOKEN_ENDPOINT, (symbol) => `/market/snapshot:${symbol}`);
const futuresManager = new WebSocketManager('FUTURES', KUCOIN_FUTURES_TOKEN_ENDPOINT, (symbol) => `/contractMarket/tickerV2:${symbol}`);

spotManager.connect();
futuresManager.connect();

async function collectAllSymbols() {
    console.log("Collecting symbols to monitor...");
    const spotSymbols = new Set<string>();
    const futuresSymbols = new Set<string>();

    try {
        const triggersSnapshot = await db.collectionGroup('tradeTriggers').get();
        triggersSnapshot.forEach(doc => {
            const trigger = doc.data();
            if (trigger.type === 'spot') spotSymbols.add(trigger.symbol);
            if (trigger.type === 'futures') futuresSymbols.add(trigger.symbol);
        });

        const positionsSnapshot = await db.collectionGroup('openPositions').get();
        positionsSnapshot.forEach(doc => {
            const pos = doc.data();
            if (pos.positionType === 'spot') spotSymbols.add(pos.symbol);
            if (pos.positionType === 'futures') futuresSymbols.add(pos.symbol);
        });

        console.log(`Found ${spotSymbols.size} spot and ${futuresSymbols.size} futures symbols to watch.`);
        spotManager.updateSubscriptions(spotSymbols);
        futuresManager.updateSubscriptions(futuresSymbols);

    } catch (e) {
        console.error("CRITICAL: Failed to collect symbols due to Firestore query error.", e);
    }
}

setInterval(collectAllSymbols, 30000);
setTimeout(collectAllSymbols, 5000);

async function processPriceUpdate(symbol: string, price: number) {
    if (!symbol || !price) return;

    try {
        // 1️⃣ Evaluate open positions to see if SL/TP is hit
        const positionsQuery = db.collectionGroup('openPositions').where('symbol', '==', symbol);
        const positionsSnapshot = await positionsQuery.get();
        if (!positionsSnapshot.empty) {
            positionsSnapshot.forEach(doc => {
                const pos = doc.data();
                if (pos.details?.status === 'closing') return;

                const slHit = pos.details?.stopLoss && ((pos.side === 'long' || pos.side === 'buy') ? price <= pos.details.stopLoss : price >= pos.details.stopLoss);
                const tpHit = pos.details?.takeProfit && ((pos.side === 'long' || pos.side === 'buy') ? price >= pos.details.takeProfit : price <= pos.details.takeProfit);

                if (slHit || tpHit) {
                    console.log(`[EXECUTION] Marking position ${doc.id} for closure due to ${slHit ? 'Stop Loss' : 'Take Profit'}`);
                    // The onDocumentWritten Cloud Function will handle the closing logic.
                    doc.ref.update({ 'details.status': 'closing' }).catch(err => {
                         console.error(`[EXECUTION_FAIL] Failed to mark position ${doc.id} for closing:`, err);
                    });
                }
            });
        }

        // 2️⃣ Evaluate active triggers
        const triggersQuery = db.collectionGroup('tradeTriggers').where('symbol', '==', symbol);
        const triggersSnapshot = await triggersQuery.get();
        if (!triggersSnapshot.empty) {
            triggersSnapshot.forEach(doc => {
                const trigger = doc.data();
                const conditionMet = (trigger.condition === 'above' && price >= trigger.targetPrice) || (trigger.condition === 'below' && price <= trigger.targetPrice);
                
                if (conditionMet) {
                    console.log(`[EXECUTION] Deleting executed trigger ${doc.id}`);
                    // The actual trade execution will be handled by another function or by the client observing this change.
                    // For now, we just delete the trigger to prevent re-firing.
                     doc.ref.delete().catch(err => {
                        console.error(`[EXECUTION_FAIL] Failed to delete trigger ${doc.id}:`, err);
                     });
                }
            });
        }

        // ✅ Note: No high-frequency watchlist or currentPrice updates are written to Firestore.

    } catch (err) {
        console.error(`Failed to process price update for ${symbol}:`, err);
    }
}


// --- Basic HTTP Server ---
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Real-time paper trading engine is running.\n');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
