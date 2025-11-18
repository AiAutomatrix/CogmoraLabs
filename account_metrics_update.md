# Account Metrics Dashboard: v2.0 Upgrade Plan

This document outlines the architectural and design plan to completely overhaul the **Account Metrics** section of the Paper Trading Dashboard. The goal is to evolve it from a simple grid of stats into a dynamic, professional, and data-dense overview panel inspired by industry-leading platforms like TradingView.

---

## 1. Core Concept: A Unified, Interactive Metrics Hub

The new design will be centered around a single, highly-interactive `Card` component that acts as the user's account "command center". This replaces the current grid of individual metric boxes with a more cohesive and sophisticated layout.

## 2. Key Features & Components

### a. The Carousel Layout
The entire metrics panel will be built inside a **ShadCN Carousel** component. This will allow the user to swipe or click through multiple distinct views within the same compact space, making the dashboard feel incredibly rich without adding clutter.

### b. View 1: Main Performance Dashboard (Default View)
This will be the primary view of the carousel, providing an at-a-glance summary of the account's health.

-   **Layout**: A single, elegant `Card` with a clear visual hierarchy.
-   **Primary Metric**: The **Equity** will be displayed as the most prominent number, making it the immediate focal point.
-   **Secondary Metrics**: Other key stats like **Available Cash**, **Unrealized P&L**, **Realized P&L**, and **Win Rate** will be arranged cleanly below the equity using smaller, "micro" text.
-   **Micro Equity Chart**: The centerpiece of this view will be a minimalist **Recharts Area Chart** embedded directly into the card.
    -   **Data Source**: It will process the user's `tradeHistory` to plot the account's equity over time.
    -   **Design**: It will be stripped of all axes, labels, and grids, showing only a clean, gradient-filled area curve to represent performance visually.

### c. View 2: Recent Trade Analysis
A swipe to the next item in the carousel will reveal a detailed breakdown of recent performance.

-   **Component**: A **Recharts Bar Chart**.
-   **Data**: It will visualize the P&L (profit or loss) of the last 10-20 closed trades.
-   **Design**: Positive P&L bars will be styled in green, and negative P&L bars in red, giving an instant impression of recent winning or losing streaks.

### c. View 3: Asset Allocation
A third swipe will provide a view of the current portfolio's composition.

-   **Component**: A **Recharts Pie Chart** or **Donut Chart**.
-   **Data**: It will represent the value of each **open position** as a slice of the pie.
-   **Design**: Each slice will be labeled with the symbol (e.g., BTC, ETH) and its percentage of the total portfolio value, allowing the user to quickly assess their exposure and diversification.

---

## 3. Implementation Plan

1.  **Refactor `PaperTradingDashboard.tsx`**: Create a new component, `AccountMetricsCarousel`, to house the new logic.
2.  **Process Data in Context**: Add memoized functions to `PaperTradingContext.tsx` to process the `tradeHistory` and `openPositions` into the data structures needed for the new charts (equity curve, P&L bar chart, and allocation pie chart).
3.  **Build the Carousel**: Use ShadCN's `Carousel` components to structure the three views.
4.  **Create the Charts**: Implement the three `recharts` charts (Area, Bar, Pie) with a minimalist, modern aesthetic.
5.  **Style the UI**: Ensure the final component is polished, responsive, and fits seamlessly into the existing dashboard design.