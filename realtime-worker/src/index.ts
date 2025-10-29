
import * as admin from 'firebase-admin';
import WebSocket from 'ws';
import http from 'http';
import crypto from 'crypto';
import fetch, { AbortError } from 'node-fetch';


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
const SESSION_MS = Number(process.env.SESSION_MS) || 480_000;
const REQUERY_INTERVAL_MS = Number(process.env.REQUERY_INTERVAL_MS) || 30_000;
const INSTANCE_ID = process.env.K_REVISION || crypto.randomUUID();

const closingPositions = new Set<string>();
let sessionActive = false;
let requeryInterval: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// ====== Logging ======
const log = (...args: any[]) => console.log(`🟢 [${INSTANCE_ID}]`, ...args);
const info = (...args: any[]) => console.info(`🔵 [${INSTANCE_ID}]`, ...args);
const warn = (...args: any[]) => console.warn(`🟡 [${INSTANCE_ID}]`, ...args);
const error = (...args: any[]) => console.error(`🔴 [${INSTANCE_ID}]`, ...args);

class WebSocketManager {
  private ws: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  public reconnecting = false;
  private desired = new Set<string>();
  private cachedToken: any = null;
  private lastTokenTime = 0;
  private lastPing = 0;
  private lastPong = 0;
  private pongReceived = false;
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
        const res = await fetch(this.endpoint, { method: 'POST', timeout: 15000 });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as any;
        if (data.code !== '200000') throw new Error(`Invalid response code: ${data.code}`);
        this.cachedToken = data.data;
        this.lastTokenTime = now;
        this.reconnectBackoffMs = 1000; // reset backoff on success
        info(`[${this.name}] ✅ token fetched`);
        return data.data;
      } catch (e: any) {
        warn(`[${this.name}] token fetch attempt ${attempt} failed: ${e.message || e}`);
        if (attempt === maxRetries) throw new Error(`Failed to fetch token after ${maxRetries} attempts.`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }

  public async ensureConnected() {
    if (this.reconnecting) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.desired.size === 0) {
      this.disconnect();
      return;
    }

    this.reconnecting = true;
    this.stopHeartbeat();

    try {
      await this.fullCleanup("pre-connect");
      await new Promise(r => setTimeout(r, 100)); // Short jitter

      const token = await this.getTokenWithRetry();
      const server = token.instanceServers[0];
      const wsUrl = `${server.endpoint}?token=${token.token}`;
      this.pingIntervalMs = server.pingInterval || 20000;
      info(`[${this.name}] connecting to ${wsUrl}`);

      const socket = new WebSocket(wsUrl, { handshakeTimeout: 15000 });
      this.ws = socket;

      socket.once("open", () => {
        info(`[${this.name}] ✅ WebSocket open`);
        const now = Date.now();
        this.lastPing = now;
        this.lastPong = now;
        this.pongReceived = true;
        this.reconnecting = false; // Release the lock
        this.reconnectBackoffMs = 1000; // Reset backoff on successful connection
        this.startHeartbeat(this.pingIntervalMs);
        setTimeout(() => this.resubscribeAll(), 200);
      });

      socket.on("message", (d) => this.onMessage(d));
      socket.on("ping", (data) => { this.lastPong = Date.now(); this.pongReceived = true; try { socket.pong(data); } catch (e) {} });
      socket.on("pong", () => { this.lastPong = Date.now(); this.pongReceived = true; });

      const handleCloseOrError = (code?: number, reason?: Buffer) => {
        if(code !== 1000) this.scheduleReconnectWithBackoff();
      };
      
      socket.once("close", (code, reason) => {
          warn(`[${this.name}] closed (${code}) ${reason.toString()}`);
          this.reconnecting = false; // Ensure flag is cleared on close
          this.fullCleanup(`closed-${code}`).catch(() => {});
          if (code !== 1000) {
              this.scheduleReconnectWithBackoff();
          }
      });
      socket.once("error", (e) => {
          error(`[${this.name}] socket error: ${e.message}`);
          this.reconnecting = false; // Ensure flag is cleared on error
          this.scheduleReconnectWithBackoff();
      });

    } catch (e: any) {
      error(`[${this.name}] connection failure: ${e.message || e}`);
      this.scheduleReconnectWithBackoff();
    } finally {
        // This is a safety net. The flag should be cleared in open/close/error handlers.
      if (this.reconnecting && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
        setTimeout(() => {
          if (this.reconnecting) this.reconnecting = false;
        }, 5000); // Failsafe timeout
      }
    }
  }

  private onMessage(data: WebSocket.Data) {
    this.pongReceived = true;
    this.lastPong = Date.now();
    const messageText = data.toString();

    try {
      const msg = JSON.parse(messageText);
      if (msg.type === "pong") return;
      if (msg.type === "ping" && msg.id) {
        try { this.ws?.send(JSON.stringify({ id: msg.id, type: "pong" })); } catch(e:any) { warn(`[${this.name}] Failed to send JSON pong: ${e.message}`); }
        return;
      }
      if (msg.type === "bye") {
        warn(`[${this.name}] Server sent BYE — reconnecting after short delay.`);
        setTimeout(() => this.scheduleReconnectWithBackoff(), 3000 + Math.random() * 2000);
        return;
      }
      if (msg.topic && msg.data) {
        const sym = this.name === "SPOT" ? msg.topic.split(":")[1] : msg.topic.replace("/contractMarket/snapshot:", "");
        const price = this.name === "SPOT" ? parseFloat(msg.data?.data?.lastTradedPrice) : parseFloat(msg.data?.markPrice);
        if (sym && !Number.isNaN(price)) processPriceUpdate(sym, price);
      }
    } catch (err: any) {
      warn(`[${this.name}] JSON parse error: ${err.message || err}. Raw: "${messageText.slice(0,200)}"`);
    }
  }

  private startHeartbeat(interval: number) {
    this.stopHeartbeat();
    info(`[${this.name}] Starting heartbeat every ${Math.round(interval/1000)}s`);
    this.heartbeatTimer = setInterval(() => {
      if (this.reconnecting) {
        info(`[${this.name}] heartbeat paused while reconnecting`);
        return;
      }
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        warn(`[${this.name}] Heartbeat: WS not open. Forcing reconnect.`);
        this.forceReconnect();
        return;
      }

      const now = Date.now();
      if (this.lastPing > 0 && !this.pongReceived && (now - this.lastPing) > Math.max(36000, this.pingIntervalMs * 1.8)) {
        warn(`[${this.name}] No pong received in > ${(now - this.lastPing)/1000}s — forcing reconnect`);
        this.forceReconnect();
        return;
      }

      try {
        this.pongReceived = false;
        this.lastPing = Date.now();
        this.ws.send(JSON.stringify({ id: String(this.lastPing), type: "ping" }));
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

  private async scheduleReconnectWithBackoff() {
    if (this.reconnecting) return;
    if (this.cachedToken) {
        this.reconnectBackoffMs = 1000; // Reset backoff if we have a token
    }
    
    this.reconnecting = true;
    try {
      await this.fullCleanup("scheduleReconnect-backoff");
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
    this.pongReceived = false;
    this.lastPing = 0;
    this.lastPong = 0;
    if (this.ws) {
      const oldWs = this.ws;
      this.ws = null;
      try {
        oldWs.removeAllListeners();
        if (oldWs.readyState === WebSocket.OPEN) {
          oldWs.close(1000);
          await new Promise(r => setTimeout(r, 200));
        }
        if (oldWs.readyState !== WebSocket.CLOSED) oldWs.terminate();
      } catch (err: any) {
        warn(`[${this.name}] cleanup error: ${err.message || err}`);
      }
    }
  }

  public async forceReconnect() {
    warn(`[${this.name}] Forcing full reconnect...`);
    await this.scheduleReconnectWithBackoff();
  }

  public disconnect() {
    this.fullCleanup("manual-disconnect").catch((e)=>warn(`[${this.name}] manual cleanup err ${e}`));
  }

  updateDesired(set: Set<string>) {
    this.desired = set;
    if (this.desired.size === 0) {
      this.disconnect();
      return;
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.ensureConnected().catch((e) => warn(`[${this.name}] ensureConnected failed: ${e?.message||e}`));
    } else {
      this.resubscribeAll();
    }
  }

  private resubscribeAll() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    info(`[${this.name}] Subscribing to ${this.desired.size} topics`);
    for (const sym of this.desired) {
      try {
        const topic = this.topicFn(sym);
        this.ws.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic, privateChannel: false, response: true }));
      } catch (err: any) {
        warn(`[${this.name}] subscribe fail ${sym}: ${err.message || err}`);
      }
    }
  }

  public info() {
    return {
      name: this.name,
      connected: !!this.ws && this.ws.readyState === WebSocket.OPEN,
      desired: this.desired.size,
      lastPingAge: this.lastPing ? Math.round((Date.now() - this.lastPing) / 1000) : -1,
      lastPongAge: this.lastPong ? Math.round((Date.now() - this.lastPong) / 1000) : -1,
      pingIntervalMs: this.pingIntervalMs,
      reconnecting: this.reconnecting,
      pongReceived: this.pongReceived,
    };
  }
}


