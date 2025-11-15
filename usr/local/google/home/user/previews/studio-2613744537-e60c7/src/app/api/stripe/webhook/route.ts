import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';
// Import the initialized adminDb instance
import { adminDb } from '@/firebase/admin';
import * as admin from 'firebase-admin';

// This is your Stripe CLI webhook secret for testing your endpoint locally.
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const productId = session.metadata?.productId;

    if (!userId || !productId) {
        console.error('Webhook Error: Missing userId or productId in session metadata.', session.id);
        return;
    }

    console.log(`Fulfilling order for userId: ${userId}, productId: ${productId}`);

    if (productId === 'AI_CREDIT_PACK_100') {
        const userContextRef = adminDb.doc(`users/${userId}/paperTradingContext/main`);
        try {
            // Use the imported admin.firestore instance for FieldValue
            await userContextRef.update({
                ai_credits: admin.firestore.FieldValue.increment(100)
            });
            console.log(`Successfully added 100 AI credits to user ${userId}`);
        } catch (error) {
            console.error(`Failed to update AI credits for user ${userId}:`, error);
        }
    }
}

export async function POST(req: Request) {
    const body = await req.text();
    const signature = headers().get('Stripe-Signature') as string;

    let event: Stripe.Event;

    if (!webhookSecret) {
        console.error('Stripe webhook secret is not set.');
        return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 500 });
    }

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
        console.error(`❌ Webhook signature verification failed: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object as Stripe.Checkout.Session;
            console.log('✅ Received checkout.session.completed event for session:', session.id);
            await handleCheckoutSessionCompleted(session);
            break;
        // ... handle other event types
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    return NextResponse.json({ received: true });
}
