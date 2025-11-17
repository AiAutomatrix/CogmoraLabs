
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentWritten, onDocumentCreated, onDocumentUpdated} from "firebase-functions/v2/firestore";
import {onRequest} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {defineInt} from "firebase-functions/params";
import Stripe from 'stripe';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const auth = admin.auth();

// Initialize Stripe with secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-06-20',
});


// --- TYPE DEFINITIONS ---
// Duplicated from frontend/src/types to make the backend self-contained.
interface OpenPositionDetails {
  stopLoss?: number;
  takeProfit?: number;
  triggeredBy?: string;
  status?: "open" | "closing";
  closePrice?: number;
}

interface OpenPosition {
  id: string;
  positionType: "spot" | "futures";
  symbol: string;
  symbolName: string;
  size: number;
  averageEntryPrice: number;
  currentPrice: number;
  side: "buy" | "long" | "short";
  leverage?: number | null;
  unrealizedPnl?: number;
  priceChgPct?: number;
  liquidationPrice?: number;
  details?: OpenPositionDetails;
}

interface PaperTrade {
  positionId: string;
  positionType: "spot" | "futures";
  symbol: string;
  symbolName: string;
  size: number;
  entryPrice: number;
  closePrice?: number | null;
  side: "buy" | "sell" | "long" | "short";
  leverage: number | null;
  openTimestamp: admin.firestore.Timestamp | number | admin.firestore.FieldValue | null;
  closeTimestamp?: admin.firestore.Timestamp | number | admin.firestore.FieldValue;
  status: "open" | "closed";
  pnl?: number | null;
}

interface TradeTriggerDetails {
  status: "active" | "executed" | "canceled";
}

interface TradeTrigger {
  id: string;
  symbol: string;
  symbolName: string;
  type: "spot" | "futures";
  condition: "above" | "below";
  targetPrice: number;
  action: "buy" | "long" | "short";
  amount: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  details: TradeTriggerDetails;
  currentPrice?: number; // Added to match executedTrigger structure
}

// Define a runtime option for the scheduler functions
const maxInstances = defineInt("SCHEDULE_MAX_INSTANCES", {default: 10});

/**
 * ===============================================================
 *                 STRIPE CHECKOUT FUNCTION
 * ===============================================================
 * Creates a checkout session document in Firestore to trigger the Stripe extension.
 * This is a public function but requires a valid Firebase Auth token for security.
 */
export const handleCheckoutCreation = onRequest({cors: true}, async (request, response) => {
  if (request.method === "OPTIONS") {
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.status(204).send();
    return;
  }
  // Set CORS for the actual request as well
  response.set("Access-Control-Allow-Origin", "*");


  if (request.method !== "POST") {
    response.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      logger.error("Unauthorized: Missing or invalid Authorization token.");
      response.status(401).json({error: {message: "Unauthorized: Missing or invalid token."}});
      return;
    }
    const idToken = authorization.split("Bearer ")[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;
    logger.info(`Token verified for userId: ${userId}`);

    const {productId} = request.body;
    if (!productId) {
      logger.error("Bad Request: Product ID is missing.");
      response.status(400).json({error: {message: "Missing required data: productId."}});
      return;
    }
    logger.info(`Creating checkout session for user: ${userId}, productId: ${productId}`);

    let priceId;
    if (productId === "AI_CREDIT_PACK_100") {
      priceId = "price_1SREGsR1GTVMlhwAIHGT4Ofd"; // Use env var in real app
    } else {
      logger.error(`Unknown product ID received: ${productId}`);
      response.status(400).json({error: {message: `Unknown product ID: ${productId}`}});
      return;
    }

    const docRef = await db
      .collection("customers")
      .doc(userId)
      .collection("checkout_sessions")
      .add({
        mode: "payment", // Specify one-time payment mode
        price: priceId,
        success_url: "https://cogmora-labs.vercel.app/dashboard",
        cancel_url: "https://cogmora-labs.vercel.app/dashboard",
        metadata: {
          userId: userId,
          productId: productId,
        },
      });

    logger.info(`Successfully created checkout session doc: ${docRef.id}`);
    response.json({firestoreDocPath: docRef.path});
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    logger.error("FAILED to create checkout session document in Firestore.", {error: e});
    response.status(500).json({error: {message: `Failed to create checkout session: ${errorMessage}`}});
  }
});

/**
 * ===============================================================
 *                 STRIPE WEBHOOK HANDLER
 * ===============================================================
 * Listens for events from Stripe, primarily to fulfill successful purchases.
 */
