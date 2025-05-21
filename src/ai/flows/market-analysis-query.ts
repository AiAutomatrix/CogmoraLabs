'use server';

/**
 * @fileOverview An AI agent that provides real-time market analysis of a specific cryptocurrency.
 *
 * - marketAnalysisQuery - A function that handles the market analysis query.
 * - MarketAnalysisQueryInput - The input type for the marketAnalysisQuery function.
 * - MarketAnalysisQueryOutput - The return type for the marketAnalysisQuery function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MarketAnalysisQueryInputSchema = z.object({
  cryptocurrency: z.string().describe('The ticker symbol of the cryptocurrency to analyze (e.g., BTC).'),
  userQuery: z.string().describe('The user query about the cryptocurrency.'),
  tradingViewData: z.string().optional().describe('Current market data from the TradingView chart widget.')
});
export type MarketAnalysisQueryInput = z.infer<typeof MarketAnalysisQueryInputSchema>;

const MarketAnalysisQueryOutputSchema = z.object({
  analysis: z.string().describe('The real-time market analysis of the specified cryptocurrency based on the user query.'),
});
export type MarketAnalysisQueryOutput = z.infer<typeof MarketAnalysisQueryOutputSchema>;

export async function marketAnalysisQuery(input: MarketAnalysisQueryInput): Promise<MarketAnalysisQueryOutput> {
  return marketAnalysisQueryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'marketAnalysisQueryPrompt',
  input: {schema: MarketAnalysisQueryInputSchema},
  output: {schema: MarketAnalysisQueryOutputSchema},
  prompt: `You are an AI-powered webchat assistant providing real-time market analysis of cryptocurrencies.

You have access to the user's query and, optionally, current market data from a TradingView chart widget.

Based on the user's query about the specified cryptocurrency, provide a concise and informative market analysis.

Cryptocurrency: {{{cryptocurrency}}}
User Query: {{{userQuery}}}
TradingView Data: {{{tradingViewData}}}

Analysis: `,
});

const marketAnalysisQueryFlow = ai.defineFlow(
  {
    name: 'marketAnalysisQueryFlow',
    inputSchema: MarketAnalysisQueryInputSchema,
    outputSchema: MarketAnalysisQueryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
