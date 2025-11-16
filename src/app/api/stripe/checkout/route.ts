
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import * as admin from 'firebase-admin';

// --- Robust Firebase Admin Initialization ---
// This pattern ensures that the Firebase Admin app is initialized only once per server instance.
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!))
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error: any) {
    console.error("Firebase Admin initialization error:", error);
    // In a real app, you might want to throw an error here or handle it differently.
  }
}

const adminAuth = admin.auth();
const adminDb = admin.firestore();
// --- End of Initialization ---


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

    console.log(`[API Route] Creating Firestore document in users/${userId}/checkout_sessions to trigger Stripe Extension.`);

    // Write to the 'checkout_sessions' subcollection within the user's document
    const docRef = await adminDb
      .collection("users")
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