export const stripeWebhook = onRequest(async (request, response) => {
    const signature = request.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
        logger.error("Stripe webhook error: Missing signature or secret.");
        response.status(400).send("Webhook Error: Missing signature or secret.");
        return;
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(request.rawBody, signature, webhookSecret);
    } catch (err: any) {
        logger.error(`❌ Webhook signature verification failed: ${err.message}`);
        response.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const productId = session.metadata?.productId;

        if (!userId || !productId) {
            logger.error('Webhook Error: Missing userId or productId in session metadata.', {sessionId: session.id});
            response.status(400).send("Metadata missing in webhook event.");
            return;
        }

        logger.info(`Fulfilling order for userId: ${userId}, productId: ${productId}`);

        if (productId === 'AI_CREDIT_PACK_100') {
            const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);
            try {
                // Use FieldValue.increment to atomically add credits.
                await userContextRef.update({
                    ai_credits: admin.firestore.FieldValue.increment(100)
                });
                logger.info(`Successfully added 100 AI credits to user ${userId}`);
            } catch (error) {
                logger.error(`Failed to update AI credits for user ${userId}:`, error);
                // Respond with an error to let Stripe know the webhook failed
                response.status(500).send("Failed to update user credits in Firestore.");
                return;
            }
        }
    }

    // Acknowledge receipt of the event
    response.status(200).json({ received: true });
});


/**
 * ===============================================================
 *                 PAYMENT LINK FORWARDER
 * ===============================================================
 * This function triggers when a checkout_session is updated by the Stripe extension.
 * It copies the checkout URL to the user's main document, which the client can read.
 */
export const forwardPaymentLink = onDocumentUpdated("/customers/{userId}/checkout_sessions/{sessionId}", async (event) => {
  const change = event.data;
  if (!change) return;

  const dataAfter = change.after.data();
  const dataBefore = change.before.data();
  const userId = event.params.userId;

  // Check if the 'url' or 'sessionId' field was just added
  if (dataAfter && (dataAfter.url || dataAfter.sessionId) && !(dataBefore.url || dataBefore.sessionId)) {
    const checkoutUrl = dataAfter.url || `https://checkout.stripe.com/pay/${dataAfter.sessionId}`;
    logger.info(`Forwarding checkout URL for user: ${userId}`);

    try {
      const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);
      await userContextRef.update({
        activeCheckoutUrl: checkoutUrl,
        activeCheckoutId: event.params.sessionId, // Store session ID for cleanup
      });
      logger.info(`Successfully forwarded URL to user document for user: ${userId}`);
    } catch (error) {
      logger.error(`Failed to forward checkout URL for user ${userId}:`, error);
    }
  }
});


/**
 * Scheduled function that runs every minute to execute due AI agent tasks.
 */
export const aiAgentScheduler = onSchedule({
  schedule: "every 1 minutes",
  maxInstances,
}, async () => {
  logger.info("AI Agent Scheduler waking up...");
  const now = admin.firestore.Timestamp.now();
  const currentTime = now.toMillis();

  try {
    const aiUsersSnapshot = await db.collectionGroup("paperTradingContext")
      .where("aiSettings.scheduleInterval", ">", 0)
      .where("aiSettings.nextRun", "<=", currentTime)
      .get();

    if (aiUsersSnapshot.empty) {
      logger.info("No due AI agent tasks found.");
      return;
    }

    logger.info(`Found ${aiUsersSnapshot.docs.length} potential users with due AI tasks.`);

    for (const doc of aiUsersSnapshot.docs) {
      const userId = doc.ref.parent.parent?.id;
      const aiSettings = doc.data().aiSettings;

      if (!userId || !aiSettings || !aiSettings.scheduleInterval) {
        continue;
      }

      logger.info(`Processing AI task for user: ${userId}`);

      // In a real implementation, you would invoke the Genkit flow here.
      // ...

      const nextRun = currentTime + aiSettings.scheduleInterval;
      await doc.ref.update({"aiSettings.nextRun": nextRun});

      logger.info(`AI task for user ${userId} completed. Next run scheduled for ${new Date(nextRun).toISOString()}`);
    }
  } catch (error) {
    logger.error("--- ERROR IN AI AGENT SCHEDULER ---", error);
    logger.error("This likely means you are missing a Firestore composite index. Required index: collectionGroup='paperTradingContext', fields=[(aiSettings.nextRun, ASCENDING), (aiSettings.scheduleInterval, ASCENDING)]");
  }
});


/**
 * Scheduled function that runs every minute to execute due watchlist scraper tasks.
 */
