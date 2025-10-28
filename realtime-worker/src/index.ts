// index.ts (Cloud Run worker — drop-in)
import * as admin from 'firebase-admin';
import WebSocket from 'ws';
import http from 'http';
import crypto from 'crypto';

// If runtime provides global fetch (Node 18+), use it; otherwise fall back to node-fetch
let _fetch: typeof fetch;
try {
  // @ts-ignore
  _fetch = fetch;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _fetch = require('node-fetch'); // fallback for older node images
}

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
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}
const db = admin.firestore();

// ========== Constants ==========
const KUCOIN_SPOT_TOKEN_ENDPOINT = 'https://api.kucoin.com/api/v1/bullet-public';
const KUCOIN_FUTURES_TOKEN_ENDPOINT = 'https://api-futures.kucoin.com/api/v1/bullet-public';
const SESSION_MS = Number(process.env.SESSION_MS) || 480000; // 8 minutes
const REQUERY_INTERVAL_MS = Number(process.env.REQUERY_INTERVAL_MS) || 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = Number(process.env.MAX_RECONNECT_ATTEMPTS) || 8;
const INSTANCE_ID = process.env.K_REVISION || crypto.randomUUID();

// runtime state
let sessionActive = false;
let sessionTimeout: NodeJS.Timeout | null = null;
let requeryInterval: NodeJS.Timeout | null = null;
const closingPositions = new Set<string>();

// ========== Logging helpers ==========
const log = (...args: any[]) => console.log(`🟢 [${INSTANCE_ID}]`, ...args);
const info = (...args: any[]) => console.info(`🔵 [${INSTANCE_ID}]`, ...args);
const warn = (...args: any[]) => console.warn(`🟡 [${INSTANCE_ID}]`, ...args);
const error = (...args: any[]) => console.error(`🔴 [${INSTANCE_ID}]`, ...args);

// ========== WebSocketManager - long-lived connections, dynamic subs ==========
class WebSocketManager {
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  // desired set (what Firestore says we should be watching)
  private desiredSubscriptions = new Set<string>();
  // active set (what we believe the server has subscribed)
  private actualSubscriptions = new Set<string>();

  // token caching
  private cachedToken: any = null;
  private lastTokenTime = 0;

  // pong/watchdog
  private lastPong = Date.now();

  constructor(
    private name: 'SPOT' | 'FUTURES',
    private tokenEndpoint: string,
    private getTopic: (symbol: string) => string,
  ) {}

