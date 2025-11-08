
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  const headersList = await headers();
  const origin = headersList.get('origin') || 'http://localhost:9002';

  try {
    // This is a test Price ID. Replace with your actual Price ID in production.
    const priceId = 'price_1PgWdDR1GTVMlhwA230kzGKU';

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

    // For form submissions, we must use NextResponse.redirect.
    return NextResponse.redirect(session.url!, 303);

  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    // Return a proper JSON error response if something goes wrong.
    return NextResponse.json(
      { error: { message: err.message } },
      { status: err.statusCode || 500 }
    );
  }
}
