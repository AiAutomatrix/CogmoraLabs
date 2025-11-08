
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/firebase/admin';

// Initialize Firebase Admin SDK
adminApp();

export async function POST(req: Request) {
  const headersList = headers();
  const origin = headersList.get('origin') || 'http://localhost:9002';

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
    // Using the test Price ID from the user's sample code.
    if (productId === 'AI_CREDIT_PACK_100') {
      priceId = process.env.STRIPE_AI_CREDIT_PRICE_ID || 'price_1SREGsR1GTVMlhwAIHGT4Ofd';
    } else if (productId === 'ACCOUNT_RESET') {
      // We can add a different price ID for this later.
      priceId = process.env.STRIPE_ACCOUNT_RESET_PRICE_ID || 'price_1SREGsR1GTVMlhwAIHGT4Ofd';
    } else {
        return NextResponse.json({ error: { message: 'Invalid product ID' } }, { status: 400 });
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
      success_url: `${origin}/dashboard?payment=success`,
      cancel_url: `${origin}/dashboard?payment=cancelled`,
      metadata: {
        userId: userId,
        productId: productId,
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
