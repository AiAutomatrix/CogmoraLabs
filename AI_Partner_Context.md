# AI Partner Context & Onboarding

Hello, future me. This document is a "snapshot" of the Cogmora Labs project to provide you with immediate context and get you up to speed if your memory has been reset. Read this to understand the project's core, our working dynamic, and key technical decisions.

## 1. Project Goal & Vision

**Cogmora Labs** is an AI-powered cryptocurrency analysis and paper trading platform. The primary user is a retail trader who wants to test strategies and get market insights without risking real money.

The vision is to evolve this from a client-side simulator into a full-fledged, cloud-synced SaaS application with premium, AI-driven features. The user and I are building a sophisticated tool, not just a simple dashboard.

## 2. Our Working Relationship

-   **The User is the Architect:** The user provides the high-level vision, feature requests, and architectural direction. Your role is to be the highly skilled **prototyping partner** who implements this vision.
-   **Collaborative & Iterative:** We work in a conversational loop. You propose changes, explain your reasoning, and the user provides feedback. Expect to make mistakes and refactor—it's part of the process.
-   **Documentation is Key:** The user values clear, up-to-date documentation. We maintain a suite of `.md` files that you MUST review and update as the codebase changes. This is non-negotiable.

## 3. Core Architecture: The "Golden Trio"

This application stands on three pillars. Understanding them is critical.

### a. `PaperTradingContext.tsx`
-   **What it is:** The heart, brain, and soul of the entire application. It's a massive, client-side React Context that manages EVERYTHING related to paper trading.
-   **Responsibilities:** Virtual balance, open positions (spot & futures), trade history, watchlist, price alerts, conditional trade triggers, and all automation settings (for both the watchlist scraper and the AI agent).
-   **Data Flow:** It persists its entire state to the browser's `localStorage` on every change. This makes the app feel incredibly fast and work offline.
-   **Why it's important:** Any change related to trading logic, position management, or automation almost certainly involves modifying this file. Be extremely careful when editing it.

### b. WebSocket Connections (Managed within `PaperTradingContext`)
-   **What it is:** The app maintains live, persistent WebSocket connections to KuCoin's public spot and futures feeds.
-   **How it works:** The context dynamically subscribes and unsubscribes to market data streams based on what's in the user's `openPositions` and `watchlist`. The `processUpdate` function is the entry point for all incoming price data.
-   **Why it's important:** This is what makes the app "live." It drives all real-time P&L calculations, chart updates, and trigger executions.

### c. Genkit AI Flows (`src/ai/flows/`)
-   **What it is:** We use Google's Genkit framework for all AI functionality. The key flow is `propose-trade-triggers-flow.ts`.
-   **How it works:** The AI is not just a chatbot. It's a **stateful agent**. It receives the user's current `watchlist` and `activeTriggers` as input. Its job is to analyze this context and return a structured JSON "plan" containing `CREATE`, `UPDATE`, and `CANCEL` actions.
-   **Why it's important:** This is our most advanced feature. The AI's ability to reason about the user's existing setup is its key differentiator. When working on the AI, focus on improving the prompt to generate more reliable and strategic JSON output.

## 4. Key Technical Decisions & Guidelines

-   **Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS, ShadCN UI, Genkit. Do not deviate from this stack.
-   **UI:** Build with ShadCN components. Create a professional, modern, and clean aesthetic.
-   **State:** The `PaperTradingContext` is the primary state manager. The main dashboard page (`src/app/dashboard/page.tsx`) holds UI state (like active views) and passes it down.
-   **Data Fetching:**
    -   Use Next.js API Routes (`src/app/api/`) as simple proxies for external APIs (like KuCoin's token endpoints).
    -   Use Server Actions (`src/app/actions/`) for client-side calls to external services (like DexScreener).
-   **Development Environment:** The user works in a Cloud Workstation. "Failed to fetch RSC payload" or CORS errors are common. The fix is almost always to add the correct development URL to `allowedDevOrigins` in `next.config.ts`.

## 5. Your Immediate Priorities (If you are new)

1.  **Read all `.md` files** in the root directory. They are your primary source of truth.
2.  **Familiarize yourself with `PaperTradingContext.tsx`**. You cannot contribute effectively without understanding this file.
3.  **Review `propose-trade-triggers-flow.ts`**. Understand how the AI agent works and how it uses tools to generate its action plan.
4.  **Ask for clarification.** If anything is unclear, ask the user. Our partnership thrives on clear communication.

Welcome (back). Let's get to building.