// ====== Instances ======
const spot = new WebSocketManager("SPOT", KUCOIN_SPOT_TOKEN_ENDPOINT, (s) => `/market/snapshot:${s}`);
const futures = new WebSocketManager("FUTURES", KUCOIN_FUTURES_TOKEN_ENDPOINT, (s) => `/contractMarket/snapshot:${s}`);

// ====== Firestore Collection Management ======
async function collectAllSymbols() {
  try {
    const spotSet = new Set<string>();
    const futSet = new Set<string>();

    const posSnap = await db.collectionGroup("openPositions").get();
    posSnap.forEach((d) => {
      const p = d.data() as OpenPosition;
      if (p.details?.status === 'open') {
        if (p.positionType === "spot") spotSet.add(p.symbol);
        else futSet.add(p.symbol);
      }
    });

    const trigSnap = await db.collectionGroup("tradeTriggers").get();
    trigSnap.forEach((d) => {
        const t = d.data() as TradeTrigger;
        if (t.details.status === 'active') {
          if (t.type === "spot") spotSet.add(t.symbol);
          else futSet.add(t.symbol);
        }
    });

    spot.updateDesired(spotSet);
    futures.updateDesired(futSet);
    log(`Symbols updated: ${spotSet.size} spot, ${futSet.size} fut`);
    log(`📊 Analyzing ${posSnap.size} open positions & ${trigSnap.size} triggers`);
  } catch (e: any) {
    error(`collectAllSymbols error: ${e.message || e}`);
  }
}

