
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  const headersList = await headers();
  const origin = headersList.get('origin') || '';

  try {
    const priceId = process.env.STRIPE_AI_CREDIT_PRICE_ID;
    if (!priceId) {
      throw new Error("Stripe Price ID is not configured in the environment variables.");
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard?payment=cancelled`,
    });
    
    // Redirect to the Stripe checkout page
    return NextResponse.redirect(session.url!, 303);

  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    return NextResponse.json(
      { error: { message: err.message } },
      { status: err.statusCode || 500 }
    );
  }
}
