
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

    const { priceId, productId } = await req.json(); // Accept priceId directly now

    if (!priceId) {
        console.error(`Stripe Price ID not found in request body.`);
        return NextResponse.json({ error: { message: `Price ID is missing from the request.` } }, { status: 400 });
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
      // We will add the productId to metadata if available, to help the webhook
      metadata: {
        userId: userId,
        productId: productId || 'AI_CREDIT_PACK_100', // Default for now
      },
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
