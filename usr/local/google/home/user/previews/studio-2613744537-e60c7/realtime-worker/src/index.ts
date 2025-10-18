
// Worker now uses Firebase Admin SDK to write directly to Firestore.
// This bypasses security rules and prevents PERMISSION_DENIED errors.

import * as admin from 'firebase-admin';
import WebSocket from 'ws';
import http from 'http';
import fetch from 'node-fetch'; // Use node-fetch for CommonJS compatibility

// Initialize Firebase Admin SDK for the Cloud Run environment
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
// --- End Startup Write Test ---


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
                if (message.topic === '/market/ticker:all') {
                    symbol = priceData.symbol; // For /market/ticker:all
                    price = parseFloat(priceData.price);
                } else { // For /market/snapshot:{symbol}
                    symbol = message.topic.replace('/market/snapshot:', '');
                    price = parseFloat(priceData?.data?.lastTradedPrice);
                }
            } else { // FUTURES
                symbol = message.topic.replace('/contractMarket/tickerV2:', '');
                price = priceData.markPrice;
            }

            if (price && symbol) {
                // To avoid spamming logs, we won't log every single price update here.
                // The processing function will log when it takes action.
                processPriceUpdate(symbol, price).catch(e => console.error(`Error in processPriceUpdate for ${symbol}:`, e));
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
            console.log(`[${this.name}] Connection not open. Subscriptions will be applied on connect.`);
            return;
        }

        const toAdd = new Set([...newSymbols].filter(s => !this.currentSubscriptions.has(s)));
        const toRemove = new Set([...this.currentSubscriptions].filter(s => !newSymbols.has(s)));

        if (toAdd.size > 0) {
            console.log(`[${this.name}] Subscribing to new symbols:`, Array.from(toAdd));
            toAdd.forEach(symbol => {
                this.ws?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: this.getTopic(symbol) }));
                this.currentSubscriptions.add(symbol);
            });
        }

        if (toRemove.size > 0) {
            console.log(`[${this.name}] Unsubscribing from symbols:`, Array.from(toRemove));
            toRemove.forEach(symbol => {
                this.ws?.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic: this.getTopic(symbol) }));
                this.currentSubscriptions.delete(symbol);
            });
        }

        if(toAdd.size === 0 && toRemove.size === 0) {
            // console.log(`[${this.name}] Subscription list is already up to date.`);
        }
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

        // Collect from watchlist
        const watchlistSnapshot = await db.collectionGroup('watchlist').get();
        watchlistSnapshot.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
            const item = doc.data();
            // Assuming watchlist items have a 'type' field ('spot' or 'futures')
            if (item.type === 'spot') spotSymbols.add(item.symbol);
            if (item.type === 'futures') futuresSymbols.add(item.symbol);
        });
        
        console.log(`Found ${spotSymbols.size} spot and ${futuresSymbols.size} futures symbols to watch.`);
        spotManager.updateSubscriptions(spotSymbols);
        futuresManager.updateSubscriptions(futuresSymbols);
    } catch (e) {
        console.error("CRITICAL: Failed to collect symbols due to Firestore query error.", e);
    }
}

// Check for symbols to monitor every 30 seconds
setInterval(collectAllSymbols, 30000);
// Initial run with a delay to allow services to warm up
setTimeout(collectAllSymbols, 5000);

const BATCH_LIMIT = 490; // Stay safely below the 500 limit

async function processPriceUpdate(symbol: string, price: number) {
    if (!symbol || !price) return;

    let batches: admin.firestore.WriteBatch[] = [db.batch()];
    let currentBatchIndex = 0;
    let writesInCurrentBatch = 0;

    const addWrite = () => {
        writesInCurrentBatch++;
        if (writesInCurrentBatch >= BATCH_LIMIT) {
            batches.push(db.batch());
            currentBatchIndex++;
            writesInCurrentBatch = 0;
        }
    };

    try {
        // Check for open positions to hit SL/TP
        const positionsQuery = db.collectionGroup('openPositions').where('symbol', '==', symbol);
        const positionsSnapshot = await positionsQuery.get();
        if (!positionsSnapshot.empty) {
            positionsSnapshot.forEach((doc) => {
                const pos = doc.data();
                if (pos.details?.status === 'closing') return;

                const slHit = pos.details?.stopLoss && ((pos.side === 'long' || pos.side === 'buy') ? price <= pos.details.stopLoss : price >= pos.details.stopLoss);
                const tpHit = pos.details?.takeProfit && ((pos.side === 'long' || pos.side === 'buy') ? price >= pos.details.takeProfit : price <= pos.details.takeProfit);

                if (slHit || tpHit) {
                    console.log(`[EXECUTION] Closing position ${doc.id} for user ${doc.ref.parent.parent?.parent.id} due to ${slHit ? 'Stop Loss' : 'Take Profit'}`);
                    batches[currentBatchIndex].update(doc.ref, { 'details.status': 'closing' });
                    addWrite();
                }
            });
        }


        // Check for active trade triggers
        const triggersQuery = db.collectionGroup('tradeTriggers').where('symbol', '==', symbol);
        const triggersSnapshot = await triggersQuery.get();
        if (!triggersSnapshot.empty) {
            triggersSnapshot.forEach((doc) => {
                const trigger = doc.data();
                const conditionMet = (trigger.condition === 'above' && price >= trigger.targetPrice) || (trigger.condition === 'below' && price <= trigger.targetPrice);

                if (conditionMet) {
                    console.log(`[EXECUTION] Firing trigger ${doc.id} for user ${doc.ref.parent.parent?.parent.id}`);
                    batches[currentBatchIndex].delete(doc.ref); 
                    addWrite();
                }
            });
        }


        // Update watchlist items with the new price
        const watchlistQuery = db.collectionGroup('watchlist').where('symbol', '==', symbol);
        const watchlistSnapshot = await watchlistQuery.get();
        if (!watchlistSnapshot.empty) {
            watchlistSnapshot.forEach((doc) => {
                batches[currentBatchIndex].update(doc.ref, { currentPrice: price });
                addWrite();
            });
        }

        const totalWrites = (currentBatchIndex * BATCH_LIMIT) + writesInCurrentBatch;
        if (totalWrites > 0) {
            await Promise.all(batches.map(batch => batch.commit()));
            console.log(`[DB_WRITE] Committed ${totalWrites} writes across ${batches.length} batch(es) for symbol ${symbol} at price ${price}.`);
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
