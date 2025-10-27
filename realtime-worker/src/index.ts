
import * as admin from 'firebase-admin';
import WebSocket from 'ws';
import http from 'http';
import crypto from 'crypto';

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
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

// --- Constants and Configuration ---
const KUCOIN_SPOT_TOKEN_ENDPOINT = "https://api.kucoin.com/api/v1/bullet-public";
const KUCOIN_FUTURES_TOKEN_ENDPOINT = "https://api-futures.kucoin.com/api/v1/bullet-public";

const SESSION_MS = Number(process.env.SESSION_MS) || 480_000;
const REQUERY_INTERVAL_MS = Number(process.env.REQUERY_INTERVAL_MS) || 30_000;
const MAX_RECONNECT_ATTEMPTS = 10;
const INSTANCE_ID = process.env.K_REVISION || crypto.randomUUID();


// --- WebSocket Connection Manager ---
class WebSocketManager {
    private ws: WebSocket | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private reconnectAttempts = 0;
    
    // State Management: Desired vs. Actual
    private desiredSubscriptions = new Set<string>();
    private actualSubscriptions = new Set<string>();

    constructor(
        private name: string,
        private tokenEndpoint: string,
        private getTopic: (symbol: string) => string,
    ) {}

    public connect = async () => {
        if (shuttingDown || this.reconnectTimeout) {
             console.log(`[${this.name}] Skipping connect: shutdown in progress or reconnect already scheduled.`);
             return;
        }
        if (this.desiredSubscriptions.size === 0) {
            console.log(`[${this.name}] No desired subscriptions. Aborting connection.`);
            this.disconnect();
            return;
        }

        console.log(`[${this.name}] Attempting to connect...`);
        try {
            const response = await fetch(this.tokenEndpoint, { method: 'POST' });
            if (!response.ok) throw new Error(`Failed to get token with status: ${response.status}`);
            
            const tokenData = await response.json() as any;
            if (tokenData.code !== '200000') throw new Error(tokenData.msg || 'Invalid token data');

            const { token, instanceServers } = tokenData.data;
            const wsUrl = `${instanceServers[0].endpoint}?token=${token}`;
            const pingMs = (typeof instanceServers[0].pingInterval === 'number' && instanceServers[0].pingInterval > 0) ? instanceServers[0].pingInterval : 20000;

            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                console.log(`[${this.name}] WebSocket connection established.`);
                this.reconnectAttempts = 0;
                if (this.reconnectTimeout) {
                    clearTimeout(this.reconnectTimeout);
                    this.reconnectTimeout = null;
                }
                this.setupPing(pingMs);
                this.resubscribe();
            });

            this.ws.on('message', this.handleMessage);
            this.ws.on('close', this.handleClose);
            this.ws.on('error', this.handleError);

        } catch (error) {
            console.error(`[${this.name}] Failed to get token or connect:`, error);
            this.scheduleReconnect();
        }
    }

    private handleMessage = (data: WebSocket.Data) => {
        const raw = typeof data === 'string' ? data : data.toString();
        try {
            const message = JSON.parse(raw);
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
        } catch(e) {
            console.error(`[${this.name}] Error parsing message:`, raw, e);
        }
    }

    private setupPing = (interval: number) => {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ id: Date.now(), type: 'ping' }));
            }
        }, Math.max(1000, Math.floor(interval / 2)));
    }

    private handleClose = () => {
        console.log(`[${this.name}] WebSocket closed.`);
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.actualSubscriptions.clear();
        this.ws = null;
        this.scheduleReconnect();
    }

    private handleError = (error: Error) => {
        console.error(`[${this.name}] WebSocket error:`, error.message);
    }

    private scheduleReconnect = () => {
        if (shuttingDown || this.reconnectTimeout) return;
        if (this.desiredSubscriptions.size === 0) {
            console.log(`[${this.name}] No desired subscriptions; skipping reconnect.`);
            this.disconnect();
            return;
        }

        this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS);
        const baseDelay = Math.min(1000 * (2 ** this.reconnectAttempts), 30_000);
        const jitter = Math.floor(Math.random() * 1000);
        const delay = baseDelay + jitter;
        
        console.log(`[${this.name}] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}).`);
        
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
        }, delay);
    }
    
    private resubscribe = () => {
        if (shuttingDown || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        this.actualSubscriptions.clear();
        console.log(`[${this.name}] Subscribing to ${this.desiredSubscriptions.size} symbols.`);
        this.desiredSubscriptions.forEach(symbol => {
            this.ws?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: this.getTopic(symbol), response: true }));
            this.actualSubscriptions.add(symbol);
        });
    }

    public updateSubscriptions = (newSymbols: Set<string>) => {
        this.desiredSubscriptions = new Set(newSymbols);

        if (this.desiredSubscriptions.size === 0) {
            console.log(`[${this.name}] No desired subscriptions. Disconnecting.`);
            this.disconnect();
            return;
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
             console.log(`[${this.name}] WS not open. Attempting to connect now.`);
             this.connect();
             return;
        }
        
        const toAdd = new Set([...this.desiredSubscriptions].filter(s => !this.actualSubscriptions.has(s)));
        const toRemove = new Set([...this.actualSubscriptions].filter(s => !this.desiredSubscriptions.has(s)));

        toAdd.forEach(symbol => {
            this.ws?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: this.getTopic(symbol), response: true }));
            this.actualSubscriptions.add(symbol);
        });
        toRemove.forEach(symbol => {
            this.ws?.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic: this.getTopic(symbol), response: true }));
            this.actualSubscriptions.delete(symbol);
        });
        
        if (toAdd.size > 0 || toRemove.size > 0) {
            console.log(`[${this.name}] Subscription change: +${toAdd.size} / -${toRemove.size}`);
        }
    }

    public disconnect = () => {
        console.log(`[${this.name}] Disconnecting...`);
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = null;
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.actualSubscriptions.clear();
        this.reconnectAttempts = 0;
    }
}

