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
    const scraperUsersSnapshot = await db.collectionGroup("paperTradingContext")
      .where("automationConfig.updateMode", "==", "auto-refresh")
      .where("automationConfig.lastRun", "<=", currentTime - 60000)
      .get();

    if (scraperUsersSnapshot.empty) {
      logger.info("No due watchlist scraper tasks found.");
      return;
    }

    logger.info(`Found ${scraperUsersSnapshot.docs.length} users with due auto-refreshing watchlists.`);

    for (const doc of scraperUsersSnapshot.docs) {
      const config = doc.data().automationConfig;
      if (!config || !config.lastRun || (config.lastRun + config.refreshInterval > currentTime)) {
        continue;
      }

      const userId = doc.ref.parent.parent?.id;
      if (!userId) continue;

      logger.info(`Processing watchlist scraper task for user: ${userId}`);

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

      const closePrice = position.details?.closePrice ?? position.currentPrice;

      if (position.positionType === "spot") {
        pnl = (closePrice - position.averageEntryPrice) * position.size;
        collateralToReturn = position.size * position.averageEntryPrice;
      } else {
        const contractValue = position.size * position.averageEntryPrice;
        collateralToReturn = contractValue / position.leverage;
        if (position.side === "long") {
          pnl = (closePrice - position.averageEntryPrice) * position.size;
        } else {
          pnl = (position.averageEntryPrice - closePrice) * position.size;
        }
      }
      const newBalance = currentBalance + collateralToReturn + pnl;

      transaction.update(userContextRef, {balance: newBalance});

      const tradeHistoryRef = userContextRef.collection("tradeHistory").doc();
      const openTradeQuery = db.collection(`users/${userId}/paperTradingContext/main/tradeHistory`)
        .where("positionId", "==", positionId)
        .where("status", "==", "open")
        .orderBy("openTimestamp", "asc")
        .limit(1);

      const openTradeSnapshot = await transaction.get(openTradeQuery);
      const openTimestamp = openTradeSnapshot.docs[0]?.data()?.openTimestamp ?? null;

      const historyRecord = {
        positionId: positionId,
        positionType: position.positionType,
        symbol: position.symbol,
        symbolName: position.symbolName,
        size: position.size,
        entryPrice: position.averageEntryPrice,
        closePrice: closePrice,
        side: position.side === "buy" || position.side === "long" ? "sell" : "buy",
        leverage: position.leverage || null,
        openTimestamp: openTimestamp,
        closeTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: "closed",
        pnl: pnl,
      };
      transaction.set(tradeHistoryRef, historyRecord);

      transaction.delete(change.after.ref);

      logger.info(`Transaction successful for position ${positionId}. New balance: ${newBalance}, P&L: ${pnl}`);
    });
  } catch (error) {
    logger.error(`Transaction failed for closing position ${positionId}:`, error);
    await change.after.ref.update({"details.status": "open"});
  }
});

/**
 * Recalculates and updates aggregate account metrics.
 */
export const calculateAccountMetrics = onDocumentWritten("/users/{userId}/paperTradingContext/main/{subCollection}/{subDocId}", async (event) => {
  const {userId, subCollection} = event.params;

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
    let unrealizedPnl = 0;

    openPositionsSnapshot.forEach((doc) => {
      const pos = doc.data();
      unrealizedPnl += pos.unrealizedPnl || 0;
    });

    const equity = balance + unrealizedPnl;

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