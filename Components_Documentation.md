# Components Documentation

This document provides details on each component used in the Cogmora Labs application.

---

## Core Context

### `PaperTradingContext.tsx`
- **Purpose**: The central engine for the entire paper trading system. It is a self-contained client-side system that manages state and logic for spot and futures trading, the watchlist, price alerts, and automated trade triggers.
- **State Management**: Uses `useState`, `useEffect`, and `useRef` to manage the virtual balance, open positions, trade history, watchlist, alerts, triggers, and WebSocket connections.
- **Data Persistence**: Serializes all user paper trading data (balance, positions, history, watchlist, etc.) to the browser's `localStorage`, ensuring data continuity across sessions.
- **WebSocket Handling**: Manages independent WebSocket connections to KuCoin's public spot and futures feeds, subscribing and unsubscribing to symbols dynamically based on open positions and watchlist items.

---

## Main View Components (`/src/components/cogmora-labs/main-views/`)

### `MainViews.tsx`
- **Purpose**: The central component for the main content area. It manages the layout and content for the different views using a `Tabs` and `DropdownMenu` system.
- **Props**:
    - `activeView/setActiveView`: To control the currently visible tab.
    - `currentSymbol/onSymbolSelect`: To manage the active trading symbol.
    - `selectedChartLayout/setSelectedChartLayout`: To control the multi-chart layout.
    - `selectedCryptoScreener`, `selectedHeatmapView`: To manage sub-views within the main tabs.
- **Usage**: Used directly in `src/app/dashboard/page.tsx`.

### Paper Trading Components (`/paper-trading/`)

#### `PaperTradingDashboard.tsx`
- **Purpose**: The main UI for the paper trading system. It consumes data from the `PaperTradingContext` to display account metrics, open positions, and history.
- **Features**: Contains tabs for "Open Positions", "Triggers", "Watchlist", and "Trade History". Includes controls to close all positions or clear history.

#### `Watchlist.tsx`
- **Purpose**: Displays a user-curated list of symbols with live price data.
- **Features**: Allows users to add/remove symbols, set price alerts, create complex trade triggers (`WatchlistTradeTriggerPopup`), and launch symbols directly into the main chart view. It now includes the chart layout settings dropdown.

#### `TradeTriggersDashboard.tsx`
- **Purpose**: Displays all active conditional orders (triggers) and any active watchlist automations, including a countdown timer for scheduled scrapes.

#### `FuturesTradePopup.tsx` & `TradePopup.tsx`
- **Purpose**: Dialogs for executing futures (leveraged) and spot paper trades, respectively. They collect user input for allocation/collateral and leverage.

#### `AutomateWatchlistPopup.tsx`
- **Purpose**: A dialog that allows users to configure rules to automatically scrape the KuCoin screeners and populate their watchlist based on criteria like top volume or price change.

### Screener Components (`/screeners/`)

#### `AllTickersScreener.tsx` & `AllFuturesScreener.tsx`
- **Purpose**: Custom-built screeners for KuCoin spot and futures markets. They use dedicated hooks (`useKucoinTickers`, `useKucoinFuturesContracts`) to fetch initial data via API routes and then connect to WebSockets for live updates.
- **Features**: Include sortable columns, a search filter, and action buttons to trade, watch, or load a symbol into the chart view.

#### `DexScreenerContent.tsx`
- **Purpose**: A comprehensive UI for interacting with the DexScreener API. It allows users to view latest token profiles, boosts, and search for token pairs.

---

## Mini View Components (`/src/components/cogmora-labs/mini-widgets/`)

### `MiniWidgets.tsx`
- **Purpose**: The main component for the sidebar/mini-view area. It uses a `Tabs` component to switch between different widgets.
- **Props**: `currentSymbol` and `onSymbolChange` to stay in sync with the main view.

### `AiWebchat.tsx` (`/chat/`)
- **Purpose**: Renders the Botpress AI chat client inside a sandboxed `iframe`, providing a seamless and integrated chat experience.

### `TradingViewTechAnalysisWidget.tsx` (`/analysis/`)
- **Purpose**: Displays the TradingView Technical Analysis widget, providing a gauge-based summary for the active symbol. It correctly updates when the `symbol` prop changes.