  // token fetch with caching + retry/backoff
  private async fetchToken(retries = 3) {
    const now = Date.now();
    if (this.cachedToken && now - this.lastTokenTime < 60_000) {
      info(`[${this.name}] 🔁 using cached token (age ${Math.floor((now - this.lastTokenTime)/1000)}s)`);
      return this.cachedToken;
    }

    let lastErr: any = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await _fetch(this.tokenEndpoint, { method: 'POST', signal: undefined as any });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data?.code !== '200000') throw new Error(`Unexpected token response code ${data?.code}`);
        this.cachedToken = data.data;
        this.lastTokenTime = Date.now();
        info(`[${this.name}] ✅ fetched token (attempt ${attempt})`);
        return this.cachedToken;
      } catch (e) {
        lastErr = e;
        warn(`[${this.name}] token fetch attempt ${attempt} failed: ${e instanceof Error ? e.message : e}`);
        const backoff = Math.min(5000 * attempt, 20000);
        await new Promise(r => setTimeout(r, backoff + Math.random() * 500));
      }
    }
    throw lastErr;
  }

  // establish websocket (only when needed)
  public async ensureConnected() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // already open
    }
    // If there are no desired subscriptions, don't connect
    if (this.desiredSubscriptions.size === 0) {
      info(`[${this.name}] No desired subscriptions — skipping connect.`);
      this.disconnect(); // ensure closed
      return;
    }

    try {
      const tokenData = await this.fetchToken(4);
      const wsUrl = `${tokenData.instanceServers[0].endpoint}?token=${tokenData.token}`;
      const pingInterval = tokenData.instanceServers[0].pingInterval || 20000;
      info(`[${this.name}] Connecting -> ${wsUrl}`);
      // build websocket
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        info(`[${this.name}] ✅ socket open`);
        this.lastPong = Date.now();
        // resubscribe to desired set
        this.resubscribeAll();
        // start ping/pong watchdog
        this.startPingLoop(pingInterval);
      });

      this.ws.on('message', (data) => this.onMessage(data));
      this.ws.on('close', (code, reason) => {
        warn(`[${this.name}] socket closed code=${code} reason=${reason?.toString() || 'none'}`);
        this.onSocketClose();
      });
      this.ws.on('error', (err) => {
        error(`[${this.name}] socket error:`, err?.message || err);
        // ensure close flow runs
        try { this.ws?.terminate(); } catch {}
      });
    } catch (e) {
      error(`[${this.name}] failed to connect:`, e instanceof Error ? e.message : e);
    }
  }

  // handle incoming messages (including pong)
  private onMessage(data: WebSocket.Data) {
    try {
      const raw = (typeof data === 'string') ? data : data.toString();
      const msg = JSON.parse(raw);
      if (msg.type === 'pong') {
        this.lastPong = Date.now();
        // small logging at debug level
        // info(`[${this.name}] ↩ pong`);
        return;
      }

      // KuCoin returns ping/pong and message objects; when message parse symbol and forward
      if (msg.type === 'message' && msg.topic) {
        // message topic shapes: '/market/snapshot:SYMBOL' or '/contractMarket/snapshot:SYMBOL'
        let symbol = '';
        if (this.name === 'SPOT') {
          symbol = msg.topic.includes(':') ? msg.topic.split(':')[1] : msg.topic;
        } else {
          symbol = msg.topic.replace('/contractMarket/snapshot:', '');
        }

        // extract price (guard)
        const price = this.name === 'SPOT'
          ? parseFloat(msg.data?.data?.lastTradedPrice)
          : parseFloat(msg.data?.markPrice);

        if (symbol && !Number.isNaN(price)) {
          // emit to global handler
          // log(`[${this.name}] 📈 ${symbol} => ${price}`);
          // Non-blocking; we intentionally don't await to keep throughput
          try { processPriceUpdate(symbol, price); } catch (e) { error(`[${this.name}] processPriceUpdate error:`, e); }
        }
      }
    } catch (e) {
      error(`[${this.name}] error parsing incoming WS message:`, e);
    }
  }

  // start ping watchdog that will detect silent dead connections
  private startPingLoop(intervalMs: number) {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (!this.ws) return;
      if (this.ws.readyState !== WebSocket.OPEN) return;
      // send ping
      try {
        this.ws.send(JSON.stringify({ id: Date.now(), type: 'ping' }));
      } catch (e) {
        warn(`[${this.name}] ping send failed:`, e);
      }
      // if no pong seen in 2 * interval => treat as dead and reconnect
      if (Date.now() - this.lastPong > Math.max(10000, intervalMs * 2)) {
        warn(`[${this.name}] missed pong for ${Date.now() - this.lastPong}ms — forcing reconnect`);
        this.forceReconnect('ping timeout');
      }
    }, Math.max(5000, Math.floor(intervalMs / 2)));
  }

  // subscribe/unsubscribe helpers (send only diffs)
  public updateDesiredSubscriptions(newSet: Set<string>) {
    // compute differences
    const toAdd = [...newSet].filter(s => !this.desiredSubscriptions.has(s));
    const toRemove = [...this.desiredSubscriptions].filter(s => !newSet.has(s));

    // update desired set immediately
    this.desiredSubscriptions = new Set(newSet);

    // If socket open, apply diffs
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // add
      for (const sym of toAdd) {
        const topic = this.getTopic(sym);
        try {
          this.ws.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic, response: true }));
          this.actualSubscriptions.add(sym);
          log(`[${this.name}] ➕ subscribed ${sym}`);
        } catch (e) {
          warn(`[${this.name}] failed subscribe ${sym}:`, e);
        }
      }
      // remove
      for (const sym of toRemove) {
        const topic = this.getTopic(sym);
        try {
          this.ws.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic, response: true }));
          this.actualSubscriptions.delete(sym);
          log(`[${this.name}] ➖ unsubscribed ${sym}`);
        } catch (e) {
          warn(`[${this.name}] failed unsubscribe ${sym}:`, e);
        }
      }
    } else {
      // if not open, ensure we attempt to connect (connect will resubscribe to desired set)
      this.ensureConnected().catch(e => warn(`[${this.name}] ensureConnected error:`, e instanceof Error ? e.message : e));
    }
  }

  // send subscribe for every desired symbol (used on open/resubscribe)
  private resubscribeAll() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // try to subscribe to everything in desiredSubscriptions
    for (const sym of this.desiredSubscriptions) {
      const topic = this.getTopic(sym);
      try {
        this.ws.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic, response: true }));
        this.actualSubscriptions.add(sym);
      } catch (e) {
        warn(`[${this.name}] subscribe ${sym} failed:`, e);
      }
    }
    log(`[${this.name}] Resubscribed to ${this.actualSubscriptions.size} symbols.`);
  }

  // socket closed/errored
  private onSocketClose() {
    // cleanup
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    // clear active set; desired remains
    this.actualSubscriptions.clear();
    // clear ws object
    try { if (this.ws) this.ws.removeAllListeners(); } catch {}
    this.ws = null;
  }

  private forceReconnect(reason = 'manual') {
    warn(`[${this.name}] forcing reconnect due to: ${reason}`);
    try {
      if (this.ws) {
        this.ws.removeAllListeners();
        try { this.ws.close(1000, `reconnect: ${reason}`); } catch {}
      }
    } catch (e) { /* ignore */ }
    this.ws = null;
    if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
    this.actualSubscriptions.clear();
    // schedule immediate reconnect with tiny jitter
    setTimeout(() => { this.ensureConnected().catch(e => warn(`[${this.name}] ensureConnected error:`, e)); }, 200 + Math.floor(Math.random()*400));
  }

  public disconnect() {
    info(`[${this.name}] disconnect requested — closing socket`);
    if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
    try {
      if (this.ws) {
        try { this.ws.close(1000, 'worker disconnect'); } catch {}
        this.ws.removeAllListeners();
      }
    } catch (e) { /* ignore */ }
    this.ws = null;
    this.actualSubscriptions.clear();
  }

  // debug helper
  public info() {
    return {
      name: this.name,
      wsState: this.ws ? this.ws.readyState : 'null',
      desired: [...this.desiredSubscriptions],
      actual: [...this.actualSubscriptions],
      lastPongDeltaMs: Date.now() - this.lastPong,
    };
  }
}

