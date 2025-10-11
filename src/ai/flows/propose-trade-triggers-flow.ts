
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
} from '@/types';


export async function proposeTradeTriggers(input: ProposeTradeTriggersInput): Promise<AgentActionPlan> {
  return proposeTradeTriggersFlow(input);
}

// Define Tools for the AI
const createTriggerTool = ai.defineTool(
  {
    name: 'createTradeTrigger',
    description: 'Creates a new trade trigger for a symbol that does not have one.',
    inputSchema: AgentCreateActionSchema.pick({ trigger: true, reasoning: true }),
    outputSchema: AgentCreateActionSchema,
  },
  async (input) => input
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


const prompt = ai.definePrompt({
  name: 'proposeTradeTriggersPrompt',
  input: { schema: ProposeTradeTriggersInputSchema },
  output: { schema: AgentActionPlanSchema },
  tools: [createTriggerTool, updateTriggerTool, cancelTriggerTool],
  prompt: `You are an expert trading analyst AI for a paper trading platform. Your goal is to help users by managing their trade triggers.

You will be given the user's current watchlist, their active trade triggers, and their account balance.

- Watchlist:
{{{json watchlist}}}

- Active Triggers:
{{{json activeTriggers}}}

- Account Balance: {{{balance}}}

- User Instructions: {{{settings.instructions}}}

Based on all this information, your task is to **formulate a plan of action**.

1.  **Analyze the Full Context**: 
    *   Review the watchlist and the active triggers. Note which symbols from the watchlist already have active triggers.
    *   Consider the user's cash balance when deciding on new trade amounts.
    *   If a symbol on the watchlist is showing a new opportunity, but already has a trigger, consider UPDATING the existing trigger.
    *   If a trigger seems outdated or no longer strategic, consider CANCELING it.
    *   If a promising symbol on the watchlist has NO trigger, CREATE a new one.

2.  **Generate a brief analysis**: Write a high-level summary of what you see in the market and what your overall strategy is for this plan. Explain your reasoning.

3.  **Formulate the Plan**: Use the provided tools ('createTradeTrigger', 'updateTradeTrigger', 'cancelTradeTrigger') to build your plan.
    *   For each action, provide a clear 'reasoning' for why you are recommending it.
    *   Do not create duplicate triggers. Either update existing ones or ignore them.
    *   If creating a new trigger, use sensible target prices and varied, realistic allocation amounts.
    *   For futures, suggest reasonable leverage (2x-20x).
    {{#if settings.setSlTp}}
    *   **IMPORTANT**: When creating or updating, you MUST also set reasonable 'stopLoss' and 'takeProfit' price levels.
    {{/if}}
    {{#if settings.justCreate}}
    *   The user has requested to ONLY create new triggers. Do not use the update or cancel tools.
    {{/if}}
     {{#if settings.justUpdate}}
    *   The user has requested to ONLY adjust active triggers. Do not use the create tool.
    {{/if}}

Your final output must be a valid JSON object matching the 'AgentActionPlan' schema, containing your analysis and the array of actions in the 'plan' field.
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
