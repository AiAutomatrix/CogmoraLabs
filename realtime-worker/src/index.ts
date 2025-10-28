
import * as admin from "firebase-admin";
import WebSocket from "ws";
import http from "http";
import crypto from "crypto";

// ====== Firebase Init ======
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}
const db = admin.firestore();

// ====== Constants ======
const KUCOIN_SPOT_TOKEN_ENDPOINT = "https://api.kucoin.com/api/v1/bullet-public";
const KUCOIN_FUTURES_TOKEN_ENDPOINT = "https://api-futures.kucoin.com/api/v1/bullet-public";
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

// ====== WebSocket Manager ======
class WebSocketManager {
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnecting = false;
  private desired = new Set<string>();
  private cachedToken: any = null;
  private lastTokenTime = 0;
  private lastPong = Date.now();

  constructor(
    private name: "SPOT" | "FUTURES",
    private endpoint: string,
    private topicFn: (s: string) => string
  ) {}

  // --- Token Handling ---
  private async fetchToken() {
    const now = Date.now();
    if (this.cachedToken && now - this.lastTokenTime < 30000) return this.cachedToken;
    const res = await fetch(this.endpoint, { method: "POST", keepalive: false } as any);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as any;
    if (data?.code !== "200000") throw new Error(`Bad response code: ${data?.code}`);
    this.cachedToken = data.data;
    this.lastTokenTime = now;
    info(`[${this.name}] ✅ token fetched`);
    return this.cachedToken;
  }

  // --- Core Connect Logic ---
  public async ensureConnected() {
    if (this.reconnecting) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.desired.size === 0) {
      this.disconnect();
      return;
    }

    this.reconnecting = true;
    await this.fullCleanup("pre-connect");
    await new Promise((r) => setTimeout(r, 2000));

    try {
      const token = await this.fetchToken();
      const server = token.instanceServers[0];
      const wsUrl = `${server.endpoint}?token=${token.token}`;
      const pingMs = server.pingInterval || 20000;

      info(`[${this.name}] connecting to ${wsUrl}`);
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.on("open", () => {
        info(`[${this.name}] ✅ WebSocket open`);
        this.lastPong = Date.now();
        this.resubscribeAll();
        this.startPingLoop(pingMs);
        this.reconnecting = false;
      });

      socket.on("pong", () => (this.lastPong = Date.now()));

      socket.on("message", (d) => this.onMessage(d));

      socket.on("close", (code, reason) => {
        warn(`[${this.name}] closed (${code}) ${reason.toString()}`);
        this.scheduleReconnect();
      });

      socket.on("error", (e) => {
        error(`[${this.name}] socket error: ${e}`);
        this.scheduleReconnect();
      });
    } catch (e: any) {
      error(`[${this.name}] connection failure: ${e.message || e}`);
      await new Promise((r) => setTimeout(r, 3000));
      this.scheduleReconnect();
    }
  }

  private onMessage(data: WebSocket.Data) {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "pong" || msg.type === "heartbeat") {
        this.lastPong = Date.now();
        return;
      }
      if (msg.topic && msg.data) {
        const sym =
          this.name === "SPOT"
            ? msg.topic.split(":")[1]
            : msg.topic.replace("/contractMarket/snapshot:", "");
        const price =
          this.name === "SPOT"
            ? parseFloat(msg.data?.data?.lastTradedPrice)
            : parseFloat(msg.data?.markPrice);
        if (!Number.isNaN(price)) processPriceUpdate(sym, price);
      }
    } catch (err: any) {
      warn(`[${this.name}] parse error: ${err.message || err}`);
    }
  }

  // --- Ping & Reconnect ---
  private startPingLoop(interval: number) {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      try {
        this.ws.ping();
      } catch {}
      if (Date.now() - this.lastPong > interval * 2) {
        warn(`[${this.name}] heartbeat lost; forcing reconnect`);
        this.forceReconnect();
      }
    }, Math.max(5000, interval));
  }

  private async scheduleReconnect() {
    if (this.reconnecting) return;
    this.reconnecting = true;
    await this.fullCleanup("scheduleReconnect");
    await new Promise((r) => setTimeout(r, 3000));
    this.ensureConnected().catch(() => {});
  }

  private async fullCleanup(context: string) {
    info(`[${this.name}] cleaning up (${context})`);
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = null;
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          for (const sym of this.desired) {
            const topic = this.topicFn(sym);
            this.ws.send(JSON.stringify({ id: Date.now(), type: "unsubscribe", topic }));
          }
        }
        await new Promise((r) => setTimeout(r, 200));
        this.ws.terminate();
      } catch (err: any) {
        warn(`[${this.name}] cleanup error: ${err.message || err}`);
      }
      this.ws.removeAllListeners();
      this.ws = null;
    }
  }

  public forceReconnect() {
    this.fullCleanup("forceReconnect").then(() => this.ensureConnected());
  }

  public disconnect() {
    this.fullCleanup("manual-disconnect");
  }

  // --- Subscription Management ---
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
        this.ws.send(
          JSON.stringify({
            id: Date.now(),
            type: "subscribe",
            topic,
            privateChannel: false,
            response: true,
          })
        );
      } catch (err: any) {
        warn(`[${this.name}] subscribe fail ${sym}: ${err.message || err}`);
      }
    }
    info(`[${this.name}] subscribed to ${this.desired.size} topics`);
  }

  public info() {
    return {
      name: this.name,
      connected: !!this.ws && this.ws.readyState === WebSocket.OPEN,
      desired: [...this.desired],
      lastPongAge: Date.now() - this.lastPong,
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
      const p = d.data() as any;
      if (p.details?.status === "open") {
        if (p.positionType === "spot") spotSet.add(p.symbol);
        else futSet.add(p.symbol);
      }
    });

    const trigSnap = await db.collectionGroup("tradeTriggers").get();
    trigSnap.forEach((d) => {
      const t = d.data() as any;
      if (t.details?.status === "active") {
        if (t.type === "spot") spotSet.add(t.symbol);
        else futSet.add(t.symbol);
      }
    });

    spot.updateDesired(spotSet);
    futures.updateDesired(futSet);
    log(`Symbols updated: ${spotSet.size} spot, ${futSet.size} fut`);
    log(`📊 Analyzing ${spotSet.size} open positions & triggers`);
  } catch (e: any) {
    error(`collectAllSymbols error: ${e.message || e}`);
  }
}

