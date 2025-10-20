
"use server";

import {onDocumentWritten} from "firebase-functions/v2/firestore";
import type {FirestoreEvent, Change, DocumentSnapshot} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();


/**
 * Recalculates and updates aggregate account metrics whenever openPositions or tradeHistory change.
 * This function acts as the single source of truth for all summary-level account data.
 */
export const calculateAccountMetrics = onDocumentWritten("/users/{userId}/paperTradingContext/main/{collectionId}/{docId}", async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, {userId: string, collectionId: string, docId: string}>) => {
  const {userId, collectionId} = event.params;

  // We only care about changes to these two collections for metrics calculation.
  if (collectionId !== "openPositions" && collectionId !== "tradeHistory") {
    return;
  }

  // --- POSITION CLOSING LOGIC ---
  // This function now ALSO handles the transactional logic of closing a position.
  // This is critical to ensure balance is updated correctly BEFORE metrics are recalculated.
  if (collectionId === "openPositions" && event.data?.after.exists) {
    const dataBefore = event.data.before.data();
    const dataAfter = event.data.after.data();

    // Condition to run: a position was just updated to have the 'closing' status.
    if (dataAfter?.details?.status === "closing" && dataBefore?.details?.status !== "closing") {
      const positionId = event.params.docId;
      const positionRef = event.data.after.ref;
      const position = dataAfter;

      logger.info(`Handling closing for position ${positionId} for user ${userId}.`);

      try {
        await db.runTransaction(async (transaction) => {
          const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);
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

          // Find the related 'open' trade history record to update it.
          const historyQuery = userContextRef.collection("tradeHistory")
            .where("positionId", "==", positionId)
            .where("status", "==", "open")
            .orderBy("timestamp", "desc")
            .limit(1);

          const historySnapshot = await transaction.get(historyQuery);

          // Perform all writes atomically.
          transaction.update(userContextRef, {balance: newBalance});
          transaction.delete(positionRef);
          if (!historySnapshot.empty) {
            const historyDocRef = historySnapshot.docs[0].ref;
            transaction.update(historyDocRef, {status: "closed", pnl});
          }
        });
        logger.info(`Successfully closed position ${positionId}.`);
        // The transaction triggers this function again, which will then run the metric calculation below.
        // We can safely return here.
        return;
      } catch (error) {
        logger.error(`Transaction failed for closing position ${positionId}:`, error);
        // Revert status to 'open' on failure to allow for retry.
        await positionRef.update({"details.status": "open"});
        return; // Stop execution to prevent incorrect metric calculation.
      }
    }
  }

  // --- AGGREGATE METRICS CALCULATION ---
  // This part runs after a position is closed or any other relevant change.
  logger.info(`Recalculating aggregate metrics for user: ${userId}`);
  try {
    const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);

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

    // 3. Calculate Realized P&L and Win Rate from all closed trades.
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
    await userContextRef.set(metrics, {merge: true}); // Use set with merge to create if not exists.
    logger.info(`Successfully updated account metrics for user ${userId}.`);
  } catch (error) {
    logger.error(`Error calculating aggregate metrics for user ${userId}:`, error);
  }
});
