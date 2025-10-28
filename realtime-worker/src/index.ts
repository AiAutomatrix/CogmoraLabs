
import * as admin from 'firebase-admin';
import WebSocket from 'ws';
import http from 'http';
import https from 'https';
import crypto from 'crypto';

// ====== Firestore init ======
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}
const db = admin.firestore();

// ====== Constants ======
const KUCOIN_SPOT_TOKEN_ENDPOINT = 'https://api.kucoin.com/api/v1/bullet-public';
const KUCOIN_FUTURES_TOKEN_ENDPOINT = 'https://api-futures.kucoin.com/api/v1/bullet-public';
const SESSION_MS = Number(process.env.SESSION_MS) || 480000;
const REQUERY_INTERVAL_MS = Number(process.env.REQUERY_INTERVAL_MS) || 30000;
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

// ====== WebSocket Manager ======
class WebSocketManager {
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private desired = new Set<string>();
  private actual = new Set<string>();
  private cachedToken: any = null;
  private lastTokenTime = 0;
  private lastPong = Date.now();

  constructor(
    private name: 'SPOT' | 'FUTURES',
    private endpoint: string,
    private topicFn: (s: string) => string
  ) {}

  private async fetchToken(retries = 4) {
    const now = Date.now();
    if (this.cachedToken && now - this.lastTokenTime < 30_000) return this.cachedToken;

    let lastErr: any;
    for (let i = 1; i <= retries; i++) {
      try {
        const res = await fetch(this.endpoint, { method: 'POST', keepalive: false });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: any = await res.json();
        if (data?.code !== '200000') throw new Error(`Bad response code: ${data?.code}`);
        this.cachedToken = data.data;
        this.lastTokenTime = now;
        info(`[${this.name}] ✅ token fetched`);
        return this.cachedToken;
      } catch (e: unknown) {
        lastErr = e;
        const errorMessage = e instanceof Error ? e.message : String(e);
        warn(`[${this.name}] token fetch attempt ${i} failed: ${errorMessage}`);
        await new Promise(r => setTimeout(r, Math.min(5000 * i, 15000)));
      }
    }
    throw lastErr;
  }

  public async ensureConnected() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    if (this.desired.size === 0) {
      this.disconnect();
      return;
    }

    try {
      const token = await this.fetchToken();
      const server = token.instanceServers[0];
      const wsUrl = `${server.endpoint}?token=${token.token}`;
      const pingMs = server.pingInterval || 20000;

      this.ws = new WebSocket(wsUrl);
      this.ws.on('open', () => {
        info(`[${this.name}] 🔗 connected`);
        this.lastPong = Date.now();
        this.resubscribeAll();
        this.startPingLoop(pingMs);
      });
      this.ws.on('pong', () => (this.lastPong = Date.now()));
      this.ws.on('message', d => this.onMessage(d));
      this.ws.on('close', (c, r) => {
        const reason = r.toString();
        warn(`[${this.name}] socket closed (${c}) ${reason}`);
        this.scheduleReconnect();
      });
      this.ws.on('error', e => {
        error(`[${this.name}] socket error: ${e}`);
        this.scheduleReconnect();
      });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      error(`[${this.name}] failed to connect: ${errorMessage}`);
      this.scheduleReconnect();
    }
  }

  private onMessage(d: WebSocket.Data) {
    try {
      const msg = JSON.parse(d.toString());
      if (msg.type === 'pong') {
        this.lastPong = Date.now();
        return;
      }
      if (msg.topic && msg.data) {
        const sym = this.name === 'SPOT'
          ? msg.topic.split(':')[1]
          : msg.topic.replace('/contractMarket/snapshot:', '');
        const price = this.name === 'SPOT'
          ? parseFloat(msg.data?.data?.lastTradedPrice)
          : parseFloat(msg.data?.markPrice);
        if (!Number.isNaN(price)) processPriceUpdate(sym, price);
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      warn(`[${this.name}] parse error: ${errorMessage}`);
    }
  }

  private startPingLoop(interval: number) {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      try {
        this.ws.ping();
      } catch {}
      if (Date.now() - this.lastPong > interval * 2) {
        warn(`[${this.name}] ⚠️ no pong, reconnecting`);
        this.forceReconnect();
      }
    }, Math.max(5000, interval));
  }

  private scheduleReconnect() {
    this.cleanup();
    setTimeout(() => this.ensureConnected().catch(() => {}), 5000 + Math.random() * 3000);
  }

  private cleanup() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = null;
    try { this.ws?.terminate(); } catch {}
    this.ws = null;
    this.actual.clear();
  }

  public forceReconnect() {
    this.cleanup();
    this.ensureConnected().catch(() => {});
  }

  disconnect() {
    this.cleanup();
  }

  updateDesired(set: Set<string>) {
    this.desired = set;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.resubscribeAll();
    } else {
      this.ensureConnected().catch(() => {});
    }
  }

  private resubscribeAll() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    for (const sym of this.desired) {
      try {
        const topic = this.topicFn(sym);
        this.ws.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic, privateChannel: false, response: true }));
        this.actual.add(sym);
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        warn(`[${this.name}] failed subscribe ${sym}: ${errorMessage}`);
      }
    }
    info(`[${this.name}] Resubscribed ${this.actual.size} topics`);
  }

  info() {
    return {
      name: this.name,
      connected: !!this.ws && this.ws.readyState === WebSocket.OPEN,
      desired: [...this.desired],
      lastPongAge: Date.now() - this.lastPong
    };
  }
}

