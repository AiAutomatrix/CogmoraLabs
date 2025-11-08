
import 'server-only';
import Stripe from 'stripe';
import { config } from 'dotenv';

// Explicitly load environment variables from .env file
config();

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});
