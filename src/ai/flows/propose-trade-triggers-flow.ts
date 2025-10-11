
'use server';
/**
 * @fileOverview An AI agent that analyzes a paper trading watchlist and proposes trade triggers.
 *
 * - proposeTradeTriggers - A function that handles the trade trigger proposal process.
 * - ProposeTradeTriggersInput - The input type for the proposeTradeTriggers function.
 * - ProposeTradeTriggersOutput - The return type for the proposeTradeTriggers function.
 */

import { ai } from '@/ai/genkit';
import { ProposeTradeTriggersInputSchema, ProposeTradeTriggersOutputSchema, ProposeTradeTriggersInput, ProposeTradeTriggersOutput } from '@/types';


export async function proposeTradeTriggers(input: ProposeTradeTriggersInput): Promise<ProposeTradeTriggersOutput> {
  return proposeTradeTriggersFlow(input);
}

const prompt = ai.definePrompt({
  name: 'proposeTradeTriggersPrompt',
  input: { schema: ProposeTradeTriggersInputSchema },
  output: { schema: ProposeTradeTriggersOutputSchema },
  prompt: `You are an expert trading analyst AI for a paper trading platform. Your goal is to help users by analyzing their watchlist and proposing interesting, educational, and diverse trade triggers.

Review the user's current watchlist data provided below.
Also consider the user's custom instructions if provided.

Watchlist:
{{{json watchlist}}}

User Instructions: {{{settings.instructions}}}

Based on this data and instructions, perform the following actions:

1.  **Generate a brief analysis**: Write a high-level summary of what you see in the market based on the provided symbols. Mention any notable trends (e.g., overall bullish sentiment, a specific sector performing well, etc.). Keep it concise and insightful.

2.  **Propose 3-5 diverse trade triggers**: Create a list of 'TradeTrigger' objects. These triggers should be varied and demonstrate different trading strategies.
    *   Include a mix of actions: 'buy' (for spot), 'long' (for futures), and 'short' (for futures).
    *   Set sensible 'targetPrice' conditions. For example, suggest buying on a dip (price is below current), or shorting on a move above a recent high if the sentiment is bearish.
    *   Use realistic but varied allocation amounts (e.g., between 50 and 500 USD).
    *   For futures triggers ('long' or 'short'), suggest a reasonable leverage (e.g., between 2x and 20x).
    *   Make sure the 'type' field is correctly set to 'spot' for 'buy' actions and 'futures' for 'long'/'short' actions.
    *   Ensure the 'symbol' and 'symbolName' fields are correctly copied from the watchlist item.
    {{#if settings.setSlTp}}
    *   **IMPORTANT**: The user has enabled automatic Stop Loss and Take Profit. For each trigger you propose, you MUST also set reasonable 'stopLoss' and 'takeProfit' price levels. Calculate these based on the target price and volatility. For example, a 5% stop loss and a 10% take profit.
    {{/if}}

Your final output must be a valid JSON object matching the specified output schema.
`,
});

const proposeTradeTriggersFlow = ai.defineFlow(
  {
    name: 'proposeTradeTriggersFlow',
    inputSchema: ProposeTradeTriggersInputSchema,
    outputSchema: ProposeTradeTriggersOutputSchema,
    model: 'googleai/gemini-2.5-flash-preview',
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
