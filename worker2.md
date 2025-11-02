
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
  userId?: string; // filled when loaded into memory
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
  userId?: string; // filled when loaded into memory
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

// In-memory state (single source-of-truth for fast tick handling)
const openPositionsBySymbol = new Map<string, OpenPosition[]>();
const tradeTriggersBySymbol = new Map<string, TradeTrigger[]>();
const closingPositions = new Set<string>();

let sessionActive = false;
let requeryInterval: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// ====== Logging ======
const log = (...args: any[]) => console.log(`🟢 [${INSTANCE_ID}]`, ...args);
const info = (...args: any[]) => console.info(`🔵 [${INSTANCE_ID}]`, ...args);
const warn = (...args: any[]) => console.warn(`🟡 [${INSTANCE_ID}]`, ...args);
const error = (...args: any[]) => console.error(`🔴 [${INSTANCE_ID}]`, ...args);

// ---------- WebSocketManager (keeps shape you insisted on) ----------
class WebSocketManager {
  private ws: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  public reconnecting = false;
  private desired = new Set<string>();
  private subscribed = new Set<string>(); // stores topic strings
  private cachedToken: any = null;
  private lastTokenTime = 0;
  private lastPing = 0;
  private lastPong = 0;
  private heartbeatStarted = false;
  private pingIntervalMs = 20000;
  private reconnectBackoffMs = 1000;

  constructor(
    private name: 'SPOT' | 'FUTURES',
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
      await this.fullCleanup('pre-connect');
      await new Promise(r => setTimeout(r, 100));
      const token = await this.getTokenWithRetry();
      const server = token.instanceServers[0];
      const wsUrl = `${server.endpoint}?token=${token.token}`;
      this.pingIntervalMs = server.pingInterval || 20000;
      info(`[${this.name}] connecting to ${wsUrl}`);
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.once('open', () => {
        info(`[${this.name}] ✅ WebSocket open`);
        this.lastPong = Date.now();
        this.reconnecting = false;
        // resubscribe diff will run shortly after welcome/heartbeat begins
        setTimeout(() => this.resubscribeDiff(), 200);
      });

      socket.on('message', (d) => this.onMessage(d));

      socket.once('close', (code, reason) => {
        warn(`[${this.name}] closed (${code}) ${reason.toString()}`);
        this.reconnecting = false;
        this.scheduleReconnect();
      });

      socket.once('error', (e) => {
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
      if (msg.type === 'welcome' && !this.heartbeatStarted) {
        info(`[${this.name}] Welcome message received. Starting heartbeat.`);
        this.startHeartbeat(this.pingIntervalMs);
        this.heartbeatStarted = true;
      }

      if (msg.type === 'ping' && msg.id) {
        this.ws?.send(JSON.stringify({ id: msg.id, type: 'pong' }));
        return;
      }

      if (msg.type === 'pong') {
        return;
      }

      if (msg.topic && msg.data) {
        const sym = this.name === 'SPOT' ? msg.topic.split(':')[1] : msg.topic.replace('/contractMarket/snapshot:', '');
        const price = this.name === 'SPOT' ? parseFloat(msg.data?.data?.lastTradedPrice) : parseFloat(msg.data?.markPrice);
        if (sym && !Number.isNaN(price)) {
          // Keep price tick handling lightweight — do not query firestore here
          processPriceUpdate(sym, price).catch(err => error(`processPriceUpdate err: ${err}`));
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
        ws.send(JSON.stringify({ id: String(now), type: 'ping' }));
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
      await this.fullCleanup('scheduleReconnect-backoff');
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
    this.lastPing = 0;
    const oldWs = this.ws;
    this.ws = null;
    if (oldWs) {
      if (oldWs.readyState === WebSocket.OPEN) {
        // politely unsubscribe from topics we thought we were subscribed to
        this.subscribed.forEach(topic => {
          try { oldWs.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic })); } catch {}
        });
      }
      this.subscribed.clear();
      try { oldWs.removeAllListeners(); if (oldWs.readyState !== WebSocket.CLOSED) oldWs.terminate(); } catch {}
    }
  }

  public async forceReconnect() {
    warn(`[${this.name}] Forcing full reconnect...`);
    await this.scheduleReconnect();
  }

  public disconnect() {
    this.fullCleanup('manual-disconnect').catch(e => warn(`[${this.name}] manual cleanup err ${e}`));
  }

  updateDesired(set: Set<string>) {
    this.desired = set;
    if (this.desired.size === 0) return this.disconnect();
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) this.ensureConnected().catch(e => warn(`[${this.name}] ensureConnected failed: ${e.message}`));
    else this.resubscribeDiff();
  }

  // Send only the diff: subscribe new topics, unsubscribe removed topics
  private resubscribeDiff() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const toSubscribe = new Set<string>();
    const toUnsubscribe = new Set<string>();

    // compute topic strings for desired set
    const desiredTopics = new Set<string>();
    for (const sym of this.desired) desiredTopics.add(this.topicFn(sym));

