
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {defineInt} from "firebase-functions/params";

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Define a runtime option for the scheduler function
const maxInstances = defineInt("SCHEDULE_MAX_INSTANCES", {default: 10});

/**
 * Main scheduler function that runs every minute to orchestrate autonomous tasks.
 * It queries for users whose AI agent or watchlist scraper tasks are due.
 */
export const mainScheduler = onSchedule({
  schedule: "every 1 minutes",
  maxInstances,
}, async () => {
  logger.info("Main scheduler waking up...", {structuredData: true});
  const now = admin.firestore.Timestamp.now();
  const currentTime = now.toMillis();

  try {
    // We can run queries in parallel
    const aiTaskPromise = handleAiAgentTasks(currentTime);
    const scraperTaskPromise = handleWatchlistScraperTasks(currentTime);

    await Promise.all([aiTaskPromise, scraperTaskPromise]);

    logger.info("Scheduler run completed successfully.");
  } catch (error) {
    logger.error("Error in main scheduler execution:", error);
  }
});

/**
 * Handles running the AI agent for all due users.
 * @param {number} currentTime The current timestamp in milliseconds.
 */
async function handleAiAgentTasks(currentTime: number) {
  const aiUsersSnapshot = await db.collectionGroup("paperTradingContext")
    .where("aiSettings.scheduleInterval", "!=", null)
    .where("aiSettings.nextRun", "<=", currentTime)
    .get();

  if (aiUsersSnapshot.empty) {
    logger.info("No due AI agent tasks found.");
    return;
  }

  logger.info(`Found ${aiUsersSnapshot.docs.length} users with due AI tasks.`);

  for (const doc of aiUsersSnapshot.docs) {
    const userId = doc.ref.parent.parent?.id;
    const aiSettings = doc.data().aiSettings;

    if (!userId || !aiSettings) continue;

    logger.info(`Processing AI task for user: ${userId}`);

    // In a real implementation, you would invoke the Genkit flow here.
    // This is a placeholder for that logic.
    // For example:
    // const genkitFlow = getGenkitFlow('proposeTradeTriggers');
    // const flowResult = await genkitFlow.invoke({ userId, context... });
    // ... then apply the results.

    // Update the nextRun timestamp
    const nextRun = currentTime + aiSettings.scheduleInterval;
    await doc.ref.update({"aiSettings.nextRun": nextRun});

    logger.info(`AI task for user ${userId} completed. Next run scheduled for ${new Date(nextRun).toISOString()}`);
  }
}

/**
 * Handles running the watchlist scraper for all due users.
 * @param {number} currentTime The current timestamp in milliseconds.
 */
async function handleWatchlistScraperTasks(currentTime: number) {
  const scraperUsersSnapshot = await db.collectionGroup("paperTradingContext")
    .where("automationConfig.updateMode", "==", "auto-refresh")
    .get();

  if (scraperUsersSnapshot.empty) {
    logger.info("No due watchlist scraper tasks found.");
    return;
  }

  for (const doc of scraperUsersSnapshot.docs) {
    const config = doc.data().automationConfig;
    if (!config || !config.lastRun || (config.lastRun + config.refreshInterval > currentTime)) {
      continue; // Skip if not due
    }

    const userId = doc.ref.parent.parent?.id;
    logger.info(`Processing watchlist scraper task for user: ${userId}`);

    // In a real implementation, you would invoke the scraping logic here.
    // This could involve calling external APIs (e.g., KuCoin) and then
    // updating the user's 'watchlist' subcollection in Firestore.

    // Update the lastRun timestamp
    await doc.ref.update({"automationConfig.lastRun": currentTime});
    logger.info(`Watchlist scraper task for user ${userId} completed.`);
  }
}


/**
 * Firestore trigger to handle the closing of a paper trading position.
 * This function calculates P&L, updates the user's balance, and cleans up records.
 */
export const closePositionHandler = onDocumentWritten("/users/{userId}/paperTradingContext/main/openPositions/{positionId}", async (event) => {
  const change = event.data;
  if (!change) return;

  const dataAfter = change.after.data();
  const dataBefore = change.before.data();

  // Check if the position's status was just changed to 'closing'
  if (dataAfter?.details?.status !== "closing" || dataBefore?.details?.status === "closing") {
    return;
  }

  const {userId, positionId} = event.params;
  logger.info(`Detected position closing event for user ${userId}, position ${positionId}`);

  const position = dataAfter;
  const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);

  try {
    await db.runTransaction(async (transaction) => {
      const userContextDoc = await transaction.get(userContextRef);
      if (!userContextDoc.exists) {
        throw new Error("User context document does not exist!");
      }
      const currentBalance = userContextDoc.data()?.balance ?? 0;
      let pnl = 0;
      let collateralToReturn = 0;

      if (position.positionType === "spot") {
        pnl = (position.currentPrice - position.averageEntryPrice) * position.size;
        collateralToReturn = position.size * position.averageEntryPrice; // The initial cost basis is returned
      } else { // Futures
        const contractValue = position.size * position.averageEntryPrice;
        collateralToReturn = contractValue / position.leverage;
        if (position.side === "long") {
          pnl = (position.currentPrice - position.averageEntryPrice) * position.size;
        } else { // short
          pnl = (position.averageEntryPrice - position.currentPrice) * position.size;
        }
      }

      const newBalance = currentBalance + collateralToReturn + pnl;

      // 1. Update the user's balance
      transaction.update(userContextRef, {balance: newBalance});

      // 2. Delete the open position
      transaction.delete(change.after.ref);

      // 3. Find the most recent 'open' trade history record for this positionId and update it.
      const historyQuery = db.collection(`users/${userId}/paperTradingContext/main/tradeHistory`)
        .where("positionId", "==", positionId)
        .where("status", "==", "open")
        .orderBy("timestamp", "desc")
        .limit(1);

      const historySnapshot = await transaction.get(historyQuery);
      if (!historySnapshot.empty) {
        const historyDocRef = historySnapshot.docs[0].ref;
        // Update the single trade history document with the final PNL.
        transaction.update(historyDocRef, {status: "closed", pnl});
      }

      logger.info(`Transaction successful for position ${positionId}. New balance: ${newBalance}, P&L: ${pnl}`);
    });
  } catch (error) {
    logger.error(`Transaction failed for closing position ${positionId}:`, error);
    // Optionally, revert the 'closing' status to allow for a retry
    await change.after.ref.update({"details.status": "open"});
  }
});
