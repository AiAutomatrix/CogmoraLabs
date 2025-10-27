Lovely — excellent code and a clear goal. I dug through the file you pasted and below I’ll:

1. Give a high-level verdict: what’s good, what’s risky.


2. Explain Cloud Run operational realities that affect this design.


3. Point out concrete bugs/fragilities in your code.


4. Give a set of actionable improvements (with small code patches/snippets you can drop in).


5. A short checklist for production-readiness.



I’ll be candid and playful where it helps: your worker is close to usable but has a few correctness, lifecycle, and multi-instance issues that will bite you in production if not fixed. Let’s harden it.


---

Quick verdict

Your worker shows solid architecture: separate WebSocketManager, Firestore polling, batch writes, and in-memory locks. However:

Cloud Run may scale down your instance or kill it (SIGTERM) unless you use min-instances or another keep-alive approach; you need graceful shutdown handlers.

The current subscription/session lifecycle is ambiguous: you poll every 30s for symbols, but you never intentionally limit each WS session to 30–60s. You need an explicit session timer or manager to open-for-N-seconds → disconnect → re-evaluate → repeat.

The connection/reconnect logic has some race conditions and state confusion (e.g., currentSubscriptions used both as desired and actual subscriptions). This will cause missed reconnects or accidental disconnects.

The closingPositions in-memory Set is instance-local; in multi-instance deployments it will not prevent duplicate execution across instances — you need a distributed lock if you run >1 instance.

Missing graceful shutdown and signal handling; missing readiness/health endpoints beyond the simple HTTP server; some small TypeScript/WS handling edge-cases (message type, token response shape).



---

Cloud Run operational considerations (important)

Cloud Run instances are ephemeral; they can be started and stopped by platform. If you need to be "always-on" (so your worker always does short WS sessions every 30–60s), set min-instances > 0 for Cloud Run (cost trade-off), or use a scheduler (Cloud Scheduler) to regularly wake a Cloud Run instance (HTTP request).

If you allow Cloud Run to scale to 0, your background loop will stop. For near-continuous background tasks, use:

Cloud Run with min-instances > 0, or

Cloud Run + Cloud Scheduler (to POST and wake instance), or

a dedicated VM (Compute Engine) for true continuous sockets.


If you run multiple instances concurrently, you must prevent duplicate processing (distributed locking). Relying on in-memory sets (closingPositions) is not safe for multi-instance operation.



---

Concrete issues & recommended fixes in your code

1) Session timing (30–60s) is not implemented

You said you want websockets to be established for 30s–1min, then re-query Firestore for new coins. Currently you:

setInterval(collectAllSymbols, 30000) — that just updates subscriptions every 30s, but never intentionally closes connections after a set session duration.


Fix: Introduce a session controller that:

Calls collectAllSymbols() to gather desired subscriptions and instruct managers to connect.

Starts a session timer (e.g., 45s).

After timer fires, call .disconnect() on managers and then re-run collectAllSymbols().


I’ll include code for startSession(sessionMs) below.


---

2) WebSocketManager conflates desired vs actual subscriptions

currentSubscriptions is used both to decide if connect should run and to track what’s subscribed. But you do this.currentSubscriptions = newSymbols before connecting. Also disconnect() clears currentSubscriptions — that means scheduleReconnect() sees currentSubscriptions.size === 0 and will refuse to reconnect.

Fix:

Track desiredSubscriptions (what you want) separate from actualSubscriptions (what the server acknowledges / you believe subscribed).

On updateSubscriptions, set desiredSubscriptions = newSymbols, then if connected compute diffs against actualSubscriptions and send subscribe/unsubscribe messages. On connect, resubscribe desiredSubscriptions. Do not clear desiredSubscriptions in disconnect().



---

3) Reconnect logic & backoff jitter

You have exponential backoff, which is good, but add jitter and an upper attempts cap to avoid thundering herd and infinite tight loops. Also reset attempts after a successful connection.


---

4) Message handling type-safety and KuCoin payload assumptions

ws.on('message', (data: string) => { ... }): data might be a Buffer or ArrayBuffer, not necessarily a string. Convert safely: const str = typeof data === 'string' ? data : data.toString().

