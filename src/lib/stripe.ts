
import 'server-only';
import Stripe from 'stripe';
import { config } from 'dotenv';

// Explicitly load environment variables from .env file to ensure they are available in the server-side route.
config();

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: '2024-06-20',
});
