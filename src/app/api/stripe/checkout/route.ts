
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import * as admin from 'firebase-admin';

// --- Robust Firebase Admin Initialization (Singleton Pattern) ---
// This pattern ensures the Firebase Admin app is initialized only once.
if (!admin.apps.length) {
  try {
    // In a Google Cloud environment (like Cloud Run or Cloud Functions v2), 
    // application default credentials are used automatically.
    // For local dev, you'd set the GOOGLE_APPLICATION_CREDENTIALS env var.
    console.log("Initializing Firebase Admin SDK...");
    admin.initializeApp();
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error: any) {
    console.error("Firebase Admin initialization error:", error);
    // We don't throw here, as it might have been initialized in a different context.
    // The check for admin.apps.length should handle most cases.
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
      console.error("Stripe Checkout Error: Missing or invalid Authorization token.");
      return new NextResponse(JSON.stringify({ error: { message: 'Unauthorized: Missing or invalid token.' } }), { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    
    console.log("[API Route] Verifying ID token...");
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;
    console.log(`[API Route] Token verified for userId: ${userId}`);

    const { productId } = await req.json();
    console.log(`[API Route] Received request for productId: ${productId}`);

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

    console.log(`[API Route] Creating Firestore document in customers/${userId}/checkout_sessions to trigger Stripe Extension.`);

    // This write operation is now performed by the trusted server-side route using the Admin SDK.
    const docRef = await adminDb
      .collection("customers")
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
    
    // The client-side will listen to this document path for the checkout URL.
    return NextResponse.json({ firestoreDocPath: docRef.path });

  } catch (err: any) {
    console.error('[API Route] Stripe Checkout Error:', err);
    // Provide a more specific error message if available
    const errorMessage = err.code === 'auth/id-token-expired' 
      ? 'Authentication token expired. Please sign in again.'
      : err.message || 'An unknown server error occurred.';
      
    return NextResponse.json(
      { error: { message: errorMessage } },
      { status: 500 }
    );
  }
}
