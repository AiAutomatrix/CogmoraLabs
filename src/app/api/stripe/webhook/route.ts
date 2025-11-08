
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { adminApp } from '@/firebase/admin';

// Initialize Firebase Admin SDK
adminApp();
const db = getFirestore();

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('stripe-signature') as string;
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
    const productId = session?.metadata?.productId;

    if (event.type === 'checkout.session.completed') {
      if (!userId || !productId) {
        console.error('Webhook Error: No userId or productId in session metadata.');
        return NextResponse.json({ message: 'User ID or Product ID missing from session metadata' }, { status: 400 });
      }

      console.log(`✅ Checkout session completed for user: ${userId}, product: ${productId}`);

      try {
        const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);

        if (productId === 'AI_CREDIT_PACK_100') {
           await userContextRef.update({
             ai_credits: FieldValue.increment(100)
           });
           console.log(`✅ Successfully added 100 AI credits to user ${userId}`);
        } else if (productId === 'ACCOUNT_RESET') {
            const historyColRef = userContextRef.collection('tradeHistory');
            const historySnapshot = await historyColRef.get();
            
            const batch = db.batch();
            historySnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            batch.update(userContextRef, { balance: 100000 });
            await batch.commit();

            console.log(`✅ Successfully reset account for user ${userId}`);
        }

      } catch (error) {
        console.error(`Firestore update failed for user ${userId}:`, error);
        return NextResponse.json({ message: 'Webhook handler failed (Firestore update)' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ message: 'Received' }, { status: 200 });
}
