
"use server";

import {onDocumentWritten, DocumentSnapshot, Change} from "firebase-functions/v2/firestore";
import type {FirestoreEvent} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();


/**
 * A single, unified function that handles all paper trading events.
 * It is triggered by any write (create, update, delete) to an open position.
 * It handles the logic for closing a position and then recalculates all
 * aggregate account metrics.
 */
export const calculateAccountMetrics = onDocumentWritten("/users/{userId}/paperTradingContext/main/openPositions/{positionId}", async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, {userId: string; positionId: string;}>) => {
  const {userId, positionId} = event.params;
  const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);
  const change = event.data; // Store the change data safely.

  // --- Step 1: Handle Position Closing Logic ---
  // This block only runs if a document was UPDATED (not created or deleted).
  if (change && change.before.exists && change.after.exists) {
    const dataBefore = change.before.data();
    const dataAfter = change.after.data();

    // Condition: A position was just updated to have the 'closing' status.
    if (dataAfter?.details?.status === "closing" && dataBefore?.details?.status !== "closing") {
      logger.info(`Handling closing for position ${positionId} for user ${userId}.`);
      const position = dataAfter;

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
          transaction.delete(change.after.ref); // This is now safe.
        });
        logger.info(`Successfully closed position ${positionId}.`);
        // The transaction triggers this function again (due to delete), which will then run the metric calculation below.
        return;
      } catch (error) {
        logger.error(`Transaction failed for closing position ${positionId}:`, error);
        // Revert status to 'open' on failure to allow for retry.
        await change.after.ref.update({"details.status": "open"}); // This is also safe now.
        return;
      }
    }
  }

  // --- Step 2: Recalculate Aggregate Account Metrics ---
  // This part runs after any create, update, or delete on openPositions,
  // or if a tradeHistory document is written.
  logger.info(`Recalculating aggregate metrics for user: ${userId}`);
  try {
    // Fetch all necessary data concurrently.
    const [openPositionsSnapshot, tradeHistorySnapshot, userContextSnap] = await Promise.all([
      userContextRef.collection("openPositions").get(),
      userContextRef.collection("tradeHistory").get(),
      userContextRef.get(),
    ]);

    let balance = 0;
    if (!userContextSnap.exists) {
      logger.warn(`User context for ${userId} not found. Creating with default balance.`);
      balance = 100000;
    } else {
      balance = userContextSnap.data()?.balance ?? 0;
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
