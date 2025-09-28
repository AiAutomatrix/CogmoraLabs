# Unused Components

This file lists components that are present in the project but do not appear to be actively used in the main or mini views of the application.

---

### `/src/components/tradeflow/main-views/BlogContent.tsx`

- **Description**: A component designed to display a series of blog posts, each with a title, image, and snippet. It currently contains hardcoded placeholder content.
- **Status**: Not imported or rendered in `MainViews.tsx` or any other active component.

---

### `/src/components/tradeflow/main-views/DashboardContent.tsx`

- **Description**: A dashboard component that displays summary statistics (e.g., Active Trades, Open P&L), a risk alert, and a placeholder for a portfolio distribution chart.
- **Status**: Not imported or rendered in `MainViews.tsx`.

---

### `/src/components/tradeflow/mini-widgets/TechWidgetContent.tsx`

- **Description**: A widget intended to show technical system status, such as API latency and server load. It includes placeholder metrics and a chart.
- **Status**: Not imported or rendered in `MiniWidgets.tsx`. It was likely replaced by `TradingViewTechAnalysisWidget`.

---

### `/src/components/tradeflow/mini-widgets/TradeTracker.tsx`

- **Description**: A fully functional form and table for tracking cryptocurrency trades. It uses `react-hook-form` for validation and persists trade data to the browser's local storage.
- **Status**: Not currently imported or rendered in `MiniWidgets.tsx`, though it is a complete feature.

---

### `/src/components/tradeflow/TradeFlowLogo.tsx`

- **Description**: A simple component that displays the application's logo and name, "TradeFlow".
- **Status**: Commented out in `src/app/page.tsx`. Not currently visible in the UI.

---

### `/src/components/tradeflow/mini-widgets/exchange-panels/`

This directory contains several trade panel simulations for different exchanges. None of them are currently integrated into the main UI.

- **`KucoinTradePanel.tsx`**: A form for simulating the placement of spot and futures orders on Kucoin.
- **`RaydiumTradePanel.tsx`**: A form for simulating spot trades on the Raydium DEX.
- **`PumpswapTradePanel.tsx`**: A form for simulating trades on Pumpswap.

---
### Deprecated/Removed DEX Screener Components

The following files were part of a previous implementation of the DEX Screener and are no longer used. Their functionality has been consolidated into `DexScreenerContent.tsx`.

- `src/components/tradeflow/main-views/dex-screener/LatestBoostedTokensView.tsx`
- `src/components/tradeflow/main-views/dex-screener/LatestTokenProfilesView.tsx`
- `src/components/tradeflow/main-views/dex-screener/TopBoostedTokensView.tsx`
- `src/components/tradeflow/main-views/dex-screener/TokenBoostCard.tsx`
- `src/components/tradeflow/main-views/dex-screener/TokenProfileCard.tsx`
- `src/components/tradeflow/main-views/LiveOpportunitiesDashboard.tsx`
