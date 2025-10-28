
// index.ts (Firebase Functions v2)
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { defineInt } from "firebase-functions/params";

// ========== Type Definitions ==========
interface OpenPositionDetails {
  stopLoss?: number;
  takeProfit?: number;
  triggeredBy?: string;
  status?: 'open' | 'closing';
  closePrice?: number;
}
interface OpenPosition {
  id: string;
  positionType: 'spot' | 'futures';
  symbol: string;
  symbolName: string;
  size: number;
  averageEntryPrice: number;
  currentPrice: number;
  side: 'buy' | 'long' | 'short';
  leverage?: number | null;
  unrealizedPnl?: number;
  priceChgPct?: number;
  liquidationPrice?: number;
  details?: OpenPositionDetails;
}
interface PaperTrade {
  id?: string;
  positionId: string;
  positionType: 'spot' | 'futures';
  symbol: string;
  symbolName: string;
  size: number;
  entryPrice: number;
  closePrice?: number | null;
  side: 'buy' | 'sell' | 'long' | 'short';
  leverage: number | null;
  openTimestamp: number | admin.firestore.FieldValue;
  closeTimestamp?: any;
  status: 'open' | 'closed';
  pnl?: number | null;
}
interface TradeTriggerDetails {
  status: 'active' | 'executed' | 'canceled';
}
interface TradeTrigger {
  id: string;
  symbol: string;
  symbolName: string;
  type: 'spot' | 'futures';
  condition: 'above' | 'below';
  targetPrice: number;
  action: 'buy' | 'long' | 'short';
  amount: number;
  leverage: number;
  cancelOthers?: boolean;
  stopLoss?: number;
  takeProfit?: number;
  details: TradeTriggerDetails;
}


// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Define a runtime option for the scheduler functions
const maxInstances = defineInt("SCHEDULE_MAX_INSTANCES", { default: 10 });

/**
 * Scheduled function that runs every minute to execute due AI agent tasks.
 */
export const aiAgentScheduler = onSchedule(
  {
    schedule: "every 1 minutes",
    maxInstances,
  },
  async () => {
    logger.info("🤖 AI Agent Scheduler waking up...");
    const now = admin.firestore.Timestamp.now();
    const currentTime = now.toMillis();
    try {
      const aiUsersSnapshot = await db
        .collectionGroup("paperTradingContext")
        .where("aiSettings.scheduleInterval", ">", 0)
        .where("aiSettings.nextRun", "<=", currentTime)
        .get();

      if (aiUsersSnapshot.empty) {
        logger.info("🟢 No due AI agent tasks found.");
        return;
      }

      logger.info(`🔎 Found ${aiUsersSnapshot.docs.length} potential users with due AI tasks.`);
      for (const doc of aiUsersSnapshot.docs) {
        const userId = doc.ref.parent.parent?.id;
        const aiSettings = doc.data().aiSettings;
        if (!userId || !aiSettings || !aiSettings.scheduleInterval) {
          logger.warn("⚠️ Skipping doc due to missing userId or aiSettings:", doc.ref.path);
          continue;
        }
        logger.info(`🧭 Processing AI task for user: ${userId}`);
        // TODO: invoke Genkit/AI flow here

        // schedule next run
        const nextRun = currentTime + Number(aiSettings.scheduleInterval);
        try {
          await doc.ref.update({ "aiSettings.nextRun": nextRun });
          logger.info(`✅ AI task for user ${userId} completed. Next run: ${new Date(nextRun).toISOString()}`);
        } catch (err) {
          logger.error(`❌ Failed to update nextRun for user ${userId}:`, err);
        }
      }
    } catch (error) {
      logger.error("--- ERROR IN AI AGENT SCHEDULER ---", error);
      logger.error(
        "This likely means you are missing a Firestore composite index. Required index: collectionGroup='paperTradingContext', fields=[(aiSettings.nextRun, ASCENDING), (aiSettings.scheduleInterval, ASCENDING)]"
      );
    }
  }
);

/**
 * Scheduled function that runs every minute to execute due watchlist scraper tasks.
 */