// --- Main Application Logic ---
const spotManager = new WebSocketManager('SPOT', KUCOIN_SPOT_TOKEN_ENDPOINT, (symbol) => `/market/snapshot:${symbol}`);
const futuresManager = new WebSocketManager('FUTURES', KUCOIN_FUTURES_TOKEN_ENDPOINT, (symbol) => `/contractMarket/snapshot:${symbol}`);

let sessionTimeout: NodeJS.Timeout | null = null;
let requeryInterval: NodeJS.Timeout | null = null;
const closingPositions = new Set<string>();

async function collectAllSymbols() {
    if (shuttingDown) return;
    console.log(`[WORKER ${INSTANCE_ID}] Collecting symbols to monitor...`);
    
    try {
        const spotSymbols = new Set<string>();
        const futuresSymbols = new Set<string>();

        const triggersSnapshot = await db.collectionGroup('tradeTriggers').get();
        triggersSnapshot.forEach(doc => {
            const trigger = doc.data() as TradeTrigger;
            if (trigger.details?.status === 'active') {
              if (trigger.type === 'spot') spotSymbols.add(trigger.symbol);
              if (trigger.type === 'futures') futuresSymbols.add(trigger.symbol);
            }
        });

        const positionsSnapshot = await db.collectionGroup('openPositions').get();
        positionsSnapshot.forEach(doc => {
            const position = doc.data() as OpenPosition;
            if (position.details?.status === 'open') {
              if (position.positionType === 'spot') spotSymbols.add(position.symbol);
              if (position.positionType === 'futures') futuresSymbols.add(position.symbol);
            }
        });
        
        console.log(`[WORKER ${INSTANCE_ID}] Found ${spotSymbols.size} spot and ${futuresSymbols.size} futures symbols to watch.`);
        spotManager.updateSubscriptions(spotSymbols);
        futuresManager.updateSubscriptions(futuresSymbols);

    } catch (e) {
        console.error(`[WORKER ${INSTANCE_ID}] CRITICAL: Failed to collect symbols due to Firestore query error.`, e);
    }
}

async function startSession(sessionMs = SESSION_MS) {
    if (shuttingDown) return;
    console.log(`[WORKER ${INSTANCE_ID}] Starting new session (${sessionMs}ms)`);
    try {
        await collectAllSymbols();
        
        spotManager.connect();
        futuresManager.connect();

        if (sessionTimeout) clearTimeout(sessionTimeout);
        sessionTimeout = setTimeout(() => {
            console.log(`[WORKER ${INSTANCE_ID}] Session timeout reached. Disconnecting managers.`);
            shutdown();
        }, sessionMs);

    } catch (e) {
        console.error(`[WORKER ${INSTANCE_ID}] Error during session startup:`, e);
    }
}

