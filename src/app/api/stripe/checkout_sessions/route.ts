
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  const headersList = headers();
  const origin = headersList.get('origin') || 'http://localhost:9002';

  try {
    // This is the working Price ID from your sample application.
    const priceId = 'price_1SREGsR1GTVMlhwAIHGT4Ofd';

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/dashboard?payment=success`,
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
