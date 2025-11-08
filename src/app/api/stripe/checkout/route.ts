
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/firebase/admin';

// Initialize Firebase Admin SDK
adminApp();

export async function POST(req: Request) {
  const headersList = headers();
  const origin = headersList.get('origin') || 'http://localhost:3000';

  try {
    const authorization = headersList.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Create Checkout Sessions from body params.
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_AI_CREDIT_PRICE_ID || 'price_1PX1qnR1GTVMlhwA9xK4mD5i', // Replace with your actual Price ID
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/dashboard?payment=success`,
      cancel_url: `${origin}/dashboard?payment=cancelled`,
      metadata: {
        userId: userId,
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
