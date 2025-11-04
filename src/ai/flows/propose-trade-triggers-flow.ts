
'use server';
/**
 * @fileOverview An AI agent that analyzes a paper trading context and proposes a plan of action.
 *
 * - proposeTradeTriggers - A function that handles the trade trigger proposal process.
 * - ProposeTradeTriggersInput - The input type for the proposeTradeTriggers function.
 * - AgentActionPlan - The return type for the proposeTradeTriggers function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { 
  ProposeTradeTriggersInputSchema, 
  AgentActionPlanSchema, 
  ProposeTradeTriggersInput, 
  AgentActionPlan,
  ProposedTradeTriggerSchema,
  AgentCreateActionSchema,
  AgentUpdateActionSchema,
  AgentCancelActionSchema,
  AgentUpdateOpenPositionActionSchema,
} from '@/types';


export async function proposeTradeTriggers(input: ProposeTradeTriggersInput): Promise<AgentActionPlan> {
  return proposeTradeTriggersFlow(input);
}

// Define Tools for the AI
const createTriggerTool = ai.defineTool(
  {
    name: 'createTradeTrigger',
    description: 'Creates a new trade trigger for a symbol that does not have one.',
    // Restructure the schema to be hierarchical, which is easier for the model
    inputSchema: z.object({
      reasoning: z.string().describe("A brief justification for why this new trigger is being proposed."),
      trigger: ProposedTradeTriggerSchema.describe("The full trigger object to be created."),
    }),
    outputSchema: AgentCreateActionSchema,
  },
  async ({ reasoning, trigger }) => ({
    type: 'CREATE',
    reasoning,
    trigger,
  })
);

const updateTriggerTool = ai.defineTool(
  {
    name: 'updateTradeTrigger',
    description: 'Updates an existing trade trigger. Use this to adjust target prices, amounts, or SL/TP levels based on new market conditions.',
    inputSchema: AgentUpdateActionSchema.pick({ triggerId: true, updates: true, reasoning: true }),
    outputSchema: AgentUpdateActionSchema,
  },
  async (input) => ({ type: 'UPDATE', ...input })
);

const cancelTriggerTool = ai.defineTool(
  {
    name: 'cancelTradeTrigger',
    description: 'Cancels an existing trade trigger that is no longer relevant or seems like a bad idea.',
    inputSchema: AgentCancelActionSchema.pick({ triggerId: true, reasoning: true }),
    outputSchema: AgentCancelActionSchema,
  },
  async (input) => ({ type: 'CANCEL', ...input })
);

const updateOpenPositionTool = ai.defineTool(
  {
    name: 'updateOpenPosition',
    description: 'Updates an existing OPEN POSITION to set or adjust its Stop Loss or Take Profit levels. Use this for risk management on active trades.',
    inputSchema: AgentUpdateOpenPositionActionSchema.pick({ positionId: true, updates: true, reasoning: true }),
    outputSchema: AgentUpdateOpenPositionActionSchema,
  },
  async (input) => ({ type: 'UPDATE_OPEN_POSITION', ...input })
);


const prompt = ai.definePrompt({
  name: 'proposeTradeTriggersPrompt',
  input: { schema: ProposeTradeTriggersInputSchema },
  output: { schema: AgentActionPlanSchema },
  tools: [createTriggerTool, updateTriggerTool, cancelTriggerTool, updateOpenPositionTool],
  prompt: `You are an expert trading analyst and risk management AI for a paper trading platform. Your goal is to help users by managing their portfolio, which includes open positions and pending trade triggers.

You will be given the user's current watchlist, their open positions, their active trade triggers, and their overall account metrics.

- Watchlist:
{{{json watchlist}}}

- Open Positions:
{{{json openPositions}}}

- Active Triggers:
{{{json activeTriggers}}}

- Account Metrics:
{{{json accountMetrics}}}

- User Instructions: {{{settings.instructions}}}

Based on all this information, your task is to **formulate a comprehensive plan of action**.

### Core Instructions (Follow these ALWAYS):
1.  **Analyze the Full Context**: 
    *   Review the watchlist, open positions, and active triggers. Note which symbols from the watchlist already have active trades or triggers.
    *   Review the account metrics. Pay close attention to available 'balance' and 'unrealizedPnl'. If unrealized P&L is very negative, suggest tighter stop losses on open positions or smaller new trades. Consider the total capital already in open positions when suggesting new trade sizes.
    *   If a symbol on the watchlist is showing a new opportunity but already has a trigger, consider UPDATING the existing trigger.
    *   If a trigger seems outdated or no longer strategic (e.g., price has moved far away), consider CANCELING it.
    *   If a promising symbol on the watchlist has NO trigger, CREATE a new one. Look for both long and short opportunities based on market conditions.

2.  **CRITICAL: Interpret Futures Sentiment via Funding Rate**:
    *   For futures symbols in the watchlist, inspect the 'futuresContractData' object. The 'fundingFeeRate' is a powerful sentiment indicator.
    *   **Positive Funding Rate** (e.g., > 0): Longs are paying shorts. This indicates bullish sentiment. If the rate is very high (e.g., > 0.0002), it may signal an overcrowded long trade, creating an opportunity for a short (mean reversion) trade.
    *   **Negative Funding Rate** (e.g., < 0): Shorts are paying longs. This indicates bearish sentiment. A very low negative rate might signal an overcrowded short trade, creating an opportunity for a long squeeze.
    *   **Use this sentiment** in your 'reasoning' for any futures-related action. For example: "Funding rate is positive, indicating bullish pressure. Proposing a long trigger on a pullback."

3.  **Trade Allocation**:
    *   When creating a new trigger, the 'amount' should be between 3% and 10% of the account's available 'balance'. Do not use more than 10%.
    *   For futures, this 'amount' is the collateral.

4.  **CRITICAL: Stop Loss and Take Profit Logic**:
    *   For **BUY** or **LONG** trades, the 'takeProfit' price MUST be **HIGHER** than the 'targetPrice' (entry).
    *   For **BUY** or **LONG** trades, the 'stopLoss' price MUST be **LOWER** than the 'targetPrice' (entry).
    *   For **SHORT** trades, the 'takeProfit' price MUST be **LOWER** than the 'targetPrice' (entry).
    *   For **SHORT** trades, the 'stopLoss' price MUST be **HIGHER** than the 'targetPrice' (entry).
    *   These rules are non-negotiable.

5.  **Generate an Analysis**: Write a brief, high-level summary of what you see in the market and what your overall strategy is for this plan. Explain your reasoning based on the account metrics.

6.  **Formulate the Plan**: Use the provided tools ('createTradeTrigger', 'updateTradeTrigger', 'cancelTradeTrigger', 'updateOpenPosition') to build your plan.
    *   **CRITICAL**: For each action, you MUST provide a clear 'reasoning' field inside the action object explaining why you are recommending it. This is not optional.
    *   Do not create duplicate triggers for a symbol that already has one. Either update the existing one or ignore it.
    *   For futures, suggest reasonable leverage (2x-20x).

### User Settings (Apply these if specified):
{{#if settings.manageOpenPositions}}
*   **IMPORTANT**: Analyze the open positions. If a position has significant unrealized profit, consider suggesting a 'takeProfit' level to secure gains. If a position is at a loss, consider suggesting a 'stopLoss' to manage risk. Use the 'updateOpenPosition' tool for this.
{{/if}}
{{#if settings.setSlTp}}
*   **IMPORTANT**: When creating or updating triggers, you MUST also set reasonable 'stopLoss' and 'takeProfit' price levels, following the critical logic rules above.
{{/if}}
{{#if settings.justCreate}}
*   The user has requested to ONLY create new triggers. Do not use the update, cancel, or open position tools.
{{/if}}
{{#if settings.justUpdate}}
*   The user has requested to ONLY adjust active triggers. Do not use the create or open position tools.
{{/if}}

Your final output must be a valid JSON object matching the 'AgentActionPlan' schema, containing your analysis and the array of actions in the 'plan' field. Each action in the plan must have a 'reasoning' field.
`,
});

const proposeTradeTriggersFlow = ai.defineFlow(
  {
    name: 'proposeTradeTriggersFlow',
    inputSchema: ProposeTradeTriggersInputSchema,
    outputSchema: AgentActionPlanSchema,
    model: 'googleai/gemini-2.5-flash-preview',
  },
  async (input) => {
    const { output } = await prompt(input);
    // The model's structured output is now the entire AgentActionPlan
    return output!;
  }
);
