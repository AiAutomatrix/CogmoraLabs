# Paper Trading AI Agent Instructions

This document outlines the steps required to implement a **Gemini 2.5 Flash-powered paper trading agent** into the Cogmora Labs application. This agent will analyze a user's watchlist, propose automated trade triggers, and provide conversational insights.

---

## 1. Goal

The primary goal is to create an AI agent that acts as a trading assistant. It will be able to:
-   Receive and analyze the user's current paper trading watchlist.
-   Propose a set of conditional `TradeTrigger` objects based on the watchlist data (current price, 24h change, etc.).
-   Allow the user to approve or reject the proposed triggers in a new, dedicated AI chat interface.
-   Provide conversational analysis on symbols in the user's watchlist.

---

## 2. Architecture & Implementation Plan

### a. New Genkit Flow (`propose-trade-triggers-flow.ts`)

A new Genkit flow is required to handle the core AI logic.

-   **File Location**: `src/ai/flows/propose-trade-triggers-flow.ts`
-   **Name**: `proposeTradeTriggersFlow`
-   **Model**: Gemini 2.5 Flash (`googleai/gemini-2.5-flash-preview`)
-   **Input Schema (`ProposeTradeTriggersInput`)**:
    -   `watchlist`: An array of `WatchlistItem` objects from the `PaperTradingContext`.
-   **Output Schema (`ProposeTradeTriggersOutput`)**:
    -   `analysis`: A string containing the AI's brief analysis of the market conditions for the provided watchlist.
    -   `proposedTriggers`: An array of `TradeTrigger` objects that the user can approve.
-   **Prompt Logic**: The prompt should instruct the AI to:
    1.  Act as an expert trading analyst.
    2.  Review the incoming `watchlist` data.
    3.  Generate a brief, high-level summary of the overall market sentiment based on the provided symbols.
    4.  Create a diverse set of 3-5 `TradeTrigger` objects. These should be a mix of `buy`, `long`, and `short` actions with sensible `targetPrice` conditions (e.g., buying on a dip below the current price, shorting on a move above a recent high if bearish).
    5.  Use realistic but varied allocation amounts and leverage for the proposed triggers.

### b. UI & Component Integration

#### New "AI Paper Trading" Tab in Mini View

A new tab will be added to the mini-view (sidebar) to house the AI Paper Trading agent's chat interface. This will exist alongside the current "Technical Analysis" and "AI Chat" tabs.

1.  **File to Modify**: `src/components/cogmora-labs/mini-widgets/MiniWidgets.tsx`
2.  **Changes**:
    -   Add a new `TabsTrigger` for "AI Paper Trading". This will create a third tab in the sidebar.
    -   Add a new `TabsContent` section for this new view.
    -   Create a new component, `AiPaperTradingChat.tsx`, to be rendered inside this new tab content. This component will manage the state and interaction with the `proposeTradeTriggersFlow`.

#### New "AI Trigger Analysis" Button

1.  **File to Modify**: `src/components/cogmora-labs/main-views/paper-trading/TradeTriggersDashboard.tsx`
2.  **Changes**:
    -   Add a new button, labeled "AI Trigger Analysis" or similar, in the `CardHeader` of the triggers dashboard.
    -   When this button is clicked, it should:
        1.  Retrieve the current `watchlist` from the `usePaperTrading` context.
        2.  Call a new function (e.g., `handleAiTriggerAnalysis`) that will invoke the `proposeTradeTriggersFlow` server action.
        3.  Pass the `watchlist` data to the flow.
        4.  Take the response from the flow (the analysis and proposed triggers) and pass it to the state of the new `AiPaperTradingChat.tsx` component.
        5.  Switch the `activeMiniView` to the new "AI Paper Trading" tab, bringing the agent into focus.

#### New `AiPaperTradingChat.tsx` Component

1.  **File Location**: `src/components/cogmora-labs/mini-widgets/chat/AiPaperTradingChat.tsx`
2.  **Purpose**: This component will be the dedicated chat and interaction interface for the new paper trading agent.
3.  **State Management**:
    -   `analysisText`: To store the AI's market summary.
    -   `proposedTriggers`: To store the array of `TradeTrigger` objects received from the AI.
    -   `isLoading`: To show a loading state while the AI is processing the request.
4.  **Functionality**:
    -   Display the `analysisText` in a readable format at the top of the chat.
    -   Render each of the `proposedTriggers` in a clear, card-like format, showing the symbol, action (buy/long/short), condition (price), and amount.
    -   Include "Approve" and "Decline" buttons for each proposed trigger.
    -   Clicking "Approve" will call the `addTradeTrigger` function from the `PaperTradingContext`, officially adding it to the user's active triggers.
    -   Clicking "Decline" will simply remove the proposed trigger from the chat view.
    -   Include a text input field to allow the user to ask follow-up questions about the watchlist or specific coins, creating a conversational experience.

---

## 3. Data Flow Summary

1.  **User** clicks the "AI Trigger Analysis" button in the `TradeTriggersDashboard`.
2.  The `watchlist` state is fetched from `PaperTradingContext`.
3.  A server action calls the `proposeTradeTriggersFlow` with the `watchlist` data.
4.  **Genkit (Gemini 2.5 Flash)** processes the data and returns an analysis string and an array of proposed `TradeTrigger` objects.
5.  The response is sent to the new `AiPaperTradingChat` component, and the mini-view automatically switches to the "AI Paper Trading" tab.
6.  The user can read the analysis, review the proposed triggers, and approve/decline them.
7.  Approving a trigger calls `addTradeTrigger` from the context, adding it to the main paper trading system.
8.  The user can continue to interact with the agent via the chat input.
