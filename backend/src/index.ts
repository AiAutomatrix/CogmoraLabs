
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * * as logger from "firebase-functions/logger";
import {defineInt} from "firebase-functions/params";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Define a runtime option for the scheduler functions
const maxInstances = defineInt("SCHEDULE_MAX_INSTANCES", {default: 10});

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
      .where("aiSettings.scheduleInterval", ">", 0) // Ensures we only get users with scheduling enabled
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

  const position = dataAfter;
  const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);

  try {
    await db.runTransaction(async (transaction) => {
      // --- READS FIRST ---
      const userContextDoc = await transaction.get(userContextRef);
      const historyQuery = db.collection(`users/${userId}/paperTradingContext/main/tradeHistory`)
        .where("positionId", "==", positionId)
        .where("status", "==", "open")
        .orderBy("timestamp", "desc")
        .limit(1);
      const historySnapshot = await transaction.get(historyQuery);

      // --- VALIDATION ---
      if (!userContextDoc.exists) {
        throw new Error("User context document does not exist!");
      }

      // --- CALCULATIONS ---
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

      // --- WRITES LAST ---
      transaction.update(userContextRef, {balance: newBalance});
      transaction.delete(change.after.ref);

      if (!historySnapshot.empty) {
        const historyDocRef = historySnapshot.docs[0].ref;
        transaction.update(historyDocRef, {status: "closed", pnl});
      }

      logger.info(`Transaction successful for position ${positionId}. New balance: ${newBalance}, P&L: ${pnl}`);
    });
  } catch (error) {
    logger.error(`Transaction failed for closing position ${positionId}:`, error);
    // Revert status to 'open' on failure
    await change.after.ref.update({"details.status": "open"});
  }
});

/**
 * Recalculates and updates aggregate account metrics whenever positions or history change.
 */
export const calculateAccountMetrics = onDocumentWritten("/users/{userId}/paperTradingContext/main/{subCollection}/{subDocId}", async (event) => {
  const {userId, subCollection} = event.params;

  // Only trigger for relevant subcollections to avoid unnecessary runs
  if (subCollection !== "openPositions" && subCollection !== "tradeHistory") {
    return;
  }

  const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);

  logger.info(`Metrics calculation triggered for user: ${userId} by change in ${subCollection}`);

  try {
    const openPositionsSnapshot = await userContextRef.collection("openPositions").get();
    const tradeHistorySnapshot = await userContextRef.collection("tradeHistory").get();
    const userContextSnap = await userContextRef.get();

    let balance = 0;

    // **FIX:** If the main document doesn't exist, create it with a default balance.
    // This prevents a race condition on the very first trade.
    if (!userContextSnap.exists) {
      logger.warn(`User context for ${userId} not found. Creating it with default metrics.`);
      const initialMetrics = {
        balance: 100000,
        equity: 100000,
        unrealizedPnl: 0,
        realizedPnl: 0,
        winRate: 0,
        wonTrades: 0,
        lostTrades: 0,
      };
      await userContextRef.set(initialMetrics);
      balance = initialMetrics.balance;
    } else {
      balance = userContextSnap.data()?.balance ?? 0;
    }


    // Calculate Unrealized P&L from all open positions
    let unrealizedPnl = 0;
    openPositionsSnapshot.forEach((doc) => {
      const pos = doc.data();
      // **FIX:** Use the unrealizedPnl value already calculated and stored on the position document.
      unrealizedPnl += pos.unrealizedPnl || 0;
    });

    // Calculate Equity
    const equity = balance + unrealizedPnl;

    // Calculate Realized P&L and Win Rate from all closed trades
    let realizedPnl = 0;
    let wonTrades = 0;
    let lostTrades = 0;

    tradeHistorySnapshot.forEach((doc) => {
      const trade = doc.data();
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

    // Prepare the final metrics object to update Firestore
    const metrics = {
      equity,
      unrealizedPnl,
      realizedPnl,
      winRate,
      wonTrades,
      lostTrades,
    };

    // Update the main context document with the newly calculated metrics
    await userContextRef.update(metrics);
    logger.info(`Successfully updated account metrics for user ${userId}.`, metrics);
  } catch (error) {
    logger.error(`Error calculating metrics for user ${userId}:`, error);
  }
});