export const watchlistScraperScheduler = onSchedule({
  schedule: "every 1 minutes",
  maxInstances,
}, async () => {
  logger.info("Watchlist Scraper Scheduler waking up...");
  const now = admin.firestore.Timestamp.now();
  const currentTime = now.toMillis();

  try {
    // Corrected query to use both fields in the composite index.
    const scraperUsersSnapshot = await db.collectionGroup("paperTradingContext")
      .where("automationConfig.updateMode", "==", "auto-refresh")
      .where("automationConfig.lastRun", "<=", currentTime - 60000) // 1-minute buffer
      .get();

    if (scraperUsersSnapshot.empty) {
      logger.info("No due watchlist scraper tasks found.");
      return;
    }

    logger.info(`Found ${scraperUsersSnapshot.docs.length} users with due auto-refreshing watchlists.`);

    for (const doc of scraperUsersSnapshot.docs) {
      const config = doc.data().automationConfig;
      // The main time check is now in the query, but we add a small buffer here to be safe.
      if (!config || !config.lastRun || (config.lastRun + config.refreshInterval > currentTime)) {
        continue;
      }

      const userId = doc.ref.parent.parent?.id;
      if (!userId) continue;

      logger.info(`Processing watchlist scraper task for user: ${userId}`);

      // In a real implementation, you would invoke scraping logic here.
      // ...

      await doc.ref.update({"automationConfig.lastRun": currentTime});
      logger.info(`Watchlist scraper task for user ${userId} completed.`);
    }
  } catch (error) {
    logger.error("--- ERROR IN WATCHLIST SCRAPER SCHEDULER ---", error);
    logger.error("This likely means you are missing a Firestore composite index. Required index: collectionGroup='paperTradingContext', fields=[(automationConfig.updateMode, ASCENDING), (automationConfig.lastRun, ASCENDING)]");
  }
});


/**
 * Firestore trigger to handle the closing of a paper trading position.
 * This function calculates P&L, updates the user's balance, and cleans up records.
 */
export const closePositionHandler = onDocumentWritten("/users/{userId}/paperTradingContext/main/openPositions/{positionId}", async (event) => {
  const change = event.data;
  if (!change) return;

  const dataAfter = change.after.data();
  const dataBefore = change.before.data();

  if (dataAfter?.details?.status !== "closing" || dataBefore?.details?.status === "closing") {
    return;
  }

  const {userId, positionId} = event.params;
  logger.info(`Detected position closing event for user ${userId}, position ${positionId}`);

  const position = dataAfter as OpenPosition;
  const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);

  try {
    await db.runTransaction(async (transaction) => {
      // --- READS FIRST ---
      const userContextDoc = await transaction.get(userContextRef);
      const openTradeQuery = db.collection(`users/${userId}/paperTradingContext/main/tradeHistory`)
        .where("positionId", "==", positionId)
        .where("status", "==", "open")
        .orderBy("openTimestamp", "asc")
        .limit(1);
      const openTradeSnapshot = await transaction.get(openTradeQuery);

      // --- VALIDATION ---
      if (!userContextDoc.exists) {
        throw new Error("User context document does not exist!");
      }

      // --- CALCULATIONS ---
      const currentBalance = userContextDoc.data()?.balance ?? 0;
      let pnl = 0;
      let collateralToReturn = 0;

      // Prioritize the closePrice set by the client, fallback to currentPrice for backend triggers
      const closePrice = position.details?.closePrice ?? position.currentPrice;

      if (position.positionType === "spot") {
        pnl = (closePrice - position.averageEntryPrice) * position.size;
        collateralToReturn = position.size * position.averageEntryPrice;
      } else { // Futures
        const contractValue = position.size * position.averageEntryPrice;
        collateralToReturn = contractValue / (position.leverage ?? 1);
        if (position.side === "long") {
          pnl = (closePrice - position.averageEntryPrice) * position.size;
        } else { // short
          pnl = (position.averageEntryPrice - closePrice) * position.size;
        }
      }
      const newBalance = currentBalance + collateralToReturn + pnl;

      // --- WRITES LAST ---
      // 1. Update the main balance
      transaction.update(userContextRef, {balance: newBalance});

      // 2. Create the trade history record for the closed position
      const tradeHistoryRef = userContextRef.collection("tradeHistory").doc();
      const openTimestamp = openTradeSnapshot.docs[0]?.data()?.openTimestamp ?? null;

      const historyRecord: PaperTrade = {
        positionId: positionId,
        positionType: position.positionType,
        symbol: position.symbol,
        symbolName: position.symbolName,
        size: position.size,
        entryPrice: position.averageEntryPrice, // Log the entry price
        closePrice: closePrice, // Use the determined closing price
        side: position.side === "buy" || position.side === "long" ? "sell" : "buy", // Record the closing action
        leverage: position.leverage || null,
        openTimestamp: openTimestamp,
        closeTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: "closed",
        pnl: pnl,
      };
      transaction.set(tradeHistoryRef, historyRecord);

      // 3. Delete the open position
      transaction.delete(change.after.ref);

      logger.info(`Transaction successful for position ${positionId}. New balance: ${newBalance}, P&L: ${pnl}`);
    });
  } catch (error) {
    logger.error(`Transaction failed for closing position ${positionId}:`, error);
    // Revert status to 'open' on failure to allow for retry
    await change.after.ref.update({"details.status": "open"});
  }
});

