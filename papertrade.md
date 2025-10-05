# Instruction Doc for IDE Agent – Paper Trading Dashboard

## Goal
Integrate a **paper trading engine** into the Cogmora Labs app. Users should be able to simulate spot and leveraged futures trades using KuCoin market data in real time. The system must include UI components for trade entry and a live-updating dashboard that tracks performance.

---

## Completed Tasks

### 1. Paper Trading Engine
- **`PaperTradingContext.tsx`** has been created.
  - It manages a user's virtual account balance (defaulting to $100,000).
  - It handles **buy** (spot), **futuresBuy** (long), and **futuresSell** (short) orders.
  - It records trades in `tradeHistory` and tracks `openPositions`.
  - It subscribes to KuCoin WebSocket streams for live price updates.
  - All state is persisted to `localStorage`.

### 2. Screeners Integration
- In the `AllTickersScreener.tsx` (KuCoin Spot):
  - A **Buy Button** (<ShoppingCart/>) has been added to each coin.
  - Clicking it opens the `TradePopup` modal, which asks for a USD allocation and executes the trade.
- In the `AllFuturesScreener.tsx`:
  - A **Trade Button** (<BarChartHorizontal/>) has been added.
  - Clicking it opens the `FuturesTradePopup`, which collects collateral and leverage input.

### 3. Paper Trading Dashboard
- **`PaperTradingDashboard.tsx`** has been created and integrated.
  - **Account Metrics**: Displays live Equity, Available Cash, Unrealized P&L, Realized P&L, and Win Rate.
  - **Open Positions Table**: Shows all active spot and futures positions with live Unrealized P&L.
  - **Triggers Table**: Shows all active conditional trade triggers and watchlist automations.
  - **Watchlist**: Allows users to track symbols, set price alerts, and create trade triggers.
  - **Trade History Table**: Logs all closed trades with their final P&L.

### 4. Component Structure
- `TradePopup.tsx` & `FuturesTradePopup.tsx`: Modals for trade entry.
- `PaperTradingDashboard.tsx`: Main dashboard view.
- `Watchlist.tsx`, `TradeTriggersDashboard.tsx`: Sub-components within the dashboard.
- `PaperTradingContext.tsx`: Central provider for all paper trading state and logic.

### 5. WebSocket Integration
- The `PaperTradingContext` connects to KuCoin WebSockets for both spot and futures.
- It dynamically subscribes/unsubscribes to symbols based on open positions and watchlist items.
- It updates all positions and watchlist items in real-time.

### 6. Documentation
- `PaperTrading_System.md`, `Spot_Paper_Trading.md`, and `Futures_Paper_Trading.md` have been generated and updated to reflect the system's architecture and trade flows.

---

## System Status
The paper trading system is fully implemented and integrated into the main application dashboard, providing a comprehensive and interactive simulation experience.
