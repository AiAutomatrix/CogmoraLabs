# Components Documentation

This document provides details on each component used in the Cogmora Labs application.

---

## Main View Components (`/src/components/cogmora-labs/main-views/`)

### `MainViews.tsx`
- **Purpose**: The central component for the main content area. It manages the layout and content for the different views using a `Tabs` and `DropdownMenu` system.
- **Props**:
    - `currentSymbol: string`: The active cryptocurrency symbol to be displayed in charts.
    - `selectedCryptoScreener: string`: The key for the currently selected crypto screener.
    - `setSelectedCryptoScreener: (screener: string) => void`: Callback to change the active crypto screener.
- **Usage**: Used directly in `src/app/page.tsx`.

### `ThreeChartAnalysisPanel.tsx`
- **Purpose**: A placeholder panel intended to show a combined analysis of three active charts.
- **Props**: None.
- **Usage**: Rendered in `MainViews.tsx` when the '3 Charts + Analysis' layout is selected.

### `TradingViewChartWidget.tsx`
- **Purpose**: A wrapper component that loads the TradingView charting library script and renders an advanced chart widget. It handles widget creation and cleanup.
- **Props**:
    - `symbol?: string`: The trading symbol to display (e.g., "BINANCE:BTCUSDT").
    - `containerClass?: string`: CSS classes for the container `div`.
- **Usage**: *This component appears to be unused in favor of direct iframe embedding in `MainViews.tsx` for better performance and configuration management.*

### `TradingViewEmbedWidget.tsx`
- **Purpose**: A generic wrapper for embedding TradingView widgets that use an external script with a JSON configuration object.
- **Props**:
    - `scriptSrc: string`: The URL of the TradingView embedding script.
    - `config: object`: The JSON configuration for the widget.
    - `containerClass?: string`: CSS classes for the container `div`.
- **Usage**: *Currently unused.* The app favors `iframe` with `srcDoc` for embedding widgets.

### Heatmap Components (`/heatmaps/`)
These components render specific TradingView heatmap widgets inside an `iframe`.
- `CryptoCoinsHeatmap.tsx`
- `EtfHeatmap.tsx`
- `StockHeatmap.tsx`
- `ForexCrossRatesWidget.tsx`
- `ForexHeatmapWidget.tsx`
- **Props**: Each accepts `tvWidgetBaseStyle: string` and `WIDGET_CONTAINER_CLASS: string`.
- **Usage**: Dynamically rendered within `MainViews.tsx` based on user selection.

### Screener Components (`/screeners/`)

#### `DexScreenerContent.tsx`
- **Purpose**: A comprehensive UI for interacting with the DexScreener API. It allows users to view latest token profiles, boosts, and search for token pairs. It handles fetching data via server actions, manages loading/error states, and displays data in tables with interactive dialogs for details.
- **Props**: None.
- **Usage**: Rendered in `MainViews.tsx` under the "DEX" tab.

#### `AllTickersScreener.tsx`
- **Purpose**: Displays a sortable table of all USDT spot tickers from KuCoin. It fetches data using the `useKucoinTickers` hook.
- **Props**: None.
- **Usage**: Rendered in `MainViews.tsx` under the "Crypto" tab when "Kucoin Spot" is selected.

#### `AllFuturesScreener.tsx`
- **Purpose**: Displays a sortable table of KuCoin futures contracts. It fetches data using the `useKucoinFuturesContracts` hook.
- **Props**: None.
- **Usage**: Rendered in `MainViews.tsx` under the "Crypto" tab when "Kucoin Futures" is selected.

---

## Mini View Components (`/src/components/cogmora-labs/mini-widgets/`)

### `MiniWidgets.tsx`
- **Purpose**: The main component for the sidebar/mini-view area. It uses a `Tabs` component to switch between different widgets.
- **Props**:
    - `currentSymbol: string`: The active symbol, passed down to child widgets.
    - `onSymbolChange: (symbol: string) => void`: A callback to update the symbol in the parent component.
- **Usage**: Used directly in `src/app/page.tsx`.

### `AiWebchat.tsx`
- **Purpose**: Renders the Botpress AI chat client inside an `iframe` using `srcDoc` for a sandboxed environment.
- **Props**: None.
- **Usage**: Rendered in a tab within `MiniWidgets.tsx`.

### `TradingViewTechAnalysisWidget.tsx`
- **Purpose**: Displays the TradingView Technical Analysis widget, which provides a gauge-based summary for a given symbol.
- **Props**:
    - `symbol: string`: The symbol to analyze.
- **Usage**: Rendered in a tab within `MiniWidgets.tsx`. *Note: The component is currently hardcoded to "KUCOIN:BTCUSDT" and does not use the passed-in `symbol` prop.*
