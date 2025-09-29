# Paper Trading System Documentation

This document outlines the architecture and functionality of the paper trading feature within the Cogmora Labs application. It enables users to simulate both spot and leveraged futures cryptocurrency trades using live market data from KuCoin without risking real money.

## Core Architecture: The `PaperTradingContext`

The entire paper trading engine is a self-contained, client-side system built using React's Context API. This approach centralizes state management and logic, making the system responsive and persistent across browser sessions.

- **`PaperTradingContext.tsx`**: This file is the heart and brain of the entire system. It is a React Context provider that manages:
  -   **Virtual Account**: Tracks the user's cash `balance`. New users start with a default of **$100,000**.
  -   **State Management**: Holds the state for `openPositions` (both spot and futures) and the complete `tradeHistory`.
  -   **Trade Execution**: Contains the core logic for all trade functions: `buy` (for spot), `futuresBuy` (for long futures), `futuresSell` (for short futures), and `closePosition`.
  -   **WebSocket Connections**: **Crucially, the context itself manages the live WebSocket connections** to KuCoin for both spot and futures price feeds, ensuring real-time data is piped directly into the state.
- **Local Storage Persistence**: The entire state of the paper trading account (balance, positions, and history) is automatically serialized and saved to the browser's `localStorage` whenever it changes. This ensures a user's portfolio and trade log are preserved between visits.

## Real-Time Data Flow via WebSockets

To provide a live trading experience, the system establishes and maintains direct WebSocket connections to KuCoin's public feeds. This logic is managed entirely within `PaperTradingContext.tsx`.

1.  **Connection Management**: The context manages two independent WebSocket instances:
    -   A **Spot WebSocket** that subscribes to the `/market/snapshot:{symbol}` topic for all currently open spot positions.
    -   A **Futures WebSocket** that subscribes to the `/contractMarket/snapshot:{symbol}` topic for all open futures positions.
2.  **Dynamic Subscriptions**: The context is intelligent. When a new position is opened (or an item is added to the watchlist), it subscribes to that specific symbol's feed. When a position is closed (or removed from the watchlist), it unsubscribes, keeping the connections efficient and minimizing data overhead.
3.  **Live Price Updates**: The `onmessage` event handlers for both WebSockets listen for new price data.
4.  **`processUpdate` Function**: When a new price is received, this utility function is called. It iterates through the `openPositions` and `watchlist` arrays, finds the matching item by its symbol, and updates its `currentPrice`, `high`, `low`, and `priceChgPct`. It then instantly recalculates the `unrealizedPnl` for any open positions.
5.  **Reactive UI**: Because `openPositions` and `watchlist` are state variables, this update automatically triggers a re-render in the `PaperTradingDashboard`, ensuring all metrics—especially Unrealized P&L—are always live.

## Trade Execution Flow

### Spot Trading
1.  **Initiation**: User clicks the **Buy** (<ShoppingCart /> icon) button in the `AllTickersScreener.tsx` component.
2.  **Input**: The `TradePopup.tsx` modal appears, asking the user for a USD allocation amount.
3.  **Execution**: Upon confirmation, the `buy` function in the context is called. It subtracts the allocation from the balance, creates a new `OpenPosition` with `positionType: 'spot'`, and logs the transaction in `tradeHistory`.

### Futures Trading (Leveraged)
1.  **Initiation**: User clicks the **Trade** (<BarChartHorizontal /> icon) button in the `AllFuturesScreener.tsx` component.
2.  **Input**: The `FuturesTradePopup.tsx` modal appears, which prompts for **collateral allocation** (USD) and desired **leverage**.
3.  **Execution**: The user chooses to **"Buy / Long"** or **"Sell / Short"**. This calls either `futuresBuy` or `futuresSell` from the context. The collateral is subtracted from the balance, and a new `OpenPosition` is created with `positionType: 'futures'`, the specified `side` ('long' or 'short'), and the chosen `leverage`.

## Position Closing
-   **Manual Close**: Each row in the "Open Positions" table has a "Close" button. Clicking this calls the `closePosition` function with the unique `positionId`.
-   **`closePosition` Logic**: This function calculates the final P&L based on the position type (spot vs. futures, long vs. short). The proceeds (initial value +/- P&L) are added back to the cash `balance`, the position is removed from `openPositions`, and the trade is logged as "closed" in the `tradeHistory`.

## Component Relationships

-   **`PaperTradingProvider`**: Wraps the main application in `page.tsx` to provide the context.
-   **`PaperTradingDashboard.tsx`**: The primary UI. Consumes all data from the `usePaperTrading` hook to display metrics, open positions, and history. Contains "Close All" and "Clear History" buttons.
-   **`AllTickersScreener.tsx`**: Originates spot trades.
-   **`AllFuturesScreener.tsx`**: Originates futures trades.
-   **`TradePopup.tsx` & `FuturesTradePopup.tsx`**: Modals for entering and confirming trades.
-   **`PaperTradingContext.tsx`**: The central engine that drives all functionality described above.