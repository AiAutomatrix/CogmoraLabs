
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
  userId: string; // Added for context
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
  userId: string; // Added for context
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
  currentPrice?: number;
}

// ========== Firebase Initialization ==========
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

// ========== Constants ==========
const KUCOIN_SPOT_TOKEN_ENDPOINT = "https://api.kucoin.com/api/v1/bullet-public";
const KUCOIN_FUTURES_TOKEN_ENDPOINT =
  "https://api-futures.kucoin.com/api/v1/bullet-public";
const REQUERY_INTERVAL_MS = Number(process.env.REQUERY_INTERVAL_MS) || 30_000;
const INSTANCE_ID = process.env.K_REVISION || crypto.randomUUID();

// In-memory state for fast lookups
const openPositionsBySymbol = new Map<string, OpenPosition[]>();
const tradeTriggersBySymbol = new Map<string, TradeTrigger[]>();

let sessionActive = false;
let requeryInterval: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// ====== Logging ======
const log = (...args: any[]) => console.log(`🟢 [${INSTANCE_ID}]`, ...args);
const info = (...args: any[]) => console.info(`🔵 [${INSTANCE_ID}]`, ...args);
const warn = (...args: any[]) => console.warn(`🟡 [${INSTANCE_ID}]`, ...args);
const error = (...args: any[]) => console.error(`🔴 [${INSTANCE_ID}]`, ...args);

// ---------- WebSocketManager class with robust heartbeat and reconnect logic ----------
class WebSocketManager {
  private ws: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  public reconnecting = false;
  private desired = new Set<string>();
  private subscribed = new Set<string>();
  private cachedToken: any = null;
  private lastTokenTime = 0;
  private lastPong = 0;
  private heartbeatStarted = false;
  private pingIntervalMs = 20000;
  private reconnectBackoffMs = 1000;

  constructor(
    private name: "SPOT" | "FUTURES",
    private endpoint: string,
    private topicFn: (s: string) => string
  ) {}

  private async getTokenWithRetry(maxRetries = 3): Promise<any> {
    const now = Date.now();
    if (this.cachedToken && now - this.lastTokenTime < 50 * 60 * 1000) {
      info(`[${this.name}] using cached token`);
      return this.cachedToken;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(this.endpoint, { method: 'POST', signal: (controller as any).signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as any;
        if (data.code !== '200000') throw new Error(`Invalid response code: ${data.code}`);
        this.cachedToken = data.data;
        this.lastTokenTime = now;
        this.reconnectBackoffMs = 1000;
        info(`[${this.name}] ✅ token fetched (attempt ${attempt})`);
        return data.data;
      } catch (e: any) {
        warn(`[${this.name}] token fetch attempt ${attempt} failed: ${e.message || e}`);
        if (attempt === maxRetries) throw e;
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }

  public async ensureConnected() {
    if (this.reconnecting) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.desired.size === 0) return this.disconnect();

    this.reconnecting = true;
    this.stopHeartbeat();
    try {
      await this.fullCleanup("pre-connect");
      await new Promise(r => setTimeout(r, 100));

      const token = await this.getTokenWithRetry();
      const server = token.instanceServers[0];
      const wsUrl = `${server.endpoint}?token=${token.token}`;
      this.pingIntervalMs = server.pingInterval || 20000;

      info(`[${this.name}] connecting to ${wsUrl}`);
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.once("open", () => {
        info(`[${this.name}] ✅ WebSocket open`);
        this.lastPong = Date.now();
        this.reconnecting = false;
        setTimeout(() => this.resubscribeAll(), 200);
      });

      socket.on("message", (d) => this.onMessage(d));

      socket.once("close", (code, reason) => {
        warn(`[${this.name}] closed (${code}) ${reason.toString()}`);
        this.reconnecting = false;
        this.scheduleReconnect();
      });

      socket.once("error", (e) => {
        error(`[${this.name}] socket error: ${e.message}`);
        this.reconnecting = false;
        this.scheduleReconnect();
      });
    } catch (e: any) {
      error(`[${this.name}] connection failure: ${e.message || e}`);
      this.reconnecting = false;
      this.scheduleReconnect();
    }
  }

  private onMessage(data: WebSocket.Data) {
    this.lastPong = Date.now();
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === "welcome" && !this.heartbeatStarted) {
        info(`[${this.name}] Welcome message received. Starting heartbeat.`);
        this.startHeartbeat(this.pingIntervalMs);
        this.heartbeatStarted = true;
      }
      
      if (msg.type === "ping" && msg.id) {
        this.ws?.send(JSON.stringify({ id: msg.id, type: "pong" }));
        return;
      }
      
      if (msg.type === "pong") {
        return;
      }

      if (msg.topic && msg.data) {
        const sym = this.name === "SPOT" 
          ? msg.topic.replace('/market/snapshot:', '') 
          : msg.topic.replace("/contractMarket/tickerV2:", "");
        const price = this.name === "SPOT" 
          ? parseFloat(msg.data?.data?.lastTradedPrice) 
          : parseFloat(msg.data?.markPrice);
        if (sym && !Number.isNaN(price)) {
            processPriceUpdate(sym, price).catch(e => error(`Error processing price update for ${sym}`, e));
        }
      }
    } catch (err: any) {
      warn(`[${this.name}] JSON parse error: ${err.message}`);
    }
  }

