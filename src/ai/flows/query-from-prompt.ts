'use server';

/**
 * @fileOverview A flow to allow users to query the AI with a custom prompt about the crypto market.
 *
 * - customPromptQuery - A function that handles the custom prompt query process.
 * - CustomPromptQueryInput - The input type for the customPromptQuery function.
 * - CustomPromptQueryOutput - The return type for the customPromptQuery function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CustomPromptQueryInputSchema = z.object({
  prompt: z.string().describe('The custom prompt from the user.'),
});
export type CustomPromptQueryInput = z.infer<typeof CustomPromptQueryInputSchema>;

const CustomPromptQueryOutputSchema = z.object({
  response: z.string().describe('The response from the AI based on the custom prompt.'),
});
export type CustomPromptQueryOutput = z.infer<typeof CustomPromptQueryOutputSchema>;

export async function customPromptQuery(input: CustomPromptQueryInput): Promise<CustomPromptQueryOutput> {
  return customPromptQueryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'customPromptQueryPrompt',
  input: {schema: CustomPromptQueryInputSchema},
  output: {schema: CustomPromptQueryOutputSchema},
  prompt: `{{prompt}}`,
});

const customPromptQueryFlow = ai.defineFlow(
  {
    name: 'customPromptQueryFlow',
    inputSchema: CustomPromptQueryInputSchema,
    outputSchema: CustomPromptQueryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
