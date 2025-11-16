
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminAuth, adminDb } from '@/firebase/admin';
import { onSnapshot, doc } from 'firebase/firestore';

export async function POST(req: Request) {
  console.log('[API Route] /api/stripe/checkout received a POST request.');

  const headersList = headers();
  const origin = headersList.get('origin') || 'http://localhost:9002';

  try {
    const authorization = headersList.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      console.error("Stripe Checkout Error: Missing Authorization token.");
      return new NextResponse(JSON.stringify({ error: { message: 'Unauthorized: Missing token.' } }), { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { productId } = await req.json();
    console.log(`[API Route] Received request for userId: ${userId}, productId: ${productId}`);

    let priceId;
    if (productId === 'AI_CREDIT_PACK_100') {
      priceId = process.env.STRIPE_AI_CREDIT_PRICE_ID;
    } else {
      console.error(`[API Route] Unknown product ID: ${productId}`);
      return NextResponse.json({ error: { message: `Unknown product ID: ${productId}` } }, { status: 400 });
    }

    if (!priceId) {
        console.error(`[API Route] Stripe Price ID not found in .env for productId: ${productId}`);
        return NextResponse.json({ error: { message: `Stripe Price ID not found for product: ${productId}` } }, { status: 500 });
    }

    console.log(`[API Route] Creating Firestore document for user ${userId} to trigger Stripe Extension.`);

    // CORRECTED PATH: Write to the 'checkout_sessions' subcollection within the 'users' collection.
    const docRef = await adminDb
      .collection("users") // Using the 'users' collection
      .doc(userId)
      .collection("checkout_sessions")
      .add({
        price: priceId,
        success_url: `${origin}/dashboard?payment=success`,
        cancel_url: `${origin}/dashboard?payment=cancelled`,
        metadata: {
            userId: userId,
            productId: productId,
        }
      });
      
    console.log(`[API Route] Successfully created checkout_sessions doc: ${docRef.id} at path: ${docRef.path}`);
    
    // Return the path to the document so the client knows where to listen.
    return NextResponse.json({ firestoreDocPath: docRef.path });

  } catch (err: any) {
    console.error('[API Route] Stripe Checkout Error:', err);
    return NextResponse.json(
      { error: { message: err.message || 'An unknown server error occurred.' } },
      { status: 500 }
    );
  }
}
