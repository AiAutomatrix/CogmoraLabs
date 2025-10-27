
import * as admin from 'firebase-admin';
import WebSocket from 'ws';
import http from 'http';
import crypto from 'crypto';
import fetch from 'node-fetch';

// ========== Type Definitions ==========
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

// ========== Firebase Initialization ==========
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

// ========== Constants ==========
const KUCOIN_SPOT_TOKEN_ENDPOINT = 'https://api.kucoin.com/api/v1/bullet-public';
const KUCOIN_FUTURES_TOKEN_ENDPOINT = 'https://api-futures.kucoin.com/api/v1/bullet-public';
const SESSION_MS = Number(process.env.SESSION_MS) || 480000;
const REQUERY_INTERVAL_MS = Number(process.env.REQUERY_INTERVAL_MS) || 30_000;
const MAX_RECONNECT_ATTEMPTS = 10;
const INSTANCE_ID = process.env.K_REVISION || crypto.randomUUID();

let sessionActive = false;
let sessionTimeout: NodeJS.Timeout | null = null;
let requeryInterval: NodeJS.Timeout | null = null;
const closingPositions = new Set<string>();

// ========== WebSocket Manager ==========
class WebSocketManager {
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private desiredSubscriptions = new Set<string>();
  private actualSubscriptions = new Set<string>();
  
  // Token Caching
  private lastTokenTime = 0;
  private cachedToken: any = null;

  constructor(
    private name: string,
    private tokenEndpoint: string,
    private getTopic: (symbol: string) => string,
  ) {}

  private async getTokenWithRetry(maxRetries = 3): Promise<any> {
    const now = Date.now();
    if (this.cachedToken && now - this.lastTokenTime < 60_000) {
      console.log(`[${this.name}] Using cached token.`);
      return this.cachedToken;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10-second timeout for fetch
        
        const res = await fetch(this.tokenEndpoint, { 
            method: 'POST', 
            signal: (controller as any).signal,
        });
        clearTimeout(timeout);
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as any;
        if (data.code !== '200000') throw new Error(`Invalid response code: ${data.code}`);

        this.cachedToken = data.data;
        this.lastTokenTime = now;
        return data.data;

      } catch (e) {
        console.error(`[${this.name}] Token fetch attempt ${attempt} failed:`, e);
        if (attempt === maxRetries) throw e;
        const delay = 2000 * attempt;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  public async connect() {
    if (this.reconnectTimeout) return;
    if (this.desiredSubscriptions.size === 0) {
      this.disconnect();
      return;
    }

    console.log(`[${this.name}] Attempting to fetch KuCoin token and connect...`);
    try {
      const { token, instanceServers } = await this.getTokenWithRetry();
      const wsUrl = `${instanceServers[0].endpoint}?token=${token}`;
      const pingMs = instanceServers[0].pingInterval || 20000;

      console.log(`[${this.name}] Connecting WebSocket -> ${wsUrl}`);
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log(`[${this.name}] ✅ WebSocket connection established.`);
        this.reconnectAttempts = 0;
        this.setupPing(pingMs);
        this.resubscribe();
      });

      this.ws.on('message', this.handleMessage);
      this.ws.on('close', () => this.handleClose('closed'));
      this.ws.on('error', (err) => this.handleClose(`error: ${err.message}`));
    } catch (err) {
      console.error(`[${this.name}] ❌ Connection setup failed:`, err);
      this.scheduleReconnect();
    }
  }

