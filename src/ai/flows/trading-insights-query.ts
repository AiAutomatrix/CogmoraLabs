'use server';

/**
 * @fileOverview An AI agent that provides trading insights based on user queries and TradingView chart data.
 *
 * - tradingInsightsQuery - A function that handles the process of providing trading insights.
 * - TradingInsightsQueryInput - The input type for the tradingInsightsQuery function.
 * - TradingInsightsQueryOutput - The return type for the tradingInsightsQuery function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TradingInsightsQueryInputSchema = z.object({
  query: z.string().describe('The user query for trading insights.'),
  chartData: z.string().describe('The current TradingView chart data.'),
});
export type TradingInsightsQueryInput = z.infer<typeof TradingInsightsQueryInputSchema>;

const TradingInsightsQueryOutputSchema = z.object({
  insights: z.string().describe('The trading insights based on the query and chart data.'),
});
export type TradingInsightsQueryOutput = z.infer<typeof TradingInsightsQueryOutputSchema>;

export async function tradingInsightsQuery(input: TradingInsightsQueryInput): Promise<TradingInsightsQueryOutput> {
  return tradingInsightsQueryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'tradingInsightsQueryPrompt',
  input: {schema: TradingInsightsQueryInputSchema},
  output: {schema: TradingInsightsQueryOutputSchema},
  prompt: `You are an AI trading assistant.  A user will ask you for trading advice, and you should answer it using the chart data provided.  Be concise, but helpful.

User Query: {{{query}}}
Chart Data: {{{chartData}}}`,
});

const tradingInsightsQueryFlow = ai.defineFlow(
  {
    name: 'tradingInsightsQueryFlow',
    inputSchema: TradingInsightsQueryInputSchema,
    outputSchema: TradingInsightsQueryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