  private startHeartbeat(interval: number) {
    this.stopHeartbeat();
    info(`[${this.name}] Starting heartbeat every ${interval / 1000}s`);
    this.heartbeatTimer = setInterval(() => {
      const ws = this.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const now = Date.now();
      if (now - this.lastPong > this.pingIntervalMs * 2.5) {
        warn(`[${this.name}] No activity in ${(now - this.lastPong) / 1000}s — reconnecting`);
        this.forceReconnect().catch(e => warn(`[${this.name}] Heartbeat reconnect error: ${e.message}`));
        return;
      }

      try {
        ws.send(JSON.stringify({ id: String(now), type: "ping" }));
      } catch (err: any) {
        warn(`[${this.name}] Heartbeat send error: ${err.message}`);
      }
    }, interval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async scheduleReconnect() {
    if (this.reconnecting) return;
    this.reconnecting = true;

    try {
        await this.fullCleanup("scheduleReconnect-backoff");
        if (this.cachedToken) this.reconnectBackoffMs = 1000;
        const wait = this.reconnectBackoffMs + Math.floor(Math.random() * 500);
        warn(`[${this.name}] reconnect backoff ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
        this.reconnectBackoffMs = Math.min(30000, this.reconnectBackoffMs * 1.5);
        await this.ensureConnected();
    } finally {
        this.reconnecting = false;
    }
  }

  private async fullCleanup(context: string) {
    info(`[${this.name}] cleaning up (${context})`);
    this.stopHeartbeat();
    this.heartbeatStarted = false;
    this.lastPong = 0;

    const oldWs = this.ws;
    this.ws = null;
    if (oldWs) {
        if (oldWs.readyState === WebSocket.OPEN) {
            this.subscribed.forEach(topic => {
                try {
                    oldWs.send(JSON.stringify({ id: Date.now(), type: "unsubscribe", topic }));
                } catch {}
            });
        }
        this.subscribed.clear();
        try {
            oldWs.removeAllListeners();
            if (oldWs.readyState !== WebSocket.CLOSED) oldWs.terminate();
        } catch {}
    }
  }

  public async forceReconnect() {
    warn(`[${this.name}] Forcing full reconnect...`);
    await this.scheduleReconnect();
  }

  public disconnect() {
    this.fullCleanup("manual-disconnect").catch(e => warn(`[${this.name}] manual cleanup err ${e}`));
  }

  updateDesired(set: Set<string>) {
    this.desired = set;
    if (this.desired.size === 0) return this.disconnect();
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) this.ensureConnected().catch(e => warn(`[${this.name}] ensureConnected failed: ${e.message}`));
    else this.resubscribeAll();
  }

  private resubscribeAll() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    info(`[${this.name}] Subscribing to ${this.desired.size} topics`);
    this.subscribed.clear();
    for (const sym of this.desired) {
      try {
        const topic = this.topicFn(sym);
        this.ws.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic, privateChannel: false, response: true }));
        this.subscribed.add(topic);
      } catch (err: any) {
        warn(`[${this.name}] subscribe fail ${sym}: ${err.message}`);
      }
    }
  }

  public info() {
    const now = Date.now();
    return {
      name: this.name,
      connected: !!this.ws && this.ws.readyState === WebSocket.OPEN,
      desired: this.desired.size,
      subscribed: Array.from(this.subscribed),
      lastPongAge: this.lastPong ? Math.round((now - this.lastPong)/1000) : -1,
      pingIntervalMs: this.pingIntervalMs,
      reconnecting: this.reconnecting,
      heartbeatStarted: this.heartbeatStarted
    };
  }
}


// ====== Instances ======
const spot = new WebSocketManager("SPOT", KUCOIN_SPOT_TOKEN_ENDPOINT, (s) => `/market/snapshot:${s}`);
const futures = new WebSocketManager("FUTURES", KUCOIN_FUTURES_TOKEN_ENDPOINT, (s) => `/contractMarket/tickerV2:${s}`);

// ====== Firestore Collection Management ======
async function collectAllSymbols() {
  try {
    const spotSymbolsToWatch = new Set<string>();
    const futuresSymbolsToWatch = new Set<string>();

    openPositionsBySymbol.clear();
    tradeTriggersBySymbol.clear();

    const posSnap = await db.collectionGroup("openPositions").where('details.status', '==', 'open').get();
    posSnap.forEach((d) => {
      const p = d.data() as Omit<OpenPosition, 'userId'>;
      const userId = d.ref.parent.parent?.parent.id;
      if (userId) {
        const positionWithUser = { ...p, id: d.id, userId };
        if (!openPositionsBySymbol.has(p.symbol)) {
          openPositionsBySymbol.set(p.symbol, []);
        }
        openPositionsBySymbol.get(p.symbol)!.push(positionWithUser);
        if (p.positionType === "spot") spotSymbolsToWatch.add(p.symbol);
        else futuresSymbolsToWatch.add(p.symbol);
      }
    });

    const trigSnap = await db.collectionGroup("tradeTriggers").where("details.status", "==", "active").get();
    trigSnap.forEach((d) => {
      const t = d.data() as Omit<TradeTrigger, 'userId'>;
      const userId = d.ref.parent.parent?.parent.id;
      if(userId) {
        const triggerWithUser = { ...t, id: d.id, userId };
        if (!tradeTriggersBySymbol.has(t.symbol)) {
          tradeTriggersBySymbol.set(t.symbol, []);
        }
        tradeTriggersBySymbol.get(t.symbol)!.push(triggerWithUser);
        if (t.type === "spot") spotSymbolsToWatch.add(t.symbol);
        else futuresSymbolsToWatch.add(t.symbol);
      }
    });

    spot.updateDesired(spotSymbolsToWatch);
    futures.updateDesired(futuresSymbolsToWatch);
    log(`📊 Analyzing ${posSnap.size} open positions & ${trigSnap.size} triggers across ${spotSymbolsToWatch.size} spot and ${futuresSymbolsToWatch.size} futures symbols.`);

  } catch (e: any) {
    error(`collectAllSymbols error: ${e.message || e}`);
  }
}

// ====== Price Update Logic ======
async function processPriceUpdate(symbol: string, price: number) {
  if (!symbol || !price) return;

  const positions = openPositionsBySymbol.get(symbol) || [];
  for (const pos of positions) {
    const isLong = pos.side === 'long' || pos.side === 'buy';
    const slHit = pos.details?.stopLoss && (isLong ? price <= pos.details.stopLoss : price >= pos.details.stopLoss);
    const tpHit = pos.details?.takeProfit && (isLong ? price >= pos.details.takeProfit : price <= pos.details.takeProfit);

    if (slHit || tpHit) {
      try {
        const posRef = db.collection('users').doc(pos.userId).collection('paperTradingContext').doc('main').collection('openPositions').doc(pos.id);
        await db.runTransaction(async (tx) => {
          const freshDoc = await tx.get(posRef);
          if (freshDoc.exists && freshDoc.data()?.details?.status === 'open') {
            log(`📉 Position trigger fired for ${symbol} for user ${pos.userId}`);
            tx.update(posRef, { 'details.status': 'closing', 'details.closePrice': price });
          }
        });
      } catch(e: any) {
        error(`Failed SL/TP transaction for pos ${pos.id}: ${e.message}`);
      }
    }
  }

  const triggers = tradeTriggersBySymbol.get(symbol) || [];
  for (const trigger of triggers) {
    const conditionMet = (trigger.condition === "above" && price >= trigger.targetPrice) || (trigger.condition === "below" && price <= trigger.targetPrice);
    if (conditionMet) {
      try {
        const userContextRef = db.collection('users').doc(trigger.userId).collection('paperTradingContext').doc('main');
        const triggerRef = userContextRef.collection('tradeTriggers').doc(trigger.id);
        
        await db.runTransaction(async (tx) => {
          const freshTrigger = await tx.get(triggerRef);
          if (!freshTrigger.exists) return; // Already processed

          log(`🎯 Firing trigger ${trigger.id} @ ${price} for user ${trigger.userId}`);
          const executedTriggerRef = userContextRef.collection("executedTriggers").doc(trigger.id);
          tx.set(executedTriggerRef, { ...trigger, currentPrice: price });
          tx.delete(triggerRef);
        });
      } catch(e: any) {
        error(`Failed trigger transaction for ${trigger.id}: ${e.message}`);
      }
    }
  }
}

// ====== Main Worker ======
async function startSession() {
  if (sessionActive) return;
  sessionActive = true;
  log("🚀 Worker started");
  await collectAllSymbols();

  heartbeatInterval = setInterval(() => {
    const s = spot.info();
    const f = futures.info();
    
    if (spot.reconnecting || futures.reconnecting) {
        warn(`💓 heartbeat detected reconnecting state, verifying health...`);
    }

    const spotIsHealthy = s.connected && (s.lastPongAge < 90 && s.lastPongAge !== -1);
    const futuresIsHealthy = f.connected && (f.lastPongAge < 90 && f.lastPongAge !== -1);
  
    log(`💓 heartbeat — SPOT=${spotIsHealthy} FUT=${futuresIsHealthy}`);
  
    if (s.desired > 0 && !spotIsHealthy) {
        warn(`💀 SPOT connection is unhealthy — forcing reconnect.`);
        spot.forceReconnect().catch(e => warn(`[SPOT] Heartbeat reconnect error: ${e.message}`));
    }
    
    if (f.desired > 0 && !futuresIsHealthy) {
        warn(`💀 FUTURES connection is unhealthy — forcing reconnect.`);
        futures.forceReconnect().catch(e => warn(`[FUTURES] Heartbeat reconnect error: ${e.message}`));
    }
  }, 30000);

  requeryInterval = setInterval(() => collectAllSymbols(), REQUERY_INTERVAL_MS);
}

// ====== HTTP Server ======
const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  if (req.url === "/debug") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ spot: spot.info(), futures: futures.info() }, null, 2));
    return;
  }
  res.writeHead(200);
  res.end("paper trading worker\n");
});

const PORT = Number(process.env.PORT) || 8080;
server.listen(PORT, () => {
  log(`Listening on ${PORT}`);
  startSession().catch((e) => error(`startSession: ${e.message || e}`));
});

// ====== Graceful Shutdown ======
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  warn("🛑 shutdown");
  sessionActive = false;
  if (requeryInterval) clearInterval(requeryInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  spot.disconnect();
  futures.disconnect();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

    