/**
 * Firestore trigger to handle the opening of a new position from an executed trigger.
 * This is the single source of truth for creating trades from triggers.
 */
export const openPositionHandler = onDocumentCreated("/users/{userId}/paperTradingContext/main/executedTriggers/{triggerId}", async (event) => {
  const {userId, triggerId} = event.params;
  const executedTrigger = event.data?.data() as TradeTrigger;

  if (!executedTrigger) {
    logger.error(`No data for executed trigger ${triggerId} for user ${userId}.`);
    return;
  }

  // --- CRITICAL VALIDATION ---
  if (executedTrigger.type === "futures" && (executedTrigger.action !== "long" && executedTrigger.action !== "short")) {
    logger.error(`CRITICAL: Invalid futures trigger action detected. Deleting trigger ${triggerId}. Action was: "${executedTrigger.action}"`);
    await event.data!.ref.delete();
    return; // Stop processing
  }

  logger.info(`Detected executed trigger ${triggerId} for user ${userId}. Opening position...`);

  const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);

  try {
    await db.runTransaction(async (transaction) => {
      const userContextDoc = await transaction.get(userContextRef);
      if (!userContextDoc.exists) {
        throw new Error(`User context not found for user ${userId}.`);
      }

      const currentBalance = userContextDoc.data()?.balance ?? 0;
      const {type, action, amount, leverage, symbol, symbolName, id, stopLoss, takeProfit} = executedTrigger;
      const currentPrice = executedTrigger.currentPrice; // Price at execution time

      if (!currentPrice) {
        throw new Error(`Executed trigger ${triggerId} is missing currentPrice.`);
      }

      // --- CLOSE OPPOSING POSITION LOGIC ---
      const openPositionsRef = userContextRef.collection("openPositions");
      if (type === "futures") {
        const sideToClose = action === "long" ? "short" : "long";
        const conflictingPositionQuery = openPositionsRef
          .where("symbol", "==", symbol)
          .where("side", "==", sideToClose)
          .where("positionType", "==", "futures")
          .limit(1);
        const conflictingSnapshot = await transaction.get(conflictingPositionQuery);
        if (!conflictingSnapshot.empty) {
          const conflictingPosDoc = conflictingSnapshot.docs[0];
          logger.info(`Found conflicting ${sideToClose} position (${conflictingPosDoc.id}) for new ${action} trigger. Closing it first.`);
          transaction.update(conflictingPosDoc.ref, {"details.status": "closing", "details.closePrice": currentPrice});
        }
      }
      // --- END CLOSE OPPOSING POSITION LOGIC ---

      if (type === "spot") {
        if (currentBalance < amount) {
          throw new Error("Insufficient balance for spot buy.");
        }
        const size = amount / currentPrice;
        const newBalance = currentBalance - amount;

        // Check for existing position to average into
        const existingPositionQuery = openPositionsRef.where("symbol", "==", symbol).where("positionType", "==", "spot").limit(1);
        const existingPositionSnapshot = await transaction.get(existingPositionQuery);

        let positionId: string;
        if (!existingPositionSnapshot.empty) {
          const posDoc = existingPositionSnapshot.docs[0];
          const posData = posDoc.data() as OpenPosition;
          positionId = posDoc.id;
          const totalSize = posData.size + size;
          const totalValue = (posData.size * posData.averageEntryPrice) + (size * currentPrice);
          transaction.update(posDoc.ref, {size: totalSize, averageEntryPrice: totalValue / totalSize});
        } else {
          const newPositionRef = openPositionsRef.doc();
          positionId = newPositionRef.id;
          const newPosition: OpenPosition = {id: positionId, positionType: "spot", symbol, symbolName, size, averageEntryPrice: currentPrice, currentPrice, side: "buy", details: {triggeredBy: `trigger:${id.slice(0, 8)}`, stopLoss, takeProfit, status: "open"}};
          transaction.set(newPositionRef, newPosition);
        }

        const newTrade: Omit<PaperTrade, "id" | "closeTimestamp" | "pnl" | "closePrice"> = {positionId, positionType: "spot", symbol, symbolName, size, entryPrice: currentPrice, side: "buy", leverage: null, openTimestamp: admin.firestore.FieldValue.serverTimestamp(), status: "open"};
        transaction.set(userContextRef.collection("tradeHistory").doc(), newTrade);
        transaction.update(userContextRef, {balance: newBalance});
      } else { // Futures
        if (currentBalance < amount) {
          throw new Error("Insufficient balance for futures collateral.");
        }
        const positionValue = amount * leverage;
        const size = positionValue / currentPrice;
        const newBalance = currentBalance - amount;
        const side = action as "long" | "short";
        const liquidationPrice = side === "long" ? currentPrice * (1 - (1/leverage)) : currentPrice * (1 + (1/leverage));

        const newPositionRef = userContextRef.collection("openPositions").doc();
        const positionId = newPositionRef.id;
        const newPosition: OpenPosition = {id: positionId, positionType: "futures", symbol, symbolName, size, averageEntryPrice: currentPrice, currentPrice, side, leverage, liquidationPrice, details: {triggeredBy: `trigger:${id.slice(0, 8)}`, stopLoss, takeProfit, status: "open"}};
        transaction.set(newPositionRef, newPosition);

        const newTrade: Omit<PaperTrade, "id" | "closeTimestamp" | "pnl" | "closePrice"> = {positionId, positionType: "futures", symbol, symbolName, size, entryPrice: currentPrice, side, leverage, openTimestamp: admin.firestore.FieldValue.serverTimestamp(), status: "open"};
        transaction.set(userContextRef.collection("tradeHistory").doc(), newTrade);
        transaction.update(userContextRef, {balance: newBalance});
      }

      // Finally, delete the executed trigger document
      transaction.delete(event.data!.ref);
    });

    logger.info(`Successfully opened position for trigger ${triggerId}.`);
  } catch (error) {
    logger.error(`Transaction failed for opening position from trigger ${triggerId}:`, error);
    // Delete the failed trigger to prevent retries
    await event.data!.ref.delete();
  }
});


