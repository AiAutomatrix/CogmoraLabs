# Instruction Doc for IDE Agent – Paper Trading Dashboard

## Goal
Integrate a **paper trading engine** into the Tradeflow app. Users should be able to simulate trades using KuCoin market data in real time. The system must include UI components for trade entry and a live-updating dashboard that tracks performance similar to TradingView.

---

## Tasks

### 1. Paper Trading Engine
- Create a `paperTradingEngine.js` module:
  - Store user paper trading account balance (e.g., default $100,000 virtual balance).
  - Handle **buy** and **sell** orders.
  - Record trades in a local database (Firebase Firestore or local state, depending on current setup).
  - Track open positions, PnL (profit & loss), average entry price, and trade history.
  - Subscribe to KuCoin WebSocket streams for selected tickers to update position values live.

### 2. KuCoin Spot Screener Integration
- In the KuCoin spot screener component:
  - Add a **Buy Button** for each listed coin.
  - On click:
    - Trigger a popup modal (`TradePopup` component).
    - Ask user **“How much money do you want to allocate?”**
    - Fetch current coin price via KuCoin ticker API or WebSocket.
    - Calculate the **amount of tokens** based on user input.
    - Show confirmation before executing the paper trade.

### 3. Paper Trading Dashboard
- Create a new `PaperTradingDashboard.jsx`:
  - Display:
    - **Open Positions Table**
      - Coin symbol
      - Amount
      - Entry price
      - Current price (live from WebSocket)
      - Unrealized PnL
    - **Trade History Table**
      - Time
      - Symbol
      - Side (buy/sell)
      - Size
      - Price
      - PnL at close
    - **Account Metrics (like TradingView)**
      - Total balance
      - Available cash
      - Equity
      - Unrealized PnL
      - Realized PnL
      - Win rate
      - Sharpe ratio (optional advanced metric)

### 4. Component Structure
- **`TradePopup.jsx`** – popup modal to enter trade size and confirm.
- **`PaperTradingDashboard.jsx`** – main dashboard view for paper trading metrics.
- **`PaperTradePositionRow.jsx`** – subcomponent for each open position.
- **`TradeHistoryRow.jsx`** – subcomponent for each history entry.
- **`PaperTradingContext.js`** – global context for paper trading state management (account balance, trades, positions).

### 5. WebSocket Integration
- Connect to KuCoin WebSocket for spot prices.
- On user trade execution:
  - Subscribe to the selected symbol.
  - Update position metrics in real time in the dashboard.

### 6. Documentation
- Generate `PaperTrading_System.md`:
  - Explain how the paper trading engine works.
  - Describe trade flow:
    - User clicks **Buy** → enters allocation → trade executed → dashboard updates in real time.
  - Document WebSocket subscription handling.
  - List all dashboard metrics and formulas (e.g., `Unrealized PnL = (Current Price - Entry Price) * Position Size`).
  - Show relationships between components (`KuCoinScreener` → `TradePopup` → `PaperTradingEngine` → `PaperTradingDashboard`).

---

## Deliverables
- New components: `TradePopup`, `PaperTradingDashboard`, `PaperTradePositionRow`, `TradeHistoryRow`.
- New modules: `paperTradingEngine.js`, `PaperTradingContext.js`.
- Documentation file: `PaperTrading_System.md`.
- Integration of **Buy Button** into KuCoin Spot Screener.

---

## Notes
- Keep it modular so the paper trading system can expand later (e.g., adding Sell, Stop Loss, Take Profit).
- Follow TradingView-like UI metrics for familiarity.
- Ensure all calculations are based on **real-time WebSocket data**.