  private setupPing(interval: number) {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ id: Date.now(), type: 'ping' }));
      }
    }, Math.max(5000, interval / 2));
  }

  private handleMessage = (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'message' && msg.topic) {
        const symbol = this.name === 'SPOT' ? msg.topic.split(':')[1] : msg.topic.replace('/contractMarket/snapshot:', '');
        const price = this.name === 'SPOT' ? parseFloat(msg.data?.data?.lastTradedPrice) : parseFloat(msg.data?.markPrice);

        if (symbol && !isNaN(price)) {
          processPriceUpdate(symbol, price);
        }
      }
    } catch (err) {
      console.error(`[${this.name}] Error parsing WS message:`, err);
    }
  };

  private handleClose(reason: string) {
    console.warn(`[${this.name}] ⚠️ WebSocket closed due to ${reason}.`);
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = null;
    this.actualSubscriptions.clear();
    
    if (!sessionActive) {
      console.log(`[${this.name}] Session inactive, skipping reconnect.`);
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout || !sessionActive) return;
    if (this.desiredSubscriptions.size === 0) return;

    this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS);
    const baseDelay = 1000 * 2 ** this.reconnectAttempts;
    const jitter = Math.random() * 1000;
    const delay = Math.min(baseDelay + jitter, 60_000);

    console.log(`[${this.name}] Scheduling reconnect in ${delay.toFixed(0)}ms.`);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  private resubscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.actualSubscriptions.clear();
    console.log(`[${this.name}] Subscribing to ${this.desiredSubscriptions.size} symbols...`);
    for (const symbol of this.desiredSubscriptions) {
      const topic = this.getTopic(symbol);
      this.ws.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic, response: true }));
      this.actualSubscriptions.add(symbol);
    }
  }

  public updateSubscriptions(symbols: Set<string>) {
    this.desiredSubscriptions = symbols;
    if (symbols.size === 0) {
      console.log(`[${this.name}] No symbols to watch. Disconnecting.`);
      this.disconnect();
      return;
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log(`[${this.name}] WS not open. Attempting to connect now.`);
      this.connect();
    } else {
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
  }

  public disconnect() {
    console.log(`[${this.name}] Disconnecting WebSocket...`);
    if(this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = null;
    if(this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
    if (this.ws) {
      try { this.ws.close(1000, 'Session ended by worker'); } catch(e) {/* ignore */}
      this.ws.removeAllListeners();
      this.ws = null;
    }
    this.actualSubscriptions.clear();
    this.reconnectAttempts = 0;
  }
}

// ========== Managers ==========
const spotManager = new WebSocketManager('SPOT', KUCOIN_SPOT_TOKEN_ENDPOINT, (s) => `/market/snapshot:${s}`);
const futuresManager = new WebSocketManager('FUTURES', KUCOIN_FUTURES_TOKEN_ENDPOINT, (s) => `/contractMarket/snapshot:${s}`);

// ========== Symbol Collector ==========
async function collectAllSymbols() {
  console.log(`[WORKER ${INSTANCE_ID}] 🔍 Collecting symbols to monitor...`);
  const spotSymbols = new Set<string>();
  const futuresSymbols = new Set<string>();
  try {
    const positionsSnapshot = await db.collectionGroup('openPositions').get();
    positionsSnapshot.forEach(doc => {
      const pos = doc.data() as OpenPosition;
      if (pos.details?.status === 'open') {
        if (pos.positionType === 'spot') spotSymbols.add(pos.symbol);
        if (pos.positionType === 'futures') futuresSymbols.add(pos.symbol);
      }
    });
    
    const triggersSnapshot = await db.collectionGroup('tradeTriggers').get();
    triggersSnapshot.forEach(doc => {
      const trigger = doc.data() as TradeTrigger;
      if (trigger.details?.status === 'active') {
        if (trigger.type === 'spot') spotSymbols.add(trigger.symbol);
        if (trigger.type === 'futures') futuresSymbols.add(trigger.symbol);
      }
    });

    console.log(`[WORKER ${INSTANCE_ID}] Found ${spotSymbols.size} SPOT and ${futuresSymbols.size} FUTURES symbols.`);
    spotManager.updateSubscriptions(spotSymbols);
    futuresManager.updateSubscriptions(futuresSymbols);
  } catch (e) {
    console.error(`[WORKER ${INSTANCE_ID}] ❌ Failed to collect symbols:`, e);
  }
}

// ========== Price Processing ==========
async function processPriceUpdate(symbol: string, price: number) {
    if (!symbol || !price) return;
    
    // Check for open positions to hit SL/TP
    try {
        const positionsQuery = db.collectionGroup('openPositions').where('symbol', '==', symbol).where('details.status', '==', 'open');
        const positionsSnapshot = await positionsQuery.get();

        positionsSnapshot.forEach(async (doc) => {
            const pos = doc.data() as OpenPosition;
            const isLong = pos.side === 'long' || pos.side === 'buy';
            const slHit = pos.details?.stopLoss && (isLong ? price <= pos.details.stopLoss : price >= pos.details.stopLoss);
            const tpHit = pos.details?.takeProfit && (isLong ? price >= pos.details.takeProfit : price <= pos.details.takeProfit);

            if ((slHit || tpHit) && !closingPositions.has(doc.id)) {
                closingPositions.add(doc.id);
                try {
                    await db.runTransaction(async (tx) => {
                        const freshDoc = await tx.get(doc.ref);
                        if (freshDoc.data()?.details?.status !== 'open') return;
                        console.log(`[EXECUTION] Closing position ${doc.id} for ${slHit ? 'SL' : 'TP'}`);
                        tx.update(doc.ref, { 'details.status': 'closing', 'details.closePrice': price });
                    });
                } catch (e) {
                    console.error(`[EXECUTION_FAILURE] Transaction to close position ${doc.id} failed:`, e);
                } finally {
                    closingPositions.delete(doc.id);
                }
            }
        });
    } catch (err) {
        console.error(`[WORKER_ERROR] Failed to process open positions for ${symbol}:`, err);
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
                        const userContextRef = doc.ref.parent.parent;
                        if (!userContextRef) return;
                        
                        const freshDoc = await tx.get(doc.ref);
                        if (!freshDoc.exists) return;
                        
                        console.log(`[EXECUTION] Firing trigger ${doc.id}`);
                        const executedTriggerRef = userContextRef.collection('executedTriggers').doc(doc.id);
                        tx.set(executedTriggerRef, { ...trigger, currentPrice: price });
                        tx.delete(doc.ref);
                    });
                } catch(e) {
                    console.error(`[EXECUTION_FAILURE] Transaction for trigger ${doc.id} failed:`, e);
                }
            }
        });
    } catch (err) {
        console.error(`[WORKER_ERROR] Failed to process triggers for ${symbol}:`, err);
    }
}


