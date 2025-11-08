
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  const headersList = headers();
  const origin = headersList.get('origin') || 'http://localhost:9002';

  try {
    // The working Price ID from the sample application.
    const priceId = 'price_1SREGsR1GTVMlhwAIHGT4Ofd';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
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

    if (session.url) {
      // Use NextResponse.redirect for form submissions.
      return NextResponse.redirect(session.url, 303);
    } else {
      throw new Error('Stripe session URL not found.');
    }

  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    // Return a proper JSON error response.
    return NextResponse.json(
      { error: { message: err.message } },
      { status: err.statusCode || 500 }
    );
  }
}
