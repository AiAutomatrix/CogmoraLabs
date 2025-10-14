# Development Roadmap

This document outlines the phased development plan for the Cogmora Labs application, breaking down future work into logical and manageable stages.

---

## Phase 1: Enhance Core User Experience & AI

**Goal:** Refine the existing features to be more user-friendly, robust, and intelligent.

-   **[UX] User Onboarding:**
    -   Implement a welcome modal or a brief guided tour for first-time users.
    -   Add helpful "empty state" messages to the watchlist and positions tables to guide users on how to populate them.
    -   Increase the use of tooltips on less obvious UI elements.

-   **[AI] "Super Agent" Implementation (CRUD Operations):**
    -   Evolve the `proposeTradeTriggersFlow` into a state-aware agent.
    -   The agent will now receive `activeTriggers` in addition to the `watchlist`.
    -   The agent's output will be a "plan" containing a mix of `CREATE`, `UPDATE`, and `CANCEL` actions for trade triggers.
    -   The `AiPaperTradingChat` UI will be updated to display this plan and allow users to approve or decline each action individually.

-   **[Feature] Chart Enhancements:**
    -   Investigate using the TradingView Advanced Charts library.
    -   **Goal:** Draw trade execution markers (buy/sell icons) and open position lines (entry price, SL/TP levels) directly on the charts.

-   **[Housekeeping] Code Refinements:**
    -   Continue to refactor large components and hooks for better separation of concerns.
    -   Ensure all new features are covered by documentation.

---

## Phase 2: User Accounts & Backend Integration

**Goal:** Transition from a client-side, `localStorage`-based application to a full-fledged SaaS platform with user accounts.

-   **[Backend] Authentication:**
    -   Integrate Firebase Authentication for social (Google, etc.) and email/password sign-in.
    -   Create protected routes and a user profile page.

-   **[Backend] Database Integration (Firestore):**
    -   Create a database schema to store user-specific data.
    -   Migrate the entire `PaperTradingContext` state (`balance`, `openPositions`, `tradeHistory`, `watchlist`, `triggers`, `automationConfig`, `aiSettings`) from `localStorage` to Firestore.
    -   Refactor the `PaperTradingContext` to read from and write to Firestore in real-time.

-   **[Feature] Persistent Notifications:**
    -   Leverage the backend to enable more robust notifications.
    -   Implement email or push notifications for price alerts and trigger executions.

---

## Phase 3: Monetization & Pro Features

**Goal:** Introduce premium, subscription-based features to create a sustainable business model.

-   **[Business] Subscription Tiers (Freemium Model):**
    -   **Free Tier:** Includes all features from Phase 1, but with data stored locally (the original `localStorage` implementation). Limited number of AI analysis runs per day.
    -   **Premium Tier:** Unlocks all Phase 2 features (cloud-synced account) plus new Pro features.

-   **[Pro Feature] Advanced Backtesting Engine:**
    -   Develop a system that allows users to run their trigger configurations and AI agent settings against historical market data to see how they would have performed.

-   **[Pro Feature] Social & Community Tools:**
    -   Implement "read-only" shared portfolios, allowing users to follow the paper trading accounts of approved "Pro" users or community leaders.
    -   Develop a dashboard for these Pro users to manage their shared profile.

-   **[Pro Feature] Expanded AI Capabilities:**
    -   Create new, specialized AI agents (e.g., a "Risk Management Agent" that suggests SL/TP adjustments, a "Pattern Recognition Agent" that analyzes chart patterns).
    -   Increase the number of available AI analysis runs.

---

## Phase 4: Expansion & Ecosystem

**Goal:** Grow beyond the core application into a wider trading ecosystem.

-   **[Expansion] Broader Exchange Support:**
    -   Integrate WebSocket and API data from other major exchanges (e.g., Binance, Coinbase).
    -   Abstract the paper trading engine to handle data from multiple sources.

-   **[Ecosystem] API for Developers:**
    -   Expose some of the platform's capabilities (like the AI analysis flows) via a documented, public-facing API for other developers to use.

-   **[Feature] Mobile App:**
    -   Develop a native mobile application (React Native) that hooks into the existing Firebase backend for a seamless cross-platform experience.
