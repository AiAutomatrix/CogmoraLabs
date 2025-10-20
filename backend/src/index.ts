
"use server";

import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Handles the logic for closing a position when its status is updated to 'closing'.
 * This function calculates P&L, updates the user's balance, and updates the trade history.
 */
export const closePositionHandler = onDocumentWritten("/users/{userId}/paperTradingContext/main/openPositions/{positionId}", async (event) => {
  // Exit if there's no data change (e.g., on document creation with no status)
  if (!event.data) {
    return;
  }

  const {before, after} = event.data;
  const dataBefore = before.data();
  const dataAfter = after.data();

  // Ensure this runs only when a position is UPDATED to 'closing' status
  if (dataAfter?.details?.status !== "closing" || dataBefore?.details?.status === "closing") {
    return;
  }

  const {userId, positionId} = event.params;
  logger.info(`Handling closing for position ${positionId} for user ${userId}.`);

  const position = dataAfter;
  const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);
  const positionRef = after.ref;

  try {
    await db.runTransaction(async (transaction) => {
      const userContextDoc = await transaction.get(userContextRef);
      if (!userContextDoc.exists) {
        throw new Error(`User context not found for user ${userId}`);
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
        pnl = position.side === "long" ?
            (position.currentPrice - position.averageEntryPrice) * position.size :
            (position.averageEntryPrice - position.currentPrice) * position.size;
      }

      const newBalance = currentBalance + collateralToReturn + pnl;

      // Create a new closed trade record in the history collection
      const historyRef = userContextRef.collection("tradeHistory").doc();
      const closedTrade = {
        positionId: position.id,
        positionType: position.positionType,
        symbol: position.symbol,
        symbolName: position.symbolName,
        size: position.size,
        price: position.currentPrice, // Close price
        side: "sell", // Simplified for history
        leverage: position.leverage || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: "closed",
        pnl: pnl,
      };

      // Perform all writes atomically.
      transaction.update(userContextRef, {balance: newBalance});
      transaction.set(historyRef, closedTrade);
      transaction.delete(positionRef);
    });
    logger.info(`Successfully closed position ${positionId}.`);
  } catch (error) {
    logger.error(`Transaction failed for closing position ${positionId}:`, error);
    // Revert status to 'open' on failure to allow for retry.
    await positionRef.update({"details.status": "open"});
  }
});


/**
 * Recalculates and updates aggregate account metrics whenever positions or history change.
 */
export const calculateAccountMetrics = onDocumentWritten("/users/{userId}/paperTradingContext/main/{collectionId}/{docId}", async (event) => {
  const {userId, collectionId} = event.params;

  // Only trigger for relevant subcollections
  if (collectionId !== "openPositions" && collectionId !== "tradeHistory") {
    return;
  }

  const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);

  logger.info(`Metrics calculation triggered for user: ${userId} by change in ${collectionId}`);

  try {
    const [openPositionsSnapshot, tradeHistorySnapshot, userContextSnap] = await Promise.all([
      userContextRef.collection("openPositions").get(),
      userContextRef.collection("tradeHistory").get(),
      userContextRef.get(),
    ]);

    let balance = 0;
    if (userContextSnap.exists) {
      balance = userContextSnap.data()?.balance ?? 0;
    } else {
      logger.warn(`User context for ${userId} not found during metrics calculation.`);
      // Don't create here, let the app create it. Just exit.
      return;
    }

    // 1. Calculate Unrealized P&L from all open positions.
    let unrealizedPnl = 0;
    openPositionsSnapshot.forEach((doc) => {
      unrealizedPnl += doc.data().unrealizedPnl || 0;
    });

    // 2. Calculate Equity.
    const equity = balance + unrealizedPnl;

    // 3. Calculate Realized P&L and Win Rate from all closed trades in history.
    let realizedPnl = 0;
    let wonTrades = 0;
    let lostTrades = 0;
    tradeHistorySnapshot.forEach((doc) => {
      const trade = doc.data();
      if (trade.status === "closed" && typeof trade.pnl === "number") {
        realizedPnl += trade.pnl;
        if (trade.pnl > 0) wonTrades++;
        else lostTrades++;
      }
    });

    const totalClosedTrades = wonTrades + lostTrades;
    const winRate = totalClosedTrades > 0 ? (wonTrades / totalClosedTrades) * 100 : 0;

    // 4. Atomically update the main user document with all calculated metrics.
    const metrics = {
      equity,
      unrealizedPnl,
      realizedPnl,
      winRate,
      wonTrades,
      lostTrades,
    };

    // Use set with merge to create if not exists, or update if it does.
    await userContextRef.set(metrics, {merge: true});
    logger.info(`Successfully updated account metrics for user ${userId}.`);
  } catch (error) {
    logger.error(`Error calculating aggregate metrics for user ${userId}:`, error);
  }
});