const spot = new WebSocketManager('SPOT', KUCOIN_SPOT_TOKEN_ENDPOINT, s => `/market/snapshot:${s}`);
const futures = new WebSocketManager('FUTURES', KUCOIN_FUTURES_TOKEN_ENDPOINT, s => `/contractMarket/snapshot:${s}`);

// ====== Firestore Loop ======
async function collectAllSymbols() {
  try {
    const spotSet = new Set<string>();
    const futSet = new Set<string>();

    const posSnap = await db.collectionGroup('openPositions').get();
    posSnap.forEach(d => {
      const p = d.data() as any;
      if (p.details?.status === 'open') {
        if (p.positionType === 'spot') spotSet.add(p.symbol);
        else futSet.add(p.symbol);
      }
    });

    const trigSnap = await db.collectionGroup('tradeTriggers').get();
    trigSnap.forEach(d => {
      const t = d.data() as any;
      if (t.details?.status === 'active') {
        if (t.type === 'spot') spotSet.add(t.symbol);
        else futSet.add(t.symbol);
      }
    });

    spot.updateDesired(spotSet);
    futures.updateDesired(futSet);
    log(`Symbols updated: ${spotSet.size} spot, ${futSet.size} fut`);
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    error(`collectAllSymbols error: ${errorMessage}`);
  }
}

// ====== Price Update Logic ======
async function processPriceUpdate(symbol: string, price: number) {
  try {
    const positions = await db.collectionGroup('openPositions').where('symbol', '==', symbol).where('details.status', '==', 'open').get();
    for (const doc of positions.docs) {
      const pos = doc.data() as any;
      const long = pos.side === 'long' || pos.side === 'buy';
      const sl = pos.details?.stopLoss && (long ? price <= pos.details.stopLoss : price >= pos.details.stopLoss);
      const tp = pos.details?.takeProfit && (long ? price >= pos.details.takeProfit : price <= pos.details.takeProfit);
      if ((sl || tp) && !closingPositions.has(doc.id)) {
        closingPositions.add(doc.id);
        await db.runTransaction(async tx => {
          const fresh = await tx.get(doc.ref);
          if (fresh.data()?.details?.status !== 'open') return;
          tx.update(doc.ref, { 'details.status': 'closing', 'details.closePrice': price });
        });
        closingPositions.delete(doc.id);
      }
    }
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    error(`processPriceUpdate error: ${errorMessage}`);
  }
}

// ====== Main loop ======
async function startSession() {
  if (sessionActive) return;
  sessionActive = true;
  log('🚀 Worker started');

  await collectAllSymbols();

  heartbeatInterval = setInterval(() => {
    const s = spot.info();
    const f = futures.info();
    log(`💓 heartbeat — SPOT=${s.connected} FUT=${f.connected}`);
    if (!s.connected && s.desired.length > 0 && s.lastPongAge > 60000) {
      warn('💀 SPOT websocket dead >60s — full reset');
      spot.forceReconnect();
    }
     if (!f.connected && f.desired.length > 0 && f.lastPongAge > 60000) {
      warn('💀 FUTURES websocket dead >60s — full reset');
      futures.forceReconnect();
    }
  }, 60000);

  requeryInterval = setInterval(() => collectAllSymbols(), REQUERY_INTERVAL_MS);
}

// ====== HTTP Server ======
const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  if (req.url === '/debug') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ spot: spot.info(), futures: futures.info() }, null, 2));
    return;
  }
  res.writeHead(200);
  res.end('paper trading worker\n');
});

const PORT = Number(process.env.PORT) || 8080;
server.listen(PORT, () => {
  log(`Listening on ${PORT}`);
  startSession().catch(e => {
    const errorMessage = e instanceof Error ? e.message : String(e);
    error(`startSession: ${errorMessage}`);
  });
});

// ====== Graceful shutdown ======
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function shutdown() {
  warn('🛑 shutdown');
  sessionActive = false;
  if (requeryInterval) clearInterval(requeryInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  spot.disconnect();
  futures.disconnect();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}
