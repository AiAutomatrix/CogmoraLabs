
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  const headersList = await headers();
  // Use the origin from the request headers to build the redirect URLs.
  // This makes it work dynamically in any environment (local or cloud).
  const origin = headersList.get('origin') || '';

  try {
    const { productId } = await req.json();

    let priceId;
    if (productId === 'AI_CREDIT_PACK_100') {
      priceId = process.env.STRIPE_AI_CREDIT_PRICE_ID;
    } else if (productId === 'ACCOUNT_RESET') {
      priceId = process.env.STRIPE_ACCOUNT_RESET_PRICE_ID;
    }

    if (!priceId) {
        throw new Error(`Stripe Price ID not found for product: ${productId}`);
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
    
    return NextResponse.json({ url: session.url });

  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    return NextResponse.json(
      { error: { message: err.message } },
      { status: err.statusCode || 500 }
    );
  }
}
