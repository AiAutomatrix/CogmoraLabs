# Components Documentation

This document provides details on each major component used in the Cogmora Labs application.

---

## Core Context

### `PaperTradingContext.tsx`
- **Purpose**: The central engine for the entire paper trading system. It is a self-contained client-side system that manages state and logic for spot and futures trading, the watchlist, price alerts, automated trade triggers, and all automation configurations.
- **State Management**: Uses React hooks (`useState`, `useEffect`, `useRef`, etc.) to manage the virtual `balance`, `openPositions`, `tradeHistory`, `watchlist`, `priceAlerts`, `tradeTriggers`, `automationConfig` (for the watchlist scraper), and `aiSettings` (for the AI agent).
- **Data Persistence**: Serializes its entire state to the browser's `localStorage`, ensuring all user data and settings are preserved across sessions.
- **WebSocket Handling**: Manages independent WebSocket connections to KuCoin's public spot and futures feeds. It dynamically subscribes and unsubscribes to symbols based on what's currently in the open positions, watchlist, or active triggers. It also manages the scheduling and execution of both the watchlist scraper and the AI agent automations.

---

## Main View Components (`/src/components/cogmora-labs/main-views/`)

### `MainViews.tsx`
- **Purpose**: The top-level component for the main content area. It uses a `Tabs` and `DropdownMenu` system to manage the layout and content for the different views.
- **Props**: Receives and passes down all major UI state from the `dashboard/page.tsx`, such as `activeView`, `currentSymbol`, `selectedChartLayout`, etc.
- **Usage**: Used directly in `src/app/dashboard/page.tsx`.

### Paper Trading Components (`/paper-trading/`)

#### `PaperTradingDashboard.tsx`
- **Purpose**: The main UI for the paper trading system. It consumes data from the `usePaperTrading` hook to display account metrics, open positions, and history.
- **Features**: Contains tabs for "Open Positions", "Triggers", "Watchlist", and "Trade History". It includes controls to close all positions or clear history.

#### `Watchlist.tsx`
- **Purpose**: Displays a user-curated list of symbols with live price data.
- **Features**: Allows users to add/remove symbols, set simple price alerts, and create complex conditional trade triggers via the `WatchlistTradeTriggerPopup`. It also provides a dropdown to configure the number of charts to load. The "Automate" button opens the `AutomateWatchlistPopup`.

#### `TradeTriggersDashboard.tsx`
- **Purpose**: A unified dashboard that displays all active conditional orders (`tradeTriggers`) and any scheduled automations.
- **Features**:
    - Shows a countdown timer for the next scheduled run of the Watchlist Scraper if it's enabled.
    - Shows a countdown timer for the next scheduled analysis run of the AI Agent if it's enabled.
    - Provides a "Run AI Now" button to manually trigger the AI agent.
    - Contains a settings button to open the `AiTriggerSettingsPopup`.

#### `FuturesTradePopup.tsx` & `TradePopup.tsx`
- **Purpose**: Dialogs for executing instant market orders for futures (leveraged) and spot paper trades, respectively. They collect user input for allocation/collateral and leverage.

#### `AutomateWatchlistPopup.tsx`
- **Purpose**: A dialog that allows users to configure rules to automatically scrape the KuCoin screeners and populate their watchlist based on criteria like top volume or price change. It can be set for a one-time scrape or a recurring auto-refresh.

---

## Mini View Components (`/src/components/cogmora-labs/mini-widgets/`)

### `MiniWidgets.tsx`
- **Purpose**: The main component for the sidebar/mini-view area. It uses a `Tabs` component to switch between different widgets.
- **Props**: Receives `currentSymbol`, `activeMiniView` and the AI agent's state from `dashboard/page.tsx`.

### `AiPaperTradingChat.tsx` (`/chat/`)
- **Purpose**: The dedicated UI for the advanced paper trading AI agent.
- **Functionality**: It does not contain a text input. Instead, it displays the AI's "plan of action" which consists of `CREATE`, `UPDATE`, and `CANCEL` trigger proposals. The user can approve or decline each proposed action.

### `AiWebchat.tsx` (`/chat/`)
- **Purpose**: Renders the Botpress AI chat client inside a sandboxed `iframe`, providing a general-purpose, conversational AI experience.

### `TradingViewTechAnalysisWidget.tsx` (`/analysis/`)
- **Purpose**: Displays the TradingView Technical Analysis widget, providing a gauge-based summary for the active symbol. It correctly updates when the `symbol` prop changes and is the default view when the user is on the "Chart" tab.
