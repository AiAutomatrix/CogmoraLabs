
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
  status: 'active' | 'executed' | 'canceled';
  cancelOthers?: boolean;
  stopLoss?: number;
  takeProfit?: number;
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


async function executeSpotBuy(transaction: admin.firestore.Transaction, trigger: TradeTrigger, currentPrice: number, userContextRef: admin.firestore.DocumentReference, userContextData: admin.firestore.DocumentData) {
    const { symbol, symbolName, amount } = trigger;
    const balance = userContextData.balance || 0;

    if (balance < amount) {
        console.log(`[EXECUTION_SKIP] User ${userContextRef.parent.parent?.id} has insufficient balance for spot buy.`);
        return;
    }

    const size = amount / currentPrice;
    const newBalance = balance - amount;

    // Check for existing position to average into
    const openPositionsRef = userContextRef.collection('openPositions');
    const existingPositionQuery = openPositionsRef.where('symbol', '==', symbol).where('positionType', '==', 'spot').limit(1);
    const existingPositionSnapshot = await transaction.get(existingPositionQuery);
    
    let positionId: string;

    if (!existingPositionSnapshot.empty) {
        const existingPositionDoc = existingPositionSnapshot.docs[0];
        const existingPosition = existingPositionDoc.data() as OpenPosition;
        positionId = existingPosition.id;
        const totalSize = existingPosition.size + size;
        const totalValue = (existingPosition.size * existingPosition.averageEntryPrice) + (size * currentPrice);
        const newAverageEntry = totalValue / totalSize;

        transaction.update(existingPositionDoc.ref, { size: totalSize, averageEntryPrice: newAverageEntry });
    } else {
        positionId = crypto.randomUUID();
        const details: OpenPositionDetails = { triggeredBy: `trigger:${trigger.id.slice(0,8)}`, stopLoss: trigger.stopLoss, takeProfit: trigger.takeProfit, status: 'open' };
        const newPosition: OpenPosition = { id: positionId, positionType: 'spot', symbol, symbolName, size, averageEntryPrice: currentPrice, currentPrice, side: 'buy', details };
        transaction.set(openPositionsRef.doc(positionId), newPosition);
    }
    
    const tradeHistoryRef = userContextRef.collection('tradeHistory');
    const newTrade: Omit<PaperTrade, 'id'> = { positionId, positionType: 'spot', symbol, symbolName, size, price: currentPrice, side: 'buy', leverage: null, timestamp: Date.now(), status: 'open' };
    transaction.set(tradeHistoryRef.doc(), newTrade);

    transaction.update(userContextRef, { balance: newBalance });
    console.log(`[EXECUTION_SUCCESS] Spot buy for ${symbol} for user ${userContextRef.parent.parent?.id}`);
}

async function executeFuturesTrade(transaction: admin.firestore.Transaction, trigger: TradeTrigger, currentPrice: number, userContextRef: admin.firestore.DocumentReference, userContextData: admin.firestore.DocumentData) {
    const { symbol, symbolName, amount: collateral, leverage, action, id, stopLoss, takeProfit } = trigger;
    const balance = userContextData.balance || 0;

    if (balance < collateral) {
        console.log(`[EXECUTION_SKIP] User ${userContextRef.parent.parent?.id} has insufficient balance for futures trade.`);
        return;
    }
    
    const positionValue = collateral * leverage;
    const size = positionValue / currentPrice;
    const newBalance = balance - collateral;

    const side = action as 'long' | 'short';
    const liquidationPrice = side === 'long' ? currentPrice * (1 - (1/leverage)) : currentPrice * (1 + (1/leverage));

    const positionId = crypto.randomUUID();
    const details: OpenPositionDetails = { triggeredBy: `trigger:${id.slice(0,8)}`, stopLoss, takeProfit, status: 'open' };
    const newPosition: OpenPosition = { id: positionId, positionType: 'futures', symbol, symbolName, size, averageEntryPrice: currentPrice, currentPrice, side, leverage, liquidationPrice, details };
    
    transaction.set(userContextRef.collection('openPositions').doc(positionId), newPosition);

    const newTrade: Omit<PaperTrade, 'id'> = { positionId, positionType: 'futures', symbol, symbolName, size, price: currentPrice, side, leverage, timestamp: Date.now(), status: 'open' };
    transaction.set(userContextRef.collection('tradeHistory').doc(), newTrade);

    transaction.update(userContextRef, { balance: newBalance });
    console.log(`[EXECUTION_SUCCESS] Futures ${side} for ${symbol} for user ${userContextRef.parent.parent?.id}`);
}


