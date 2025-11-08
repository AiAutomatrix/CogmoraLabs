
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { adminApp } from '@/firebase/admin';

// Initialize Firebase Admin SDK
const db = getFirestore(adminApp());

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('stripe-signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set.");
    return NextResponse.json({ message: 'Server configuration error' }, { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`❌ Webhook Error: ${err.message}`);
    return NextResponse.json({ message: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  const permittedEvents = ['checkout.session.completed'];

  if (permittedEvents.includes(event.type)) {
    const session = event.data.object as any; // Cast to any to access metadata
    const userId = session?.metadata?.userId;

    if (event.type === 'checkout.session.completed') {
      if (!userId) {
        console.error('Webhook Error: No userId in session metadata.');
        return NextResponse.json({ message: 'User ID missing from session metadata' }, { status: 400 });
      }

      console.log(`✅ Checkout session completed for user: ${userId}`);

      try {
        // --- THIS IS THE FULFILLMENT LOGIC ---
        // Add AI credits to the user's account in Firestore
        const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);
        await userContextRef.update({
          ai_credits: FieldValue.increment(100)
        });
        console.log(`✅ Successfully added 100 AI credits to user ${userId}`);
        // --------------------------------------
      } catch (error) {
        console.error(`Firestore update failed for user ${userId}:`, error);
        return NextResponse.json({ message: 'Webhook handler failed (Firestore update)' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ message: 'Received' }, { status: 200 });
}