export const watchlistScraperScheduler = onSchedule(
  {
    schedule: "every 1 minutes",
    maxInstances,
  },
  async () => {
    logger.info("🕵️ Watchlist Scraper Scheduler waking up...");
    const now = admin.firestore.Timestamp.now();
    const currentTime = now.toMillis();
    try {
      // Query: auto-refresh mode and lastRun older than now - 1 minute
      const scraperUsersSnapshot = await db
        .collectionGroup("paperTradingContext")
        .where("automationConfig.updateMode", "==", "auto-refresh")
        .where("automationConfig.lastRun", "<=", currentTime - 60_000)
        .get();

      if (scraperUsersSnapshot.empty) {
        logger.info("🟢 No due watchlist scraper tasks found.");
        return;
      }

      logger.info(`🔎 Found ${scraperUsersSnapshot.docs.length} users with due auto-refreshing watchlists.`);
      for (const doc of scraperUsersSnapshot.docs) {
        const config = doc.data().automationConfig;
        if (!config) {
          logger.warn("⚠️ Missing automationConfig; skipping:", doc.ref.path);
          continue;
        }
        // Extra guard: if refreshInterval or lastRun missing then skip
        const lastRun = Number(config.lastRun || 0);
        const refreshInterval = Number(config.refreshInterval || 0);
        if (!lastRun || !refreshInterval) {
          logger.warn("⚠️ Missing lastRun/refreshInterval; skipping:", doc.ref.path);
          continue;
        }
        if (lastRun + refreshInterval > currentTime) {
          // Not due yet
          continue;
        }

        const userId = doc.ref.parent.parent?.id;
        if (!userId) continue;

        logger.info(`🧩 Processing watchlist scraper task for user: ${userId}`);
        // TODO: put scraper logic here.

        try {
          await doc.ref.update({ "automationConfig.lastRun": currentTime });
          logger.info(`✅ Watchlist scraper task for user ${userId} completed.`);
        } catch (err) {
          logger.error(`❌ Failed to update lastRun for user ${userId}:`, err);
        }
      }
    } catch (error) {
      logger.error("--- ERROR IN WATCHLIST SCRAPER SCHEDULER ---", error);
      logger.error(
        "This likely means you are missing a Firestore composite index. Required index: collectionGroup='paperTradingContext', fields=[(automationConfig.updateMode, ASCENDING), (automationConfig.lastRun, ASCENDING)]"
      );
    }
  }
);

/**
 * Firestore trigger to handle the closing of a paper trading position.
 * This function calculates P&L, updates the user's balance, and cleans up records.
 *
 * Trigger path: /users/{userId}/paperTradingContext/main/openPositions/{positionId}
 */
export const closePositionHandler = onDocumentWritten(
  "/users/{userId}/paperTradingContext/main/openPositions/{positionId}",
  async (event) => {
    const change = event.data;
    if (!change) return;
    const before = change.before?.data ? change.before.data() : undefined;
    const after = change.after?.data ? change.after.data() : undefined;

    // Only act when the position transitions into 'closing' and previously was not 'closing'
    if (!after || after?.details?.status !== "closing" || before?.details?.status === "closing") {
      return;
    }

    const { userId, positionId } = event.params;
    logger.info(`🔔 Detected position closing event for user ${userId}, position ${positionId}`);

    const position = after as OpenPosition;
    const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);

    try {
      await db.runTransaction(async (transaction) => {
        // Read user context
        const userContextDoc = await transaction.get(userContextRef);
        if (!userContextDoc.exists) {
          throw new Error("User context document does not exist!");
        }

        // Find matching open trade in tradeHistory (if any)
        const openTradeQuery = db
          .collection(`users/${userId}/paperTradingContext/main/tradeHistory`)
          .where("positionId", "==", positionId)
          .where("status", "==", "open")
          .orderBy("openTimestamp", "asc")
          .limit(1);

        const openTradeSnapshot = await transaction.get(openTradeQuery);

        // Calculations
        const currentBalance = Number(userContextDoc.data()?.balance ?? 0);
        let pnl = 0;
        let collateralToReturn = 0;
        const closePrice = Number(position.details?.closePrice ?? position.currentPrice);

        if (position.positionType === "spot") {
          pnl = (closePrice - Number(position.averageEntryPrice)) * Number(position.size);
          collateralToReturn = Number(position.size) * Number(position.averageEntryPrice);
        } else {
          // futures
          const contractValue = Number(position.size) * Number(position.averageEntryPrice);
          collateralToReturn = contractValue / Number(position.leverage || 1);
          if (position.side === "long") {
            pnl = (closePrice - Number(position.averageEntryPrice)) * Number(position.size);
          } else {
            pnl = (Number(position.averageEntryPrice) - closePrice) * Number(position.size);
          }
        }

        const newBalance = currentBalance + collateralToReturn + pnl;

        // Writes (in transaction)
        transaction.update(userContextRef, { balance: newBalance });

        const tradeHistoryRef = userContextRef.collection("tradeHistory").doc();
        const openTimestamp = openTradeSnapshot.docs[0]?.data()?.openTimestamp ?? null;

        const historyRecord: Omit<PaperTrade, 'id'> = {
          positionId,
          positionType: position.positionType,
          symbol: position.symbol,
          symbolName: position.symbolName,
          size: position.size,
          entryPrice: position.averageEntryPrice,
          closePrice,
          side: position.side === "buy" || position.side === "long" ? "sell" : "buy",
          leverage: position.leverage || null,
          openTimestamp,
          closeTimestamp: admin.firestore.FieldValue.serverTimestamp(),
          status: "closed",
          pnl,
        };

        transaction.set(tradeHistoryRef, historyRecord);
        transaction.delete(change.after.ref);

        logger.info(
          `✅ Transaction successful for position ${positionId}. New balance: ${newBalance}, P&L: ${pnl}`
        );
      });
    } catch (error) {
      logger.error(`❌ Transaction failed for closing position ${positionId}:`, error);
      // Try to revert status to 'open' to allow retry (defensive)
      try {
        if (change.after?.ref) {
          await change.after.ref.update({ "details.status": "open" });
        }
      } catch (e) {
        logger.error(`⚠️ Failed to revert position ${positionId} status to 'open':`, e);
      }
    }
  }
);

