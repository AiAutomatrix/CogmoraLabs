
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  const headersList = headers();
  const origin = headersList.get('origin') || 'http://localhost:9002';

  try {
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      throw new Error("Stripe Price ID is not configured in the environment variables.");
    }

    // Create Checkout Sessions from body params.
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
    
    // Instead of redirecting from the server, we return the URL to the client.
    return NextResponse.json({ url: session.url });

  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    return NextResponse.json(
      { error: { message: err.message } },
      { status: err.statusCode || 500 }
    );
  }
}