/**
 * Recalculates and updates aggregate account metrics.
 * This can be triggered by changes in positions or history.
 */
export const updateAccountMetrics = onDocumentWritten("/users/{userId}/paperTradingContext/main/{subCollection}/{subDocId}", async (event) => {
  const {userId, subCollection} = event.params;

  // Only trigger for relevant subcollections
  if (subCollection !== "openPositions" && subCollection !== "tradeHistory") {
    return;
  }

  const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);

  logger.info(`Metrics calculation triggered for user: ${userId} by change in ${subCollection}`);

  try {
    const openPositionsSnapshot = await userContextRef.collection("openPositions").get();
    const tradeHistorySnapshot = await userContextRef.collection("tradeHistory").get();
    const userContextSnap = await userContextRef.get();

    if (!userContextSnap.exists) {
      logger.warn(`User context for ${userId} not found. Skipping metrics calculation.`);
      return;
    }

    const balance = userContextSnap.data()?.balance ?? 0;

    // Calculate Unrealized P&L
    let unrealizedPnl = 0;
    openPositionsSnapshot.forEach((doc) => {
      const pos = doc.data() as OpenPosition;
      unrealizedPnl += pos.unrealizedPnl || 0;
    });

    // Calculate Equity
    const equity = balance + unrealizedPnl;

    // Calculate Realized P&L and Win Rate
    let realizedPnl = 0;
    let wonTrades = 0;
    let lostTrades = 0;

    tradeHistorySnapshot.forEach((doc) => {
      const trade = doc.data() as PaperTrade;
      if (trade.status === "closed" && trade.pnl !== undefined && trade.pnl !== null) {
        realizedPnl += trade.pnl;
        if (trade.pnl > 0) {
          wonTrades++;
        } else {
          lostTrades++;
        }
      }
    });

    const totalClosedTrades = wonTrades + lostTrades;
    const winRate = totalClosedTrades > 0 ? (wonTrades / totalClosedTrades) * 100 : 0;

    const metrics = {
      equity,
      unrealizedPnl,
      realizedPnl,
      winRate,
      wonTrades,
      lostTrades,
    };

    await userContextRef.update(metrics);
    logger.info(`Successfully updated account metrics for user ${userId}.`, metrics);
  } catch (error) {
    logger.error(`Error calculating metrics for user ${userId}:`, error);
  }
});