async function processPriceUpdate(symbol: string, price: number) {
    if (!symbol || !price) return;
    
    // --- Block 1: Handle SL/TP on Open Positions ---
    try {
        const positionsQuery = db.collectionGroup('openPositions')
            .where('symbol', '==', symbol)
            .where('details.status', '==', 'open');
        const positionsSnapshot = await positionsQuery.get();
        
        if (!positionsSnapshot.empty) {
            const sltpBatch = db.batch();
            let hasSltpUpdates = false;

            positionsSnapshot.forEach((doc) => {
                const pos = doc.data() as OpenPosition;

                if (!pos.details?.stopLoss && !pos.details?.takeProfit) {
                    console.log(`[WORKER_INFO] Watching position ${doc.id} for symbol ${symbol}. No SL/TP set.`);
                    return;
                }

                const slHit = pos.details?.stopLoss && ((pos.side === 'long' || pos.side === 'buy') ? price <= pos.details.stopLoss : price >= pos.details.stopLoss);
                const tpHit = pos.details?.takeProfit && ((pos.side === 'long' || pos.side === 'buy') ? price >= pos.details.takeProfit : price <= pos.details.takeProfit);

                if (slHit || tpHit) {
                    console.log(`[WORKER_ACTION] Position ${doc.id} hit ${slHit ? 'Stop Loss' : 'Take Profit'}. Marking for closure.`);
                    sltpBatch.update(doc.ref, { 'details.status': 'closing' });
                    hasSltpUpdates = true;
                }
            });

            if (hasSltpUpdates) {
                await sltpBatch.commit();
                console.log(`[WORKER_INFO] Committed SL/TP updates for symbol ${symbol}.`);
            }
        }
    } catch(e) {
        console.error(`[WORKER_ERROR] Failed to process SL/TP for symbol ${symbol}:`, e);
    }


    // --- Block 2: Handle Trade Trigger Executions ---
    try {
        const triggersQuery = db.collectionGroup('tradeTriggers').where('symbol', '==', symbol);
        const triggersSnapshot = await triggersQuery.get();

        if (!triggersSnapshot.empty) {
            for (const doc of triggersSnapshot.docs) {
                const trigger = doc.data() as TradeTrigger;
                const conditionMet = (trigger.condition === 'above' && price >= trigger.targetPrice) || (trigger.condition === 'below' && price <= trigger.targetPrice);

                if (conditionMet) {
                    console.log(`[WORKER_ACTION] Firing trigger ${doc.id} for ${symbol}. Starting transaction...`);
                    try {
                        await db.runTransaction(async (transaction) => {
                            const userContextRef = doc.ref.parent.parent!;
                            if (!userContextRef) throw new Error("Could not determine user context from trigger ref.");
                            
                            const userContextSnap = await transaction.get(userContextRef);
                            if (!userContextSnap.exists) throw new Error("User context not found during trigger execution.");
                            
                            if (trigger.type === 'spot') {
                                await executeSpotBuy(transaction, trigger, price, userContextRef, userContextSnap.data()!);
                            } else { // futures
                                await executeFuturesTrade(transaction, trigger, price, userContextRef, userContextSnap.data()!);
                            }
                            
                            transaction.delete(doc.ref); // Delete the trigger as part of the transaction
                        });
                        console.log(`[EXECUTION_SUCCESS] Transaction for trigger ${doc.id} completed.`);

                        if (trigger.cancelOthers) {
                            const cancellationBatch = db.batch();
                            const otherTriggersQuery = doc.ref.parent.where('symbol', '==', trigger.symbol);
                            const otherTriggersSnapshot = await otherTriggersQuery.get();
                            otherTriggersSnapshot.forEach(otherDoc => {
                                if(otherDoc.id !== doc.id) {
                                    console.log(`[WORKER_ACTION] Cancelling other trigger ${otherDoc.id} for symbol ${trigger.symbol}`);
                                    cancellationBatch.delete(otherDoc.ref);
                                }
                            });
                            await cancellationBatch.commit();
                        }

                    } catch (error) {
                        console.error(`[EXECUTION_FAILURE] Transaction for trigger ${doc.id} failed:`, error);
                        await doc.ref.delete();
                    }
                }
            }
        }
    } catch (e) {
         console.error(`[WORKER_ERROR] Failed to query or process triggers for symbol ${symbol}:`, e);
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
