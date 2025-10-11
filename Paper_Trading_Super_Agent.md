
# Architecture Plan: The Advanced Paper Trading AI Agent

This document outlines the architectural plan to evolve the current paper trading AI from a simple "proposer" into a sophisticated, stateful, and autonomous trading assistant.

---

## 1. Current State & Limitations

The current AI agent operates as a **stateless, one-shot flow**:
-   It receives the user's `watchlist` as input.
-   It proposes a new, independent set of `TradeTrigger` objects.
-   **Crucially, it has no knowledge of the user's currently active triggers.**

This leads to several limitations:
-   **Duplicate Triggers**: The agent may repeatedly suggest triggers for symbols that are already covered.
-   **No Adaptation**: It cannot adjust its strategy based on what's already in motion. For example, it can't decide to focus on altcoins if it sees that blue-chip cryptos are already covered by active triggers.
-   **Inability to Manage**: The agent can only add triggers; it cannot edit, refine, or cancel them.

---

## 2. The Goal: A Stateful, Autonomous Agent

The "super agent" will be a **state-aware reasoning engine**. Its goal is not just to propose new trades but to **manage a portfolio of potential trades (triggers)** based on the user's complete trading context.

### Core Capabilities:
1.  **Full Context Awareness**: The agent must receive the user's `watchlist` AND their list of `activeTradeTriggers` as input.
2.  **Analyze and Strategize**: Based on the full context, the agent should first form a market analysis and a high-level strategy (e.g., "market looks bullish, let's secure profits on existing triggers and seek new breakout opportunities").
3.  **Generate a Plan of Action**: Instead of just proposing new triggers, the agent will return a **plan** consisting of one or more of the following actions:
    -   `CREATE`: Propose a brand-new trigger for a symbol not currently covered.
    -   `UPDATE`: Suggest modifying an existing trigger (e.g., "The price of BTC has run up; let's adjust the target price on trigger #123").
    -   `CANCEL`: Recommend removing an existing trigger that is no longer relevant or seems like a bad idea.
    -   `NO_ACTION`: Explicitly state that the current set of triggers is well-positioned and no changes are needed.

---

## 3. Proposed Architecture & Implementation

We will implement this using **Genkit Tools**. Instead of having one monolithic prompt, we will give the AI a set of tools it can call to build its plan. This makes the agent's reasoning more structured, reliable, and extensible.

### a. Phase 1: Foundational Changes (Current Implementation)

**Input Context Expansion**:
-   **Modify `propose-trade-triggers-flow.ts`**: The core `ProposeTradeTriggersInput` schema will be updated to include an `activeTriggers: TradeTrigger[]` field.
-   **Update `dashboard/page.tsx`**: The `handleAiTriggerAnalysis` function will be modified to pass the user's `tradeTriggers` from the `usePaperTrading` context into the AI flow.
-   **Prompt Enhancement**: The AI's main prompt will be updated to instruct it to analyze both the watchlist and the existing triggers, with the goal of avoiding duplicates and making more informed suggestions.

*This initial phase makes the agent "read-only" aware of the current state, immediately improving the quality of its proposals.*

### b. Phase 2: Introducing Tools and a Multi-Action Plan

This is the major architectural shift. We will redefine the agent's output and provide it with tools to manage triggers.

**1. New Genkit Tools (`src/ai/tools/paper-trading-tools.ts`):**

We will create a set of tools that the AI can use to manage triggers. These tools will not execute the actions directly but will return structured data that the UI can interpret.

-   `createTradeTriggerTool`: Input is a `ProposedTradeTrigger`. Output is a `CREATE` action object.
-   `updateTradeTriggerTool`: Input is a `triggerId` and the `fields to update`. Output is an `UPDATE` action object.
-   `cancelTradeTriggerTool`: Input is a `triggerId`. Output is a `CANCEL` action object.

**2. Redefined AI Flow Output (`propose-trade-triggers-flow.ts`):**

The output of the main AI flow will change from `ProposeTradeTriggersOutput` to a new `AgentActionPlan` schema:

```typescript
// In src/types/index.ts
export type AgentAction = 
  | { type: 'CREATE', trigger: ProposedTradeTrigger }
  | { type: 'UPDATE', triggerId: string, updates: Partial<TradeTrigger> }
  | { type: 'CANCEL', triggerId: string };

export const AgentActionPlanSchema = z.object({
  analysis: z.string(),
  plan: z.array(AgentActionSchema), // An array of actions
});
```

**3. UI Overhaul (`AiPaperTradingChat.tsx`):**

The AI chat component will be completely updated to handle this new `plan`.

-   Instead of just showing proposed triggers, it will render a "plan of action".
-   Each action (`CREATE`, `UPDATE`, `CANCEL`) will be displayed as a distinct card with "Approve" / "Decline" buttons.
-   "Approving" a `CREATE` action will call `addTradeTrigger`.
-   "Approving" an `UPDATE` action will call a new `updateTradeTrigger` function in the context.
-   "Approving" a `CANCEL` action will call `removeTradeTrigger`.

---

## 4. MCP Agent Discussion

The idea of an "MCP Agent" (Multi-Component-Persona) is an advanced concept, often referring to a more complex system where different specialized AI agents collaborate.

-   **Is it a good fit?** Yes, eventually. For our use case, we could imagine an MCP setup like this:
    -   **Analyst Agent**: A persona that only reads market data and forms high-level analysis.
    -   **Strategist Agent**: Takes the analysis and decides on a strategy (e.g., "be aggressive," "be defensive").
    -   **Execution Agent**: Takes the strategy and uses the `create/update/cancel` tools to generate the final, concrete plan of action.

-   **Recommendation**: While MCP is a powerful end-goal, the most practical and impactful next step is to implement the **Genkit Tools** architecture described in **Phase 2**. This gives us the core "super agent" capabilities (Create, Update, Cancel) in a structured way. Once that is stable, we can further decompose the agent's logic into multiple personas (MCP) if needed for even more complex reasoning.

By following this roadmap, we can incrementally build the highly intelligent and capable paper trading agent you've envisioned.

    