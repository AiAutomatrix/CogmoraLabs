# Architecture Plan: The Advanced Paper Trading AI Agent

This document outlines the architecture that has been implemented for the sophisticated, stateful paper trading assistant.

---

## 1. Goal: A Stateful, Autonomous Agent

The "super agent" is a **state-aware reasoning engine**. Its goal is not just to propose new trades but to **manage a portfolio of potential trades (triggers)** based on the user's complete trading context.

### Core Capabilities:
1.  **Full Context Awareness**: The agent receives the user's `watchlist` AND their list of `activeTradeTriggers` as input, along with their current balance and custom instructions.
2.  **Analyze and Strategize**: Based on the full context, the agent first forms a market analysis and a high-level strategy (e.g., "market looks bullish, let's secure profits on existing triggers and seek new breakout opportunities").
3.  **Generate a Plan of Action**: The agent returns a **plan** consisting of one or more of the following actions:
    -   `CREATE`: Propose a brand-new trigger for a symbol not currently covered.
    -   `UPDATE`: Suggest modifying an existing trigger (e.g., "The price of BTC has run up; let's adjust the target price on trigger #123").
    -   `CANCEL`: Recommend removing an existing trigger that is no longer relevant or seems like a bad idea.

---

## 2. Implemented Architecture

This has been implemented using **Genkit Tools**. This architecture provides a structured, reliable, and extensible way for the AI to build its plan.

### a. `propose-trade-triggers-flow.ts`

-   **Input Context**: The core `ProposeTradeTriggersInput` schema has been updated to include an `activeTriggers: TradeTrigger[]` field, along with `balance` and `settings`.
-   **Component Integration**: The `PaperTradingContext` now passes the user's `tradeTriggers`, `balance`, and `aiSettings` into the AI flow.
-   **Prompt Enhancement**: The AI's main prompt instructs it to analyze both the watchlist and the existing triggers, with the goal of avoiding duplicates and making more informed suggestions based on the full context.

### b. Genkit Tools and a Multi-Action Plan

The agent's output is now a structured `AgentActionPlan`.

**1. Genkit Tools (`src/ai/flows/propose-trade-triggers-flow.ts`):**

A set of tools are defined within the flow that the AI can use to build its plan. These tools return structured data objects that the UI can interpret.

-   `createTriggerTool`: Returns a `CREATE` action object.
-   `updateTriggerTool`: Returns an `UPDATE` action object.
-   `cancelTriggerTool`: Returns a `CANCEL` action object.

**2. Redefined AI Flow Output (`src/types/index.ts`):**

The output of the main AI flow is the `AgentActionPlanSchema`:

```typescript
// In src/types/index.ts
export const AgentActionSchema = z.union([
  AgentCreateActionSchema, 
  AgentUpdateActionSchema, 
  AgentCancelActionSchema
]);

export const AgentActionPlanSchema = z.object({
  analysis: z.string(),
  plan: z.array(AgentActionSchema), // An array of actions
});
```

**3. UI Implementation (`AiPaperTradingChat.tsx`):**

The AI chat component has been built to handle this `plan`.

-   It renders a "plan of action" rather than just a list of proposals.
-   Each action (`CREATE`, `UPDATE`, `CANCEL`) is displayed as a distinct card with its own "Approve" / "Decline" buttons.
-   Approving an action calls the appropriate function in the `PaperTradingContext` (`addTradeTrigger`, `updateTradeTrigger`, or `removeTradeTrigger`).
-   Each proposed action card also displays the AI's specific `reasoning` for that action.

This architecture has successfully transformed the agent from a simple proposer into a state-aware assistant capable of managing a portfolio of trade triggers.
