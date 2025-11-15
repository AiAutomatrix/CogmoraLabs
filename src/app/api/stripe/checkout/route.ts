
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminApp } from '@/firebase/admin';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
const db = admin.firestore(adminApp());

export async function POST(req: Request) {
  const headersList = await headers();
  const origin = headersList.get('origin') || 'http://localhost:9002';

  try {
    const authorization = headersList.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      console.error("Stripe Checkout Error: Missing Authorization token.");
      return new NextResponse(JSON.stringify({ error: { message: 'Unauthorized: Missing token.' } }), { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await admin.auth(adminApp()).verifyIdToken(idToken);
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

    // This now mimics the working Cloud Function. It writes to Firestore and lets the extension handle Stripe.
    const docRef = await db
      .collection("customers")
      .doc(userId)
      .collection("checkout_sessions")
      .add({
        price: priceId,
        success_url: `${origin}/dashboard?payment=success`,
        cancel_url: `${origin}/dashboard?payment=cancelled`,
        // We can add metadata if needed by the webhook later
        metadata: {
            userId: userId,
            productId: productId,
        }
      });
      
    console.log(`[API Route] Successfully created checkout_sessions doc: ${docRef.id}. Waiting for extension to populate URL...`);
    
    // The client-side will now listen to this document for the Stripe URL.
    // We return the path to the document so the client knows where to listen.
    return NextResponse.json({ firestoreDocPath: docRef.path });

  } catch (err: any) {
    console.error('[API Route] Stripe Checkout Error:', err);
    return NextResponse.json(
      { error: { message: err.message || 'An unknown server error occurred.' } },
      { status: 500 }
    );
  }
}
