
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  const headersList = headers();
  const origin = headersList.get('origin') || 'http://localhost:9002';

  try {
    // The Price ID from your Stripe sample code
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
      // We will add user metadata back in once we have the fulfillment logic fully integrated with user accounts
      // metadata: {
      //   userId: userId,
      //   productId: 'AI_CREDIT_PACK_100',
      // },
    });

    if (session.url) {
      // This is the correct way to handle redirects from a form POST
      return NextResponse.redirect(session.url, 303);
    } else {
      throw new Error('Stripe session URL not found.');
    }

  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    // Return a JSON error response instead of letting Next.js render an HTML error page
    return NextResponse.json(
      { error: { message: err.message } },
      { status: err.statusCode || 500 }
    );
  }
}
