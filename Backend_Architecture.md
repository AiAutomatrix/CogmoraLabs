
# Backend Architecture Plan: Autonomous Trading Engine

This document outlines the architecture for the backend systems that power the autonomous paper trading, analysis, and automation features of Cogmora Labs. The goal is to create a 24/7, server-side system that operates independently of the user's client application.

The backend is divided into two distinct, cooperative parts:

1.  **Scheduled & Event-Driven Logic (Cloud Functions)**: Handles periodic tasks and ensures reliable, atomic database operations. This is for tasks that can tolerate a slight delay.
2.  **Real-Time Trigger Execution (Cloud Run)**: Handles instantaneous execution of triggers by maintaining persistent, 24/7 WebSocket connections. This is for tasks that must happen in milliseconds.

---

## Part 1: Scheduled & Event-Driven Functions (Implemented)

This is the foundational backend system responsible for scheduled automation and reliable database transactions.

-   **Technology**: **Cloud Functions for Firebase**
-   **Key Responsibilities**:
    -   Running the AI Trading Agent on a schedule.
    -   Running the Watchlist Scraper on a schedule.
    -   Securely and atomically closing trade positions.

### Data Flow:
1.  **User (Frontend)**: Sets a schedule or configuration (e.g., "Run AI every 15 minutes") in the UI. This intent is written to their user profile in Firestore.
2.  **Cloud Scheduler**: On its defined interval (e.g., every minute), it triggers our main `mainScheduler` Cloud Function.
3.  **`mainScheduler` Cloud Function (Backend)**:
    -   Wakes up and queries the `users` collection in Firestore for all tasks that are due.
    -   For due **AI tasks**, it invokes the `proposeTradeTriggers` Genkit flow and writes the resulting plan to the user's Firestore document.
    -   For due **watchlist tasks**, it performs the scraping logic and updates the user's `watchlist` subcollection.
    -   Updates the `nextRun` or `lastRun` timestamp for the next cycle.
4.  **`closePositionHandler` Cloud Function (Backend)**:
    -   This function is triggered by a Firestore `onWrite` event whenever an `openPosition` document has its status changed to `'closing'`.
    -   It performs the final P&L calculation and atomically updates the user's `balance`, deletes the open position, and updates the `tradeHistory` record. This guarantees data integrity.

---

## Part 2: Persistent WebSocket Worker for Real-Time Triggers (Future Vision)

This component is the **next architectural step** and is required for instant, real-time execution of SL/TP and conditional orders.

-   **Technology**: **Google Cloud Run** (with `--min-instances=1`)
-   **Key Responsibilities**:
    -   Maintaining persistent, 24/7 WebSocket connections to both KuCoin Spot and Futures feeds.
    -   Executing `tradeTriggers` and SL/TP orders the moment a price condition is met.

### Data Flow:
1.  **Initialization**: The Cloud Run service starts and maintains two live WebSocket connections. It periodically queries Firestore to know which symbols to subscribe to across all users.
2.  **Receive Price Tick**: The service receives a price update from either the spot or futures WebSocket.
3.  **Query & Check**: It instantly queries Firestore for all `tradeTriggers` and `openPositions` (across all users) that match the incoming symbol. It checks if any price conditions are met.
4.  **Take Action**:
    -   If a SL/TP is hit, it updates the `openPosition`'s status to `'closing'`, which in turn activates our already-built `closePositionHandler` function.
    -   If a conditional trigger is met, it directly executes the trade by creating the new position and history records in Firestore.

This two-part backend architecture (event-driven functions + a persistent worker) is the standard and most robust design for this kind of application.
