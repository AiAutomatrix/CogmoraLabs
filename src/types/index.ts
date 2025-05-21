import { z } from 'zod';

export const TradeSchema = z.object({
  id: z.string(),
  cryptocurrency: z.string().min(1, "Cryptocurrency symbol is required (e.g., BTCUSDT)"),
  entryPrice: z.coerce.number().positive("Entry price must be a positive number"),
  targetPrice: z.coerce.number().positive("Target price must be a positive number"),
  stopLoss: z.coerce.number().positive("Stop loss must be a positive number"),
  status: z.enum(['active', 'closed']).default('active'),
  createdAt: z.date().default(() => new Date()),
});

export type Trade = z.infer<typeof TradeSchema>;

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}