    // what to unsubscribe
    for (const topic of this.subscribed) {
      if (!desiredTopics.has(topic)) toUnsubscribe.add(topic);
    }
    // what to subscribe
    for (const topic of desiredTopics) {
      if (!this.subscribed.has(topic)) toSubscribe.add(topic);
    }

    if (toUnsubscribe.size) info(`[${this.name}] Unsubscribing ${toUnsubscribe.size} topics`);
    for (const topic of toUnsubscribe) {
      try { this.ws.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic })); this.subscribed.delete(topic); } catch (err) { warn(`[${this.name}] unsubscribe ${topic} failed: ${err}`); }
    }

    if (toSubscribe.size) info(`[${this.name}] Subscribing to ${toSubscribe.size} topics`);
    for (const topic of toSubscribe) {
      try { this.ws.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic, privateChannel: false, response: true })); this.subscribed.add(topic); } catch (err) { warn(`[${this.name}] subscribe failed ${topic}: ${err}`); }
    }
  }

  private resubscribeAll() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    info(`[${this.name}] Subscribing to ${this.desired.size} topics (full)`);
    this.subscribed.clear();
    for (const sym of this.desired) {
      try {
        const topic = this.topicFn(sym);
        this.ws.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic, privateChannel: false, response: true }));
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
      lastPongAge: this.lastPong ? Math.round((now - this.lastPong) / 1000) : -1,
      pingIntervalMs: this.pingIntervalMs,
      reconnecting: this.reconnecting,
      heartbeatStarted: this.heartbeatStarted,
    };
  }
}

// ====== Instances ======
const spot = new WebSocketManager('SPOT', KUCOIN_SPOT_TOKEN_ENDPOINT, (s) => `/market/ticker:${s}`);
const futures = new WebSocketManager('FUTURES', KUCOIN_FUTURES_TOKEN_ENDPOINT, (s) => `/contractMarket/snapshot:${s}`);

// Helper: extract userId from document path (robust to path layout)
function extractUserIdFromPath(path: string): string | null {
  // expect path like: users/{uid}/paperTradingContext/main/openPositions/{posId}
  const parts = path.split('/');
  const usersIdx = parts.indexOf('users');
  if (usersIdx >= 0 && parts.length > usersIdx + 1) return parts[usersIdx + 1];
  return null;
}

// ====== Firestore Collection Management ======
async function collectAllSymbols() {
  try {
    openPositionsBySymbol.clear();
    tradeTriggersBySymbol.clear();
    const spotSymbols = new Set<string>();
    const futSymbols = new Set<string>();

    // Use collectionGroup queries (requires proper composite indexes) to fetch documents once
    const posSnap = await db.collectionGroup('openPositions').get();
    posSnap.forEach(d => {
      const p = d.data() as OpenPosition;
      if (p.details?.status !== 'open') return; // Filter in memory
      
      const userId = extractUserIdFromPath(d.ref.path);
      if (!userId) return;
      
      const pos: OpenPosition = { ...p, id: d.id, userId };
      const arr = openPositionsBySymbol.get(p.symbol) || [];
      arr.push(pos);
      openPositionsBySymbol.set(p.symbol, arr);
      if (p.positionType === 'spot') spotSymbols.add(p.symbol); else futSymbols.add(p.symbol);
    });

    const trigSnap = await db.collectionGroup('tradeTriggers').get();
    trigSnap.forEach(d => {
      const t = d.data() as TradeTrigger;
      if (t.details.status !== 'active') return; // Filter in memory

      const userId = extractUserIdFromPath(d.ref.path);
      if (!userId) return;

      const trig: TradeTrigger = { ...t, id: d.id, userId };
      const arr = tradeTriggersBySymbol.get(t.symbol) || [];
      arr.push(trig);
      tradeTriggersBySymbol.set(t.symbol, arr);
      if (t.type === 'spot') spotSymbols.add(t.symbol); else futSymbols.add(t.symbol);
    });

    // Update websocket subscriptions (diffing handled in manager)
    spot.updateDesired(spotSymbols);
    futures.updateDesired(futSymbols);

    let totalPositions = 0;
    openPositionsBySymbol.forEach(arr => totalPositions += arr.length);
    let totalTriggers = 0;
    tradeTriggersBySymbol.forEach(arr => totalTriggers += arr.length);

    log(`📊 Analyzing ${totalPositions} open positions & ${totalTriggers} triggers across ${spotSymbols.size} spot and ${futSymbols.size} futures symbols.`);
  } catch (e: any) {
    error(`collectAllSymbols error: ${e.message || e}`);
  }
}

// ====== Price Update Logic (NO Firestore queries here) ======
async function processPriceUpdate(symbol: string, price: number) {
  if (!symbol || !price) return;

  // Quick log for visibility when symbol ticks in
  // info(`🔔 tick ${symbol} @ ${price}`);

  // Handle SL/TP from in-memory cache
  const positions = openPositionsBySymbol.get(symbol) || [];
  if (positions.length) info(`🧠 analyzing ${positions.length} open position(s) for ${symbol}`);
  for (const pos of positions) {
    try {
      if (!pos.details) continue;
      const isLong = pos.side === 'long' || pos.side === 'buy';
      const slHit = pos.details.stopLoss !== undefined && (isLong ? price <= pos.details.stopLoss : price >= pos.details.stopLoss);
      const tpHit = pos.details.takeProfit !== undefined && (isLong ? price >= pos.details.takeProfit : price <= pos.details.takeProfit);
      if ((slHit || tpHit) && !closingPositions.has(pos.id)) {
        closingPositions.add(pos.id);
        const path = `users/${pos.userId}/paperTradingContext/main/openPositions/${pos.id}`;
        try {
          await db.runTransaction(async tx => {
            const posRef = db.doc(path);
            const fresh = await tx.get(posRef);
            if (!fresh.exists) return;
            if (fresh.data()?.details?.status !== 'open') return;
            log(`📉 Position trigger fired for ${symbol} (user=${pos.userId}, pos=${pos.id}) @ ${price}`);
            tx.update(posRef, { 'details.status': 'closing', 'details.closePrice': price });
          });
          // remove from cache to avoid reprocessing until next collectAllSymbols
          const list = openPositionsBySymbol.get(symbol) || [];
          openPositionsBySymbol.set(symbol, list.filter(p => p.id !== pos.id));
        } catch (txErr: any) {
          error(`Transaction to close position ${pos.id} failed: ${txErr.message || txErr}`);
        } finally {
          closingPositions.delete(pos.id);
        }
      }
    } catch (err: any) {
      error(`Error evaluating position ${pos.id} for ${symbol}: ${err.message || err}`);
    }
  }

  // Handle trade triggers from in-memory cache
  const triggers = tradeTriggersBySymbol.get(symbol) || [];
  if (triggers.length) info(`🧠 analyzing ${triggers.length} trigger(s) for ${symbol}`);
  for (const trig of triggers) {
    try {
      const conditionMet = (trig.condition === 'above' && price >= trig.targetPrice) || (trig.condition === 'below' && price <= trig.targetPrice);
      if (!conditionMet) continue;

      const userContextPath = `users/${trig.userId}/paperTradingContext/main`;
      const triggerPath = `${userContextPath}/tradeTriggers/${trig.id}`;

      await db.runTransaction(async tx => {
        const triggerRef = db.doc(triggerPath);
        const fresh = await tx.get(triggerRef);
        if (!fresh.exists) return;
        log(`🎯 Firing trigger ${trig.id} for user ${trig.userId} @ ${price}`);
        const executedRef = db.doc(`${userContextPath}/executedTriggers/${trig.id}`);
        tx.set(executedRef, { ...trig, currentPrice: price });
        tx.delete(triggerRef);
      });

      // remove from in-memory cache to avoid immediate re-fire
      const arr = tradeTriggersBySymbol.get(symbol) || [];
      tradeTriggersBySymbol.set(symbol, arr.filter(t => t.id !== trig.id));

    } catch (err: any) {
      error(`Failed trigger transaction for ${trig.id}: ${err.message || err}`);
    }
  }
}

// ====== Main Worker ======
async function startSession() {
  if (sessionActive) return;
  sessionActive = true;
  log('🚀 Worker started');

  // Initial load
  await collectAllSymbols();

  // Heartbeat & health checks
  heartbeatInterval = setInterval(() => {
    const s = spot.info();
    const f = futures.info();

    if (s.reconnecting || f.reconnecting) warn('💓 heartbeat detected reconnecting state, verifying health...');

    const spotHealthy = s.connected && s.lastPongAge < 90 && s.lastPongAge !== -1;
    const futHealthy = f.connected && f.lastPongAge < 90 && f.lastPongAge !== -1;

    log(`💓 heartbeat — SPOT=${spotHealthy} FUT=${futHealthy}`);

    if (s.desired > 0 && !spotHealthy) {
      warn('💀 SPOT connection is unhealthy — forcing reconnect.');
      spot.forceReconnect().catch(e => warn(`[SPOT] reconnect error: ${e.message}`));
    }
    if (f.desired > 0 && !futHealthy) {
      warn('💀 FUTURES connection is unhealthy — forcing reconnect.');
      futures.forceReconnect().catch(e => warn(`[FUTURES] reconnect error: ${e.message}`));
    }
  }, 30_000);

  // Periodically refresh symbol lists and in-memory caches
  requeryInterval = setInterval(() => collectAllSymbols(), REQUERY_INTERVAL_MS);
}

// ====== HTTP Server (health/debug) ======
const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  if (req.url === '/debug') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const positionsObj: Record<string, any> = {};
    openPositionsBySymbol.forEach((v, k) => positionsObj[k] = v.length);
    const triggersObj: Record<string, any> = {};
    tradeTriggersBySymbol.forEach((v, k) => triggersObj[k] = v.length);
    res.end(JSON.stringify({ spot: spot.info(), futures: futures.info(), positions: positionsObj, triggers: triggersObj }, null, 2));
    return;
  }
  res.writeHead(200);
  res.end('paper trading worker\n');
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
  warn('🛑 shutdown');
  sessionActive = false;
  if (requeryInterval) clearInterval(requeryInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  spot.disconnect();
  futures.disconnect();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

    