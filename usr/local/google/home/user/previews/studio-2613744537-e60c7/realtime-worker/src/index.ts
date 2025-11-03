
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
const MAX_SYMBOLS_PER_SOCKET = 250;
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
    private name: string, // Changed to string to allow names like 'SPOT_0'
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
    if (this.desired.size === 0) return this.disconnect('no desired symbols');
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
        let sym: string | undefined;
        let price: number | undefined;

        if (this.name.startsWith('SPOT')) {
            sym = msg.topic.split(':')[1];
            price = parseFloat(msg.data?.data?.lastTradedPrice);
        } else { // FUTURES
            sym = msg.topic.replace('/contractMarket/tickerV2:', '');
            price = parseFloat(msg.data?.price); // Correct path for tickerV2
        }
        
        if (sym && !Number.isNaN(price)) {
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

  public disconnect(reason: string) {
    this.fullCleanup(`manual-disconnect: ${reason}`).catch(e => warn(`[${this.name}] manual cleanup err ${e}`));
  }

  updateDesired(set: Set<string>) {
    this.desired = set;
    if (this.desired.size === 0) return this.disconnect('no desired symbols');
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) this.ensureConnected().catch(e => warn(`[${this.name}] ensureConnected failed: ${e.message}`));
    else this.resubscribeDiff();
  }

  private resubscribeDiff() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const toSubscribe = new Set<string>();
    const toUnsubscribe = new Set<string>();

    const desiredTopics = new Set<string>();
    for (const sym of this.desired) desiredTopics.add(this.topicFn(sym));

    for (const topic of this.subscribed) {
      if (!desiredTopics.has(topic)) toUnsubscribe.add(topic);
    }
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

  public info() {
    const now = Date.now();
    return {
      name: this.name,
      connected: !!this.ws && this.ws.readyState === WebSocket.OPEN,
      desired: this.desired.size,
      subscribed: this.subscribed.size,
      lastPongAge: this.lastPong ? Math.round((now - this.lastPong) / 1000) : -1,
      reconnecting: this.reconnecting,
    };
  }
}

// ====== Multi-Socket Scaling Logic ======
let spotManagers: WebSocketManager[] = [];
let futuresManagers: WebSocketManager[] = [];

const chunkArray = <T>(array: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

function updateSubscriptionManagers<T extends WebSocketManager>(
  managers: T[],
  symbols: string[],
  type: 'SPOT' | 'FUTURES',
  endpoint: string,
  topicFn: (s: string) => string
): T[] {
  const groups = chunkArray(symbols, MAX_SYMBOLS_PER_SOCKET);

  // Add or remove managers as needed
  while (managers.length < groups.length) {
    const index = managers.length;
    const manager = new WebSocketManager(`${type}_${index}`, endpoint, topicFn) as T;
    managers.push(manager);
    info(`[MANAGER_POOL] Created manager ${type}_${index}`);
  }
  while (managers.length > groups.length) {
    const manager = managers.pop();
    if (manager) {
      manager.disconnect('shrinking pool');
      info(`[MANAGER_POOL] Destroyed manager ${manager.info().name}`);
    }
  }

  // Assign symbol groups to each manager
  groups.forEach((group, i) => {
    managers[i].updateDesired(new Set(group));
  });

  return managers;
}


// Helper: extract userId from document path (robust to path layout)
function extractUserIdFromPath(path: string): string | null {
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

    const posSnap = await db.collectionGroup('openPositions').get();
    posSnap.forEach(d => {
      const p = d.data() as OpenPosition;
      if (p.details?.status !== 'open') return;
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
      if (t.details.status !== 'active') return;
      const userId = extractUserIdFromPath(d.ref.path);
      if (!userId) return;

      const trig: TradeTrigger = { ...t, id: d.id, userId };
      const arr = tradeTriggersBySymbol.get(t.symbol) || [];
      arr.push(trig);
      tradeTriggersBySymbol.set(t.symbol, arr);
      if (t.type === 'spot') spotSymbols.add(t.symbol); else futSymbols.add(t.symbol);
    });

    // Update the manager pools
    spotManagers = updateSubscriptionManagers(spotManagers, Array.from(spotSymbols), 'SPOT', KUCOIN_SPOT_TOKEN_ENDPOINT, (s) => `/market/snapshot:${s}`);
    futuresManagers = updateSubscriptionManagers(futuresManagers, Array.from(futSymbols), 'FUTURES', KUCOIN_FUTURES_TOKEN_ENDPOINT, (s) => `/contractMarket/tickerV2:${s}`);

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
  await collectAllSymbols();

  heartbeatInterval = setInterval(() => {
    let allHealthy = true;
    for (const manager of [...spotManagers, ...futuresManagers]) {
        const { connected, lastPongAge, desired } = manager.info();
        if (desired > 0 && (!connected || lastPongAge > 90)) {
            allHealthy = false;
            warn(`💀 Manager ${manager.info().name} connection is unhealthy — forcing reconnect.`);
            manager.forceReconnect().catch(e => warn(`[${manager.info().name}] Heartbeat reconnect error: ${e.message}`));
        }
    }
    log(`💓 heartbeat — all managers healthy: ${allHealthy}`);
  }, 30_000);

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
    const debugInfo = {
        spotManagers: spotManagers.map(m => m.info()),
        futuresManagers: futuresManagers.map(m => m.info()),
        positions: positionsObj,
        triggers: triggersObj,
    };
    res.end(JSON.stringify(debugInfo, null, 2));
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
  
  [...spotManagers, ...futuresManagers].forEach(manager => {
      manager.disconnect('shutdown');
  });

  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