// ========== managers (single connection each) ==========
const spotManager = new WebSocketManager('SPOT', KUCOIN_SPOT_TOKEN_ENDPOINT, s => `/market/snapshot:${s}`);
const futuresManager = new WebSocketManager('FUTURES', KUCOIN_FUTURES_TOKEN_ENDPOINT, s => `/contractMarket/snapshot:${s}`);

// ========== Firestore sync loop ==========
// This loop simply computes the desired symbol sets and asks managers to update.
// The managers themselves keep sockets alive and only reconnect when they break.
async function collectAllSymbols() {
  try {
    log('🔍 collecting symbols from Firestore...');
    const spotSymbols = new Set<string>();
    const futuresSymbols = new Set<string>();
    let totalPositions = 0;
    let totalTriggers = 0;

    const positionsSnapshot = await db.collectionGroup('openPositions').where('details.status', '==', 'open').get();
    totalPositions = positionsSnapshot.size;
    positionsSnapshot.forEach(doc => {
      const pos = doc.data() as OpenPosition;
      if (pos.positionType === 'spot') spotSymbols.add(pos.symbol);
      if (pos.positionType === 'futures') futuresSymbols.add(pos.symbol);
    });

    const triggersSnapshot = await db.collectionGroup('tradeTriggers').where('details.status', '==', 'active').get();
    totalTriggers = triggersSnapshot.size;
    triggersSnapshot.forEach(doc => {
      const trigger = doc.data() as TradeTrigger;
      if (trigger.type === 'spot') spotSymbols.add(trigger.symbol);
      if (trigger.type === 'futures') futuresSymbols.add(trigger.symbol);
    });

    log(`📊 Found ${totalPositions} open positions and ${totalTriggers} active triggers.`);
    log(`📡 Subscriptions => SPOT: ${spotSymbols.size}, FUTURES: ${futuresSymbols.size}`);

    // Now update managers: this will add/remove subscriptions (without tearing down socket)
    spotManager.updateDesiredSubscriptions(spotSymbols);
    futuresManager.updateDesiredSubscriptions(futuresSymbols);

  } catch (e) {
    error('❌ collectAllSymbols error:', e);
  }
}