// ====== Price Update Logic ======
async function processPriceUpdate(symbol: string, price: number) {
  if (!symbol || !price) return;
  // --- Block 1: Handle SL/TP on Open Positions ---
  try {
    const positionsQuery = db.collectionGroup('openPositions').where('symbol', '==', symbol).where('details.status', '==', 'open');
    const positionsSnapshot = await positionsQuery.get();
    if (!positionsSnapshot.empty) {
      for (const doc of positionsSnapshot.docs) {
        const pos = doc.data() as OpenPosition;

        if (!pos.details?.stopLoss && !pos.details?.takeProfit) continue;

        const isLong = pos.side === 'long' || pos.side === 'buy';
        const slHit = pos.details?.stopLoss && (isLong ? price <= pos.details.stopLoss : price >= pos.details.stopLoss);
        const tpHit = pos.details?.takeProfit && (isLong ? price >= pos.details.takeProfit : price <= pos.details.takeProfit);

        if ((slHit || tpHit) && !closingPositions.has(doc.id)) {
          closingPositions.add(doc.id);
          try {
            await db.runTransaction(async (tx) => {
              const freshDoc = await tx.get(doc.ref);
              if (freshDoc.data()?.details?.status !== 'open') return;
              log(`📉 Position trigger fired for ${symbol} at ${price}`);
              tx.update(doc.ref, {
                'details.status': 'closing',
                'details.closePrice': price,
              });
            });
          } catch (e) {
            error(`Transaction to close position ${doc.id} failed:`, e);
          } finally {
            closingPositions.delete(doc.id);
          }
        }
      }
    }
  } catch (e: any) {
    error(`processPriceUpdate openPositions error for ${symbol}:`, e);
  }

  // --- Block 2: Handle Trade Trigger Executions ---
  try {
    const triggersQuery = db
      .collectionGroup("tradeTriggers")
      .where("symbol", "==", symbol)
      .where("details.status", "==", "active");
    const triggersSnapshot = await triggersQuery.get();

    if (!triggersSnapshot.empty) {
      for (const doc of triggersSnapshot.docs) {
        const trigger = doc.data() as TradeTrigger;
        const conditionMet =
          (trigger.condition === "above" && price >= trigger.targetPrice) ||
          (trigger.condition === "below" && price <= trigger.targetPrice);

        if (conditionMet) {
          try {
            await db.runTransaction(async (tx) => {
              const userContextRef = doc.ref.parent.parent;
              if (!userContextRef) return;

              const freshDoc = await tx.get(doc.ref);
              if (!freshDoc.exists) return;

              log(`🎯 Firing trigger ${doc.id} @ ${price}`);
              const executedTriggerRef = userContextRef
                .collection("executedTriggers")
                .doc(doc.id);
              tx.set(executedTriggerRef, { ...trigger, currentPrice: price });
              tx.delete(doc.ref);
            });
          } catch (e: any) {
            error(`Transaction for trigger ${doc.id} failed:`, e);
          }
        }
      }
    }
  } catch (e: any) {
    error(`processPriceUpdate triggers error for ${symbol}:`, e);
  }
}

// ====== Main Worker ======
async function startSession() {
  if (sessionActive) return;
  sessionActive = true;
  log("🚀 Worker started");
  await collectAllSymbols();

  heartbeatInterval = setInterval(async () => {
    const s = spot.info();
    const f = futures.info();
  
    const spotIsHealthy = s.connected && s.pongReceived;
    const futuresIsHealthy = f.connected && f.pongReceived;
  
    log(`💓 heartbeat — SPOT=${spotIsHealthy} FUT=${futuresIsHealthy}`);
  
    if (s.desired > 0 && !spotIsHealthy) {
        if (!spot.reconnecting) {
            warn(`💀 SPOT connection is unhealthy — forcing reconnect.`);
            await spot.forceReconnect();
        } else {
            warn(`💓 heartbeat detected SPOT reconnecting...`);
        }
    }
    
    if (f.desired > 0 && !futuresIsHealthy) {
        if (!futures.reconnecting) {
            warn(`💀 FUTURES connection is unhealthy — forcing reconnect.`);
            await futures.forceReconnect();
        } else {
            warn(`💓 heartbeat detected FUTURES reconnecting...`);
        }
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

    