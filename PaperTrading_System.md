# Paper Trading System Documentation

This document outlines the architecture and functionality of the paper trading feature within the Cogmora Labs application. It enables users to simulate both spot and leveraged futures cryptocurrency trades using live market data from KuCoin without risking real money.

## Core Architecture: The `PaperTradingContext`

The entire paper trading engine is a self-contained, client-side system built using React's Context API. This approach centralizes state management and logic, making the system responsive and persistent across browser sessions.

- **`PaperTradingContext.tsx`**: This file is the heart and brain of the entire system. It is a React Context provider that manages:
  -   **Virtual Account**: Tracks the user's cash `balance`. New users start with a default of **$100,000**.
  -   **State Management**: Holds the state for `openPositions` (spot & futures), `tradeHistory`, the `watchlist`, `priceAlerts`, `tradeTriggers`, and the `automationConfig`.
  -   **Trade Execution**: Contains the core logic for all trade functions: `buy`, `futuresBuy`, `futuresSell`, and `closePosition`.
  -   **WebSocket Connections**: Manages live WebSocket connections to KuCoin for both spot and futures price feeds, ensuring real-time data is piped directly into the state.
- **Local Storage Persistence**: The entire state of the paper trading account (balance, positions, history, watchlist, etc.) is automatically serialized and saved to the browser's `localStorage` whenever it changes.

## Real-Time Data Flow via WebSockets

To provide a live trading experience, the system establishes and maintains direct WebSocket connections to KuCoin's public feeds. This logic is managed entirely within `PaperTradingContext.tsx`.

1.  **Connection Management**: The context manages two independent WebSocket instances:
    -   A **Spot WebSocket** that subscribes to the `/market/snapshot:{symbol}` topic.
    -   A **Futures WebSocket** that subscribes to the `/contractMarket/snapshot:{symbol}` topic.
2.  **Dynamic Subscriptions**: The context is intelligent. When a new position is opened, an item is added to the watchlist, or a trade trigger is set, it adds the required symbol to a subscription list. When no longer needed, it unsubscribes to keep connections efficient.
3.  **Live Price Updates**: The `onmessage` event handlers for both WebSockets listen for new price data.
4.  **`processUpdate` Function**: When a new price is received, this utility function is called. It iterates through `openPositions` and `watchlist`, finds the matching item, and updates its `currentPrice`, `priceChgPct`, etc. It also checks if any price alerts or trade triggers have been met.
5.  **Reactive UI**: Because all data is held in React state, any update from the WebSocket automatically triggers a re-render in the UI, ensuring all metrics are always live.

## Trade Execution Flow

### Spot Trading
1.  **Initiation**: User clicks the "Buy" (<ShoppingCart/>) button in the `AllTickersScreener.tsx`.
2.  **Input**: The `TradePopup.tsx` modal appears, asking for a USD allocation.
3.  **Execution**: Upon confirmation, the `buy` function in the context is called. It subtracts the allocation from the balance, creates/updates a spot `OpenPosition`, and logs the transaction.

### Futures Trading (Leveraged)
1.  **Initiation**: User clicks the "Trade" (<BarChartHorizontal/>) button in the `AllFuturesScreener.tsx`.
2.  **Input**: The `FuturesTradePopup.tsx` modal appears, prompting for **collateral** and **leverage**.
3.  **Execution**: The user chooses to "Buy / Long" or "Sell / Short," calling `futuresBuy` or `futuresSell`. The collateral is subtracted from the balance, and a new `OpenPosition` is created.

## Advanced Features

- **Price Alerts**: Users can set price targets on watchlist items. The context checks these alerts on every price update and fires a toast notification when a target is hit.
- **Trade Triggers**: Users can create conditional orders (e.g., "Buy 100 USD of BTC if price drops below $65,000"). These are stored in the context and executed automatically when the condition is met by the WebSocket price feed. Active triggers are displayed on the "Triggers" tab.
- **Watchlist Automation**: Users can configure rules in the `AutomateWatchlistPopup` to automatically scrape the KuCoin screeners and populate the watchlist based on criteria like "Top 10 by Volume." Active automations with a countdown timer also appear on the "Triggers" tab.
- **Stop Loss / Take Profit**: SL/TP levels can be attached to any open position. The context continuously monitors these and will automatically close the position if a level is breached.

## Component Relationships

-   **`PaperTradingProvider`**: Wraps the main application in `dashboard/page.tsx` to provide the context.
-   **`PaperTradingDashboard.tsx`**: The primary UI. Consumes all data from the `usePaperTrading` hook to display metrics, positions, triggers, watchlist, and history.
-   **`AllTickersScreener.tsx` & `AllFuturesScreener.tsx`**: Originate spot and futures trades.
-   **`Watchlist.tsx`**: Allows users to set up alerts and complex trade triggers.
-   **`TradePopup.tsx` & `FuturesTradePopup.tsx`**: Modals for entering and confirming trades.
