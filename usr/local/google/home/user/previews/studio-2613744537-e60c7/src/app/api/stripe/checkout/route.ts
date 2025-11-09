
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/firebase/admin';

// Initialize Firebase Admin SDK
adminApp();

export async function POST(req: Request) {
  const headersList = await headers();
  const origin = headersList.get('origin') || 'http://localhost:9002'; // Fallback for safety

  try {
    const authorization = headersList.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return new NextResponse(JSON.stringify({ error: { message: 'Unauthorized: Missing token.' } }), { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { productId } = await req.json();

    let priceId;
    // Use the Price IDs from environment variables
    if (productId === 'AI_CREDIT_PACK_100') {
      priceId = process.env.STRIPE_AI_CREDIT_PRICE_ID;
    } else {
      return NextResponse.json({ error: { message: `Unknown product ID: ${productId}` } }, { status: 400 });
    }

    if (!priceId) {
        console.error(`Stripe Price ID not found in .env for productId: ${productId}`);
        return NextResponse.json({ error: { message: `Stripe Price ID not found for product: ${productId}` } }, { status: 500 });
    }

    // Create Checkout Sessions from body params.
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard?payment=cancelled`,
      metadata: {
        userId: userId,
        productId: productId,
      },
    });

    return NextResponse.json({ sessionId: session.id });

  } catch (err: any) {
    console.error('Stripe Checkout Error:', err);
    return NextResponse.json(
      { error: { message: err.message } },
      { status: err.statusCode || 500 }
    );
  }
}