// ========== price handler (keeps your existing Firestore transaction logic) ==========
async function processPriceUpdate(symbol: string, price: number) {
    if (!symbol || !price) return;
    try {
        const positionsQuery = db.collectionGroup('openPositions').where('symbol', '==', symbol).where('details.status', '==', 'open');
        const positionsSnapshot = await positionsQuery.get();
        if (!positionsSnapshot.empty) {
            info(`🔎 Found ${positionsSnapshot.size} open positions for ${symbol}`);
            positionsSnapshot.forEach(async (doc) => {
                const pos = doc.data() as OpenPosition;
                const isLong = pos.side === 'long' || pos.side === 'buy';
                const slHit = pos.details?.stopLoss && (isLong ? price <= pos.details.stopLoss : price >= pos.details.stopLoss);
                const tpHit = pos.details?.takeProfit && (isLong ? price >= pos.details.takeProfit : price <= pos.details.takeProfit);
                if ((slHit || tpHit) && !closingPositions.has(doc.id)) {
                    closingPositions.add(doc.id);
                    try {
                        await db.runTransaction(async (tx) => {
                            const fresh = await tx.get(doc.ref);
                            if (fresh.data()?.details?.status !== 'open') return;
                            log(`⚔️ Closing ${doc.id} due to ${slHit ? 'SL' : 'TP'} @ ${price}`);
                            tx.update(doc.ref, { 'details.status': 'closing', 'details.closePrice': price });
                        });
                    } catch (e) {
                        error('⚠️ tx close position failed:', e);
                    } finally {
                        closingPositions.delete(doc.id);
                    }
                }
            });
        }
    } catch (e) {
        error('❌ processPriceUpdate positions error:', e);
    }

    // triggers
    try {
        const triggersQuery = db.collectionGroup('tradeTriggers').where('symbol', '==', symbol).where('details.status', '==', 'active');
        const triggersSnapshot = await triggersQuery.get();
        if (!triggersSnapshot.empty) {
            info(`🔎 Found ${triggersSnapshot.size} triggers for ${symbol}`);
            triggersSnapshot.forEach(async (doc) => {
                const trigger = doc.data() as TradeTrigger;
                const conditionMet = (trigger.condition === 'above' && price >= trigger.targetPrice) || (trigger.condition === 'below' && price <= trigger.targetPrice);
                if (conditionMet) {
                    try {
                        await db.runTransaction(async (tx) => {
                            const userCtx = doc.ref.parent.parent;
                            if (!userCtx) return;
                            const fresh = await tx.get(doc.ref);
                            if (!fresh.exists) return;
                            log(`🎯 Firing trigger ${doc.id} @ ${price}`);
                            const execRef = userCtx.collection('executedTriggers').doc(doc.id);
                            tx.set(execRef, { ...trigger, currentPrice: price });
                            tx.delete(doc.ref);
                        });
                    } catch (e) {
                        error('⚠️ tx execute trigger failed:', e);
                    }
                }
            });
        }
    } catch (e) {
        error('❌ processPriceUpdate triggers error:', e);
    }
}

// ========== Main loop & lifecycle ==========
let heartbeatInterval: NodeJS.Timeout | null = null;

async function startSession(ms = SESSION_MS) {
  if (sessionActive) return;
  sessionActive = true;
  log('🚀 worker loop starting — sessionActive=true');

  // initial collect
  await collectAllSymbols();

  // heartbeat for visibility
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    const spotInfo = spotManager.info();
    const futInfo = futuresManager.info();
    log(`💓 heartbeat — sessionActive=${sessionActive} | SPOT subs=${spotInfo.desired.length} ws=${spotInfo.wsState} | FUT subs=${futInfo.desired.length} ws=${futInfo.wsState}`);
  }, 60_000);

  // periodic requery loop to update desired subscriptions
  if (requeryInterval) clearInterval(requeryInterval);
  requeryInterval = setInterval(() => {
    if (!sessionActive) return;
    collectAllSymbols().catch(e => error('collectAllSymbols loop error:', e));
  }, REQUERY_INTERVAL_MS);
}

// Expose HTTP server (health + quick debug)
const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  if (req.url === '/debug') {
    const payload = {
      instance: INSTANCE_ID,
      time: new Date().toISOString(),
      spot: spotManager.info(),
      futures: futuresManager.info(),
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload, null, 2));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`Paper trading worker ${INSTANCE_ID} running\n`);
});

const PORT = Number(process.env.PORT) || 8080;
server.listen(PORT, () => {
  log(`📡 HTTP server listening on ${PORT}`);
  // start worker loop
  startSession().catch(e => error('startWorkerLoop error:', e));
});

// graceful shutdown
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  warn('🛑 shutdown initiated');
  sessionActive = false;
  if (requeryInterval) clearInterval(requeryInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  spotManager.disconnect();
  futuresManager.disconnect();
  try { await admin.app().delete(); } catch (e) { /* ignore */ }
  server.close(() => {
    log('🔚 HTTP server closed, exiting');
    process.exit(0);
  });
  setTimeout(() => {
    error('⏳ forced exit after timeout');
    process.exit(1);
  }, 5000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
