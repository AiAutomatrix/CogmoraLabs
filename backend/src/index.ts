
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {defineInt} from "firebase-functions/params";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}
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
  logger.info("Main scheduler waking up...");
  const now = admin.firestore.Timestamp.now();
  const currentTime = now.toMillis();

  // Run tasks in parallel with specific error handling
  const aiTaskPromise = handleAiAgentTasks(currentTime).catch((error) => {
    logger.error("Error in AI agent tasks execution:", error);
  });

  const scraperTaskPromise = handleWatchlistScraperTasks(currentTime).catch((error) => {
    logger.error("Error in watchlist scraper tasks execution:", error);
  });

  await Promise.all([aiTaskPromise, scraperTaskPromise]);

  logger.info("Scheduler run finished.");
});

/**
 * Handles running the AI agent for all due users.
 * @param {number} currentTime The current timestamp in milliseconds.
 */
async function handleAiAgentTasks(currentTime: number) {
  const aiUsersSnapshot = await db.collectionGroup("paperTradingContext")
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

  logger.info(`Found ${scraperUsersSnapshot.docs.length} users with auto-refreshing watchlists.`);

  for (const doc of scraperUsersSnapshot.docs) {
    const config = doc.data().automationConfig;
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
        collateralToReturn = position.size * position.averageEntryPrice;
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

      transaction.update(userContextRef, {balance: newBalance});
      transaction.delete(change.after.ref);

      const historyQuery = db.collection(`users/${userId}/paperTradingContext/main/tradeHistory`)
        .where("positionId", "==", positionId)
        .where("status", "==", "open")
        .orderBy("timestamp", "desc")
        .limit(1);

      const historySnapshot = await transaction.get(historyQuery);
      if (!historySnapshot.empty) {
        const historyDocRef = historySnapshot.docs[0].ref;
        transaction.update(historyDocRef, {status: "closed", pnl});
      }

      logger.info(`Transaction successful for position ${positionId}. New balance: ${newBalance}, P&L: ${pnl}`);
    });
  } catch (error) {
    logger.error(`Transaction failed for closing position ${positionId}:`, error);
    await change.after.ref.update({"details.status": "open"});
  }
});
