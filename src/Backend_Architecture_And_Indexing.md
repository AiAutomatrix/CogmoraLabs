# Backend Architecture & Indexing Strategy

This document provides a detailed overview of the Cogmora Labs backend system, focusing on the real-time Cloud Run worker and the specific Firestore indexing strategy that enables its core functionality.

---

## 1. Backend Architecture: A Two-Part System

Our backend is designed as a hybrid system with two distinct, cooperative parts that work together to provide both scheduled automation and instantaneous, real-time responses.

### a. Event-Driven & Scheduled Logic (Cloud Functions)

-   **Technology**: Cloud Functions for Firebase
-   **Role**: Handles tasks that are periodic or can tolerate a minor delay. This is perfect for reliability and managing atomic database operations.
-   **Responsibilities**:
    -   Running the AI Trading Agent on a user-defined schedule.
    -   Running the automated Watchlist Scraper on a schedule.
    -   Securely closing trade positions (`closePositionHandler`) after they are marked for closure, ensuring all P&L calculations and balance updates are transactional and safe.

### b. Real-Time Trigger Execution (Cloud Run Worker)

-   **Technology**: A persistent Docker container on Google Cloud Run (`--min-instances=1`).
-   **Role**: Acts as the system's 24/7 "reflexes." It maintains constant connections to live data feeds to act on market changes in milliseconds.
-   **Responsibilities**:
    -   Maintaining live, persistent WebSocket connections to KuCoin's spot and futures feeds.
    -   Continuously monitoring all users' open positions and trade triggers.
    -   Instantly executing Stop Loss/Take Profit orders by updating an `openPosition`'s status to `'closing'`.
    -   Instantly executing `tradeTriggers` when a price condition is met.

---

## 2. The Firestore Indexing Challenge & Solution

A key challenge was getting the Cloud Run worker to efficiently query all `openPositions` and `tradeTriggers` across all users (a "collection group query") without running into permission or performance issues.

### The Problem: `FAILED_PRECONDITION`

Initially, our worker tried to query triggers with a simple query like this:
`db.collectionGroup('tradeTriggers').where('symbol', '==', 'BTC-USDT')`

This repeatedly failed with a `FAILED_PRECONDITION` error. This error means Firestore needs an index to perform the query, but one doesn't exist. Our attempts to manually define a simple, single-field index in `firestore.indexes.json` were rejected by the deployment tool, creating a frustrating loop.

### The Solution: Nested Fields & Composite Indexes

The breakthrough came from observing that our `openPositions` query *was* working perfectly. The key difference was its structure. We decided to refactor our `tradeTriggers` to match this successful pattern.

**1. The Successful `openPositions` Pattern:**

-   **Data Structure (`OpenPosition` type):** We intentionally nested the `status` field inside a `details` object.
    ```typescript
    {
      symbol: "BTC-USDT",
      // ...other fields
      details: {
        status: "open",
        stopLoss: 60000
      }
    }
    ```
-   **Worker Query:** This structure allowed us to write a **composite query** with two `where` clauses.
    ```typescript
    db.collectionGroup('openPositions')
      .where('symbol', '==', 'BTC-USDT')
      .where('details.status', '==', 'open') 
    ```
-   **Index Definition (`firestore.indexes.json`):** A composite query on a collection group **requires** a manually defined composite index. We created one that exactly matched the query's fields and order.
    ```json
    {
      "collectionGroup": "openPositions",
      "fields": [
        { "fieldPath": "symbol", "order": "ASCENDING" },
        { "fieldPath": "details.status", "order": "ASCENDING" }
      ]
    }
    ```

**2. Applying the Pattern to `tradeTriggers`:**

We applied the exact same logic to fix the `tradeTriggers` query.

-   **Data Structure (`TradeTrigger` type):** We refactored it to nest the `status` inside a `details` object.
    ```typescript
    {
      symbol: "ETH-USDT",
      // ...other fields
      details: {
        status: "active" 
      }
    }
    ```
-   **Worker Query:** We updated the query to use the new nested path.
    ```typescript
    db.collectionGroup('tradeTriggers')
      .where('symbol', '==', 'ETH-USDT')
      .where('details.status', '==', 'active')
    ```
-   **Index Definition:** We created the corresponding composite index that the `firebase deploy` command would accept, because it was now necessary for a valid composite query.
    ```json
    {
      "collectionGroup": "tradeTriggers",
      "fields": [
        { "fieldPath": "symbol", "order": "ASCENDING" },
        { "fieldPath": "details.status", "order": "ASCENDING" }
      ]
    }
    ```

By making our data structure, queries, and index definitions perfectly consistent, we created a robust and scalable pattern that Firestore can understand and optimize. This solved the `FAILED_PRECONDITION` error and made our real-time worker fully functional.