// ====== Price Update Logic ======
async function processPriceUpdate(symbol: string, price: number) {
  try {
    const positions = await db
      .collectionGroup("openPositions")
      .where("symbol", "==", symbol)
      .where("details.status", "==", "open")
      .get();

    for (const doc of positions.docs) {
      const pos = doc.data() as any;
      const long = pos.side === "long" || pos.side === "buy";
      const sl =
        pos.details?.stopLoss &&
        (long ? price <= pos.details.stopLoss : price >= pos.details.stopLoss);
      const tp =
        pos.details?.takeProfit &&
        (long ? price >= pos.details.takeProfit : price <= pos.details.takeProfit);

      if ((sl || tp) && !closingPositions.has(doc.id)) {
        closingPositions.add(doc.id);
        await db.runTransaction(async (tx) => {
          const fresh = await tx.get(doc.ref);
          if (fresh.data()?.details?.status !== "open") return;
          tx.update(doc.ref, {
            "details.status": "closing",
            "details.closePrice": price,
          });
        });
        closingPositions.delete(doc.id);
        log(`📉 Position trigger fired for ${symbol} at ${price}`);
      }
    }
  } catch (e: any) {
    error(`processPriceUpdate error: ${e.message || e}`);
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
    log(`💓 heartbeat — SPOT=${s.connected} FUT=${f.connected}`);

    if (!s.connected && s.desired.length > 0 && s.lastPongAge > 60000) {
      warn("💀 SPOT websocket dead >60s — full reset");
      spot.forceReconnect();
    }
    if (!f.connected && f.desired.length > 0 && f.lastPongAge > 60000) {
      warn("💀 FUTURES websocket dead >60s — full reset");
      futures.forceReconnect();
    }
  }, 60000);

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
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function shutdown() {
  warn("🛑 shutdown");
  sessionActive = false;
  if (requeryInterval) clearInterval(requeryInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  spot.disconnect();
  futures.disconnect();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}
