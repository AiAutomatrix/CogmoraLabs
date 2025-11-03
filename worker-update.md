# Architecture Update: Multi-Socket Scaling for the Real-Time Worker

This document outlines the planned architectural upgrade for the `realtime-worker` to enable it to scale and handle thousands of concurrent symbol subscriptions efficiently and cost-effectively.

---

## 1. The Challenge: The Subscription Limit

Our current worker architecture, while robust, faces a fundamental scaling limitation imposed by the KuCoin API: a single WebSocket connection can only subscribe to a maximum of **300 topics (symbols)**. As our user base and their watchlists grow, we will quickly exceed this limit, causing the worker to miss price updates for some symbols.

The naive solution of simply spinning up more Cloud Run instances would be expensive and would multiply our Firestore read operations, leading to significantly higher costs.

## 2. The Solution: Multi-Socket Scaling within a Single Instance

The chosen solution is to implement **multi-socket scaling** *within* our single, existing Cloud Run worker process. This is a highly efficient strategy that addresses the connection limit without increasing infrastructure costs.

Instead of one `WebSocketManager` for spot and one for futures, we will maintain an **array** of managers for each:
- `spotManagers: WebSocketManager[]`
- `futuresManagers: WebSocketManager[]`

### How It Works:

1.  **Unified Data Fetch**: The `collectAllSymbols` function will continue to perform a single, efficient query against Firestore to get the complete set of all symbols that need to be monitored.

2.  **Intelligent Chunking**: The master list of symbols will be divided into smaller "chunks" (e.g., of 250 symbols each).

3.  **Dynamic Socket Pooling**: The worker will dynamically manage its pool of `WebSocketManager` instances.
    - If there are more chunks than managers, it will create new `WebSocketManager` instances.
    - If there are fewer chunks than managers, it will disconnect and destroy the unneeded ones.

4.  **Distributed Subscriptions**: Each `WebSocketManager` instance in the array will be assigned one chunk of symbols to subscribe to.

This creates a "cluster-in-a-box," where a single Node.js process manages multiple independent WebSocket connections, allowing us to subscribe to `250 * N` symbols, where `N` is the number of sockets.

## 3. Benefits of this Architecture

-   **Scalability**: We can now monitor thousands of symbols instead of just a few hundred.
-   **Cost-Effectiveness**: This is all achieved within a single Cloud Run instance, so our infrastructure costs do not increase.
-   **Firestore Efficiency**: We continue to perform only one database read operation per interval, keeping our Firestore costs low and predictable.
-   **Simplicity**: We avoid the complexity of a fully distributed system (e.g., using Pub/Sub for coordination between multiple worker instances) until it is absolutely necessary.

## 4. Phased Rollout Plan

This architecture represents the next logical step in scaling our backend.

-   **Phase 1 (This Update)**: Implement multi-socket scaling within a single worker. This will comfortably carry us through the next stage of user growth.
-   **Phase 2 (Future)**: When a single instance's CPU or memory becomes a bottleneck, we will move to a horizontally sharded deployment with multiple Cloud Run workers, each running its own multi-socket cluster.

This plan allows us to scale gracefully, addressing the most immediate bottleneck first while laying the groundwork for future expansion.