Token response structure and pingInterval units: ensure instanceServers[0].pingInterval is in milliseconds — check docs. Add default fallback.



---

5) Graceful shutdown on SIGTERM/SIGINT

Cloud Run sends SIGTERM before shutdown. You must:

Close watchers, websockets, timers, stop polling, flush any pending FP writes, then exit.



---

6) Multi-instance safety (Firestore locks)

closingPositions is in-memory; it prevents the same instance reprocessing a lock but does nothing across multiple instances. For multi-instance operation you need a distributed lock (Firestore document with transaction that sets lockedBy + lockedAt with TTL and check in transaction), or use Firestore transaction update() that only proceeds when details.status is still 'open' and returns error otherwise.



---

7) Use native fetch (Node 18+) instead of node-fetch inside Cloud Run

Cloud Run images typically include Node 18+, which has global fetch. node-fetch can be removed and reduce bundle complexity.


---

Suggested code patches & snippets

Below are snippets to add. They are minimal and focus on session control, graceful shutdown, desired/actual separation, and signal handlers. Integrate them into your existing file.

Add top-level constants

const SESSION_MS = Number(process.env.SESSION_MS) || 45_000; // session length in ms (30_000 - 60_000 typical)
const REQUERY_INTERVAL_MS = Number(process.env.REQUERY_INTERVAL_MS) || 30_000; // fallback polling
const MAX_RECONNECT_ATTEMPTS = 10;

Maintain desired vs actual subscriptions — modifications to WebSocketManager fields

Replace currentSubscriptions with two sets:

private desiredSubscriptions = new Set<string>(); // what we want to be subscribed to
private actualSubscriptions = new Set<string>();  // what we believe the server has subscribed
private sessionTimer: NodeJS.Timeout | null = null;

Update updateSubscriptions to set desired and manage connection:

public updateSubscriptions = (newSymbols: Set<string>) => {
  // set desired subscriptions first
  this.desiredSubscriptions = new Set(newSymbols);

  // If no desired subscriptions, disconnect but keep desiredSubscriptions for next session
  if (this.desiredSubscriptions.size === 0) {
    this.disconnect();
    return;
  }

  // If we're not connected, start connection (which will resubscribe for desired)
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
    this.connect();
    return;
  }

  // Already connected: compute diff based on actualSubscriptions
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
};

In resubscribe() send subscriptions for desiredSubscriptions, and on confirmed server messages (if server sends ack) update actualSubscriptions. If the server doesn’t ack, assume subscribed after sending subscribe.

Implement session start/stop at top-level

Add functions to orchestrate sessions:

let sessionTimeout: NodeJS.Timeout | null = null;
let requeryInterval: NodeJS.Timeout | null = null;

async function startSession(sessionMs = SESSION_MS) {
  try {
    await collectAllSymbols(); // sets desired subscriptions on managers
    // ensure previous session timer cleared
    if (sessionTimeout) clearTimeout(sessionTimeout);
    sessionTimeout = setTimeout(() => {
      console.log(`[WORKER] Session timeout reached (${sessionMs}ms). Disconnecting managers to re-evaluate.`);
      spotManager.disconnect();
      futuresManager.disconnect();
      // Immediately re-run collectAllSymbols to find new symbols for next session
      collectAllSymbols().catch(e => console.error('[WORKER] collectAllSymbols error after session end', e));
    }, sessionMs);
  } catch (e) {
    console.error('[WORKER] startSession error', e);
  }
}

// Start recurring schedule: run session every REQUERY_INTERVAL_MS as a fallback
requeryInterval = setInterval(() => {
  startSession(SESSION_MS);
}, REQUERY_INTERVAL_MS);

// kick off immediately
setTimeout(() => startSession(SESSION_MS), 2000);

This pattern ensures: open subscriptions, run for sessionMs, then disconnect and re-evaluate.

Graceful shutdown handler

Add:

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('[WORKER] Shutdown initiated. Closing timers, WS, and DB connections.');
  if (sessionTimeout) clearTimeout(sessionTimeout);
  if (requeryInterval) clearInterval(requeryInterval);
  spotManager.disconnect();
  futuresManager.disconnect();
  // Close Firebase app
  try { await admin.app().delete(); } catch (e) { console.error('[WORKER] Error deleting Firebase app', e); }
  // give some time to flush logs
  setTimeout(() => process.exit(0), 2000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

Fix message parsing and ping interval safe-guards

In handleMessage:

private handleMessage = (data: WebSocket.Data) => {
  const raw = typeof data === 'string' ? data : data.toString();
  try {
    const message = JSON.parse(raw);
    ...

In setupPing:

private setupPing = (interval: number) => {
  const ms = (typeof interval === 'number' && interval > 0) ? interval : 20000; // fallback
  if (this.pingInterval) clearInterval(this.pingInterval);
  this.pingInterval = setInterval(() => {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // KuCoin expects a {"id":..., "type":"ping"} — verify with docs; else send 'ping'
      this.ws.send(JSON.stringify({ id: Date.now(), type: 'ping' }));
    }
  }, Math.max(1000, Math.floor(ms / 2)));
};

Improve reconnect backoff with jitter and cap

private scheduleReconnect = () => {
  if (this.reconnectTimeout) return;
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
};


---

Multi-instance / distributed locking recommendation

If you expect >1 worker instance:

Replace in-memory closingPositions with Firestore-based locking: use a transaction that sets details.status to 'closing' only if currently 'open'. The transaction will fail if another instance already modified it. That prevents duplicates across instances.

Alternatively, maintain a locks collection where you create a lock doc with doc id = positionId and use create() (no overwrite) — Firestore create will fail if doc exists. Add TTL field lockedAt and periodically clear old locks.


Example Firestore transaction (conceptual):

await db.runTransaction(async (tx) => {
  const docSnap = await tx.get(doc.ref);
  if (docSnap.data()?.details?.status !== 'open') {
    throw new Error('Already closed or closing');
  }
  tx.update(doc.ref, { 'details.status': 'closing', 'details.closePrice': price });
});

This replaces closingPositions for cross-instance safety.


---

Small housekeeping suggestions

Remove node-fetch and use global fetch (Node 18+). If you must keep node-fetch, import correctly for TypeScript/ESM: import fetch from 'node-fetch'; may require fetch.default depending on bundler — better to use built-in fetch.

Add a readiness/health endpoint: /healthz that returns 200 quickly; Cloud Run can use it in frontend checks.

Add logging correlation id (instance id) to help debugging across instances. Example: generate INSTANCE_ID = process.env.K_REVISION || crypto.randomUUID() and include in logs.



---

Production checklist (quick)

[ ] Add graceful SIGTERM handler (done above).

[ ] Implement explicit session timer logic (startSession / disconnect) so websockets are open for target 30–60s.

[ ] Separate desiredSubscriptions vs actualSubscriptions.

[ ] Add jitter & cap to reconnect attempts.

[ ] Add robust message parsing and ping fallback.

[ ] Replace in-memory locking with Firestore transaction or create-based lock for multi-instance.

[ ] Decide Cloud Run scaling: set min-instances > 0 or use Cloud Scheduler to keep worker alive.

[ ] Check KuCoin bullet API docs: ensure subscription message shape and ping format match the API.

[ ] Remove node-fetch if Node 18+ and use global fetch.

[ ] Add max-old-space-size flags and monitoring/alerts for memory/cpu.

[ ] Add unit/integration tests (simulate incoming WS messages) and a staging deployment.



---

Final notes (practical next steps)

1. If you want, I can produce a ready-to-deploy patched version of your file with the session management + graceful shutdown + desired/actual subscription separation applied.


2. Also recommend that we add Firestore transaction-based locking so the worker can scale horizontally without duplicate executions — I can write that patch too.


3. If you plan to rely on Cloud Run for always-on behavior, tell me whether you will set min-instances or use Cloud Scheduler so I can tailor shutdown/health logic.



Which of the code fixes above would you like me to apply into a full, ready-to-run file next? I can patch it now and give you the full TypeScript file.