async function processPriceUpdate(symbol: string, price: number) {
    if (shuttingDown || !symbol || !price) return;
    
    // Process open positions
    try {
        const positionsQuery = db.collectionGroup('openPositions').where('symbol', '==', symbol).where('details.status', '==', 'open');
        const positionsSnapshot = await positionsQuery.get();
        
        positionsSnapshot.forEach(async (doc) => {
            if (closingPositions.has(doc.id)) return;
            const pos = doc.data() as OpenPosition;
            const isLong = pos.side === 'long' || pos.side === 'buy';
            const slHit = pos.details?.stopLoss && (isLong ? price <= pos.details.stopLoss : price >= pos.details.stopLoss);
            const tpHit = pos.details?.takeProfit && (isLong ? price >= pos.details.takeProfit : price <= pos.details.takeProfit);

            if (slHit || tpHit) {
                closingPositions.add(doc.id);
                console.log(`[EXECUTION] Closing position ${doc.id} due to ${slHit ? 'Stop Loss' : 'Take Profit'}`);
                try {
                   await db.runTransaction(async tx => {
                       const freshDoc = await tx.get(doc.ref);
                       if (freshDoc.exists && freshDoc.data()?.details.status === 'open') {
                           tx.update(doc.ref, { 'details.status': 'closing', 'details.closePrice': price });
                       }
                   });
                } catch (e) {
                    console.error(`Transaction failed for closing position ${doc.id}:`, e);
                    closingPositions.delete(doc.id);
                }
            }
        });
    } catch (err) {
        console.error(`[WORKER_ERROR] Failed to query/process open positions for ${symbol}:`, err);
    }
    
    // Process trade triggers
    try {
        const triggersQuery = db.collectionGroup('tradeTriggers').where('symbol', '==', symbol).where('details.status', '==', 'active');
        const triggersSnapshot = await triggersQuery.get();
        
        triggersSnapshot.forEach(async (doc) => {
            const trigger = doc.data() as TradeTrigger;
            const conditionMet = (trigger.condition === 'above' && price >= trigger.targetPrice) || (trigger.condition === 'below' && price <= trigger.targetPrice);

            if (conditionMet) {
                try {
                    await db.runTransaction(async (tx) => {
                        const freshDoc = await tx.get(doc.ref);
                        if (!freshDoc.exists) return;
                        
                        const userContextRef = doc.ref.parent.parent;
                        if (!userContextRef) return;
                        
                        console.log(`[EXECUTION] Firing trigger ${doc.id} for user ${userContextRef.id}`);
                        const executedTriggerRef = userContextRef.collection('executedTriggers').doc(doc.id);
                        tx.set(executedTriggerRef, { ...trigger, currentPrice: price });
                        tx.delete(doc.ref);
                    });
                } catch(e) {
                     console.error(`[EXECUTION_FAILURE] Transaction to execute trigger ${doc.id} failed:`, e);
                }
            }
        });
    } catch (err) {
        console.error(`[WORKER_ERROR] Failed to query triggers for ${symbol}:`, err);
    }
}

// --- Server Lifecycle & Graceful Shutdown ---
const server = http.createServer((req, res) => {
    if (req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Real-time paper trading engine is running.\n');
    }
});

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[WORKER ${INSTANCE_ID}] Shutdown initiated. Closing timers, WS, and DB connections.`);
  
  if (sessionTimeout) clearTimeout(sessionTimeout);
  if (requeryInterval) clearInterval(requeryInterval);
  
  spotManager.disconnect();
  futuresManager.disconnect();
  
  try { await admin.app().delete(); } catch (e) { console.error(`[WORKER ${INSTANCE_ID}] Error deleting Firebase app`, e); }
  
  server.close(() => {
    console.log(`[WORKER ${INSTANCE_ID}] HTTP server closed.`);
    process.exit(0);
  });
  
  setTimeout(() => {
      console.error(`[WORKER ${INSTANCE_ID}] Could not close connections in time, forcing exit.`);
      process.exit(1);
  }, 5000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`[WORKER ${INSTANCE_ID}] Server listening on port ${PORT}`);
    startSession(SESSION_MS);
    requeryInterval = setInterval(() => {
      if (!shuttingDown) {
        collectAllSymbols();
      }
    }, REQUERY_INTERVAL_MS);
});