// ========== Session Loop ==========
async function startSession(ms = SESSION_MS) {
  if (sessionActive) return;
  sessionActive = true;
  console.log(`[WORKER ${INSTANCE_ID}] 🚀 Starting session (${ms}ms)`);
  
  await collectAllSymbols();

  if (sessionTimeout) clearTimeout(sessionTimeout);
  sessionTimeout = setTimeout(() => {
    console.log(`[WORKER ${INSTANCE_ID}] Session complete. Disconnecting.`);
    spotManager.disconnect();
    futuresManager.disconnect();
    sessionActive = false;
  }, ms);
}

// ========== HTTP Server ==========
const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200);
    res.end('ok');
  } else {
    res.writeHead(200);
    res.end(`Worker ${INSTANCE_ID} running`);
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`[WORKER ${INSTANCE_ID}] Listening on ${PORT}`);
  startSession();
  requeryInterval = setInterval(() => {
      if (!sessionActive) {
          startSession();
      }
  }, REQUERY_INTERVAL_MS);
  setInterval(() => {
    console.log(`[WORKER ${INSTANCE_ID}] Heartbeat — sessionActive=${sessionActive}`);
  }, 60_000);
});

// ========== Graceful Shutdown ==========
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[WORKER ${INSTANCE_ID}] Shutdown signal received.`);
  if(requeryInterval) clearInterval(requeryInterval);
  if(sessionTimeout) clearTimeout(sessionTimeout);
  sessionActive = false;
  spotManager.disconnect();
  futuresManager.disconnect();
  try { await admin.app().delete(); } catch(e) { /* Ignore */ }
  server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
  });
   setTimeout(() => {
      console.error(`[WORKER ${INSTANCE_ID}] Could not close connections in time, forcing exit.`);
      process.exit(1);
  }, 5000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

    