/**
 * Firestore trigger to handle the opening of a new position from an executed trigger.
 * Trigger path: /users/{userId}/paperTradingContext/main/executedTriggers/{triggerId}
 */
export const openPositionHandler = onDocumentCreated(
  "/users/{userId}/paperTradingContext/main/executedTriggers/{triggerId}",
  async (event) => {
    const { userId, triggerId } = event.params;
    const ds = event.data;
    const executedTrigger = ds?.data() as (TradeTrigger & { currentPrice?: number });

    if (!executedTrigger) {
      logger.error(`❌ No data for executed trigger ${triggerId} for user ${userId}.`);
      return;
    }

    logger.info(`🔔 Detected executed trigger ${triggerId} for user ${userId}. Opening position...`);

    const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);
    try {
      await db.runTransaction(async (transaction) => {
        const userContextDoc = await transaction.get(userContextRef);
        if (!userContextDoc.exists) {
          throw new Error(`User context not found for user ${userId}.`);
        }
        const currentBalance = Number(userContextDoc.data()?.balance ?? 0);

        const {
          type,
          action,
          amount,
          leverage,
          symbol,
          symbolName,
          id,
          stopLoss,
          takeProfit,
        } = executedTrigger;

        const currentPrice = Number(executedTrigger.currentPrice || 0);
        if (!type || !symbol || !symbolName || !amount || !currentPrice) {
          throw new Error("Executed trigger missing required fields (type, symbol, symbolName, amount, currentPrice).");
        }

        if (type === "spot") {
          if (currentBalance < amount) {
            throw new Error("Insufficient balance for spot buy.");
          }
          const size = Number(amount) / currentPrice;
          const newBalance = currentBalance - Number(amount);

          const openPositionsRef = userContextRef.collection("openPositions");
          const existingPositionQuery = openPositionsRef
            .where("symbol", "==", symbol)
            .where("positionType", "==", "spot")
            .limit(1);

          const existingPositionSnapshot = await transaction.get(existingPositionQuery);
          let positionId: string;

          if (!existingPositionSnapshot.empty) {
            const posDoc = existingPositionSnapshot.docs[0];
            const posData = posDoc.data() as OpenPosition;
            positionId = posDoc.id;
            const totalSize = Number(posData.size || 0) + size;
            const totalValue = (Number(posData.size || 0) * Number(posData.averageEntryPrice || 0)) + (size * currentPrice);
            transaction.update(posDoc.ref, { size: totalSize, averageEntryPrice: totalValue / totalSize });
          } else {
            const newPositionRef = openPositionsRef.doc();
            positionId = newPositionRef.id;
            const newPosition: OpenPosition = {
              id: positionId,
              positionType: "spot",
              symbol,
              symbolName,
              size,
              averageEntryPrice: currentPrice,
              currentPrice,
              side: "buy",
              details: {
                triggeredBy: `trigger:${String(id || "").slice(0, 8)}`,
                stopLoss,
                takeProfit,
                status: "open",
              },
            };
            transaction.set(newPositionRef, newPosition);
          }

          const newTrade: Omit<PaperTrade, 'id' | 'closePrice'> = {
            positionId,
            positionType: "spot",
            symbol,
            symbolName,
            size,
            entryPrice: currentPrice,
            side: "buy",
            leverage: null,
            openTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: "open",
          };
          transaction.set(userContextRef.collection("tradeHistory").doc(), newTrade);
          transaction.update(userContextRef, { balance: newBalance });
        } else {
          // Futures
          if (currentBalance < amount) {
            throw new Error("Insufficient balance for futures collateral.");
          }
          const usedLeverage = Number(leverage || 1);
          const positionValue = Number(amount) * usedLeverage;
          const size = positionValue / currentPrice;
          const newBalance = currentBalance - Number(amount);
          const side = (action as "long" | "short") || "long";
          const liquidationPrice =
            side === "long"
              ? currentPrice * (1 - 1 / (usedLeverage || 1))
              : currentPrice * (1 + 1 / (usedLeverage || 1));

          const newPositionRef = userContextRef.collection("openPositions").doc();
          const positionId = newPositionRef.id;
          const newPosition: OpenPosition = {
            id: positionId,
            positionType: "futures",
            symbol,
            symbolName,
            size,
            averageEntryPrice: currentPrice,
            currentPrice,
            side,
            leverage: usedLeverage,
            liquidationPrice,
            details: {
              triggeredBy: `trigger:${String(id || "").slice(0, 8)}`,
              stopLoss,
              takeProfit,
              status: "open",
            },
          };
          transaction.set(newPositionRef, newPosition);
          const newTrade: Omit<PaperTrade, 'id' | 'closePrice'> = {
            positionId,
            positionType: "futures",
            symbol,
            symbolName,
            size,
            entryPrice: currentPrice,
            side,
            leverage: usedLeverage,
            openTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: "open",
          };
          transaction.set(userContextRef.collection("tradeHistory").doc(), newTrade);
          transaction.update(userContextRef, { balance: newBalance });
        }

        // Delete executed trigger doc (single source of truth)
        if (ds?.ref) {
          transaction.delete(ds.ref);
        }
      });

      logger.info(`✅ Successfully opened position for trigger ${triggerId}.`);
    } catch (error) {
      logger.error(`❌ Transaction failed for opening position from trigger ${triggerId}:`, error);
      // Delete the failed trigger to prevent retries
      try {
        if (ds?.ref) await ds.ref.delete();
      } catch (e) {
        logger.error(`⚠️ Failed to delete trigger ${triggerId} after failed transaction:`, e);
      }
    }
  }
);

/**
 * Recalculates and updates aggregate account metrics.
 * Triggered by writes to openPositions or tradeHistory subcollections.
 */
export const updateAccountMetrics = onDocumentWritten(
  "/users/{userId}/paperTradingContext/main/{subCollection}/{subDocId}",
  async (event) => {
    const { userId, subCollection } = event.params;

    // Only trigger for relevant subcollections
    if (subCollection !== "openPositions" && subCollection !== "tradeHistory") {
      return;
    }

    const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);
    logger.info(`📈 Metrics calculation triggered for user: ${userId} by change in ${subCollection}`);

    try {
      const openPositionsSnapshot = await userContextRef.collection("openPositions").get();
      const tradeHistorySnapshot = await userContextRef.collection("tradeHistory").get();
      const userContextSnap = await userContextRef.get();
      if (!userContextSnap.exists) {
        logger.warn(`⚠️ User context for ${userId} not found. Skipping metrics calculation.`);
        return;
      }

      const balance = Number(userContextSnap.data()?.balance ?? 0);

      // Calculate Unrealized P&L
      let unrealizedPnl = 0;
      openPositionsSnapshot.forEach((doc) => {
        const pos = doc.data() as OpenPosition;
        unrealizedPnl += Number(pos.unrealizedPnl || 0);
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
          const pnlVal = Number(trade.pnl || 0);
          realizedPnl += pnlVal;
          if (pnlVal > 0) {
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
      logger.info(`✅ Successfully updated account metrics for user ${userId}.`, metrics);
    } catch (error) {
      logger.error(`❌ Error calculating metrics for user ${userId}:`, error);
    }
  }
);
