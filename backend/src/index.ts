
"use server";

import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {defineInt} from "firebase-functions/params";

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// Define a runtime option for the scheduler functions
const maxInstances = defineInt("SCHEDULE_MAX_INSTANCES", {default: 10});

/**
 * Scheduled function that runs every minute to execute due AI agent tasks.
 */
export const aiAgentScheduler = onSchedule(
    {
        schedule: "every 1 minutes",
        maxInstances,
    },
    async () => {
        logger.info("AI Agent Scheduler waking up...");
        const now = admin.firestore.Timestamp.now();
        const currentTime = now.toMillis();

        try {
            const aiUsersSnapshot = await db
                .collectionGroup("paperTradingContext")
                .where("aiSettings.scheduleInterval", ">", 0)
                .where("aiSettings.nextRun", "<=", currentTime)
                .get();

            if (aiUsersSnapshot.empty) {
                logger.info("No due AI agent tasks found.");
                return;
            }

            logger.info(
                `Found ${aiUsersSnapshot.docs.length} potential users with due AI tasks.`
            );

            for (const doc of aiUsersSnapshot.docs) {
                const userId = doc.ref.parent.parent?.id;
                const aiSettings = doc.data()?.aiSettings;

                if (!userId || !aiSettings || !aiSettings.scheduleInterval) {
                    continue;
                }

                logger.info(`Processing AI task for user: ${userId}`);

                // In a real implementation, you would invoke the Genkit flow here.
                // ...

                const nextRun = currentTime + aiSettings.scheduleInterval;
                await doc.ref.update({"aiSettings.nextRun": nextRun});

                logger.info(
                    `AI task for user ${userId} completed. Next run scheduled for ${new Date(
                        nextRun
                    ).toISOString()}`
                );
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
        logger.info("Watchlist Scraper Scheduler waking up...");
        const now = admin.firestore.Timestamp.now();
        const currentTime = now.toMillis();

        try {
            const scraperUsersSnapshot = await db
                .collectionGroup("paperTradingContext")
                .where("automationConfig.updateMode", "==", "auto-refresh")
                .where("automationConfig.lastRun", "<=", currentTime - 60000)
                .get();

            if (scraperUsersSnapshot.empty) {
                logger.info("No due watchlist scraper tasks found.");
                return;
            }

            logger.info(
                `Found ${scraperUsersSnapshot.docs.length} users with due auto-refreshing watchlists.`
            );

            for (const doc of scraperUsersSnapshot.docs) {
                const config = doc.data()?.automationConfig;

                if (
                    !config ||
                    typeof config.lastRun !== "number" ||
                    typeof config.refreshInterval !== "number" ||
                    config.lastRun + config.refreshInterval > currentTime
                ) {
                    continue;
                }

                const userId = doc.ref.parent.parent?.id;
                if (!userId) {
                    continue;
                }

                logger.info(`Processing watchlist scraper task for user: ${userId}`);

                // In a real implementation, you would invoke scraping logic here.
                // ...

                await doc.ref.update({"automationConfig.lastRun": currentTime});

                logger.info(`Watchlist scraper task for user ${userId} completed.`);
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
 * This single, unified function handles all trade-related events. It triggers whenever a document
 * in any 'openPositions' subcollection is written (created, updated, or deleted).
 *
 * It has two primary responsibilities:
 * 1. If a position is updated to a 'closing' status, it handles the entire closing transaction.
 * 2. After any event, it recalculates and updates the aggregate account metrics.
 */
export const onTradeEvent = onDocumentWritten("/users/{userId}/paperTradingContext/main/openPositions/{positionId}", async (event) => {
    const {userId, positionId} = event.params;
    const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);

    // --- JOB 1: Handle Position Closing Logic ---
    // Check if the event was an UPDATE where a position was just marked for closing.
    if (event.data && event.data.before.exists && event.data.after.exists) {
        const dataBefore = event.data.before.data();
        const dataAfter = event.data.after.data();

        if (dataAfter?.details?.status === "closing" && dataBefore?.details?.status !== "closing") {
            logger.info(`Detected position closing event for user ${userId}, position ${positionId}.`);
            const positionToClose = dataAfter;
            const positionRef = event.data.after.ref;

            try {
                await db.runTransaction(async (transaction) => {
                    const userContextDoc = await transaction.get(userContextRef);
                    if (!userContextDoc.exists) throw new Error("User context document does not exist!");

                    const currentBalance = userContextDoc.data()?.balance ?? 0;
                    let pnl = 0;
                    let collateralToReturn = 0;

                    if (positionToClose.positionType === "spot") {
                        pnl = (positionToClose.currentPrice - positionToClose.averageEntryPrice) * positionToClose.size;
                        collateralToReturn = positionToClose.size * positionToClose.averageEntryPrice;
                    } else { // Futures
                        const contractValue = positionToClose.size * positionToClose.averageEntryPrice;
                        collateralToReturn = contractValue / positionToClose.leverage;
                        pnl = positionToClose.side === "long"
                            ? (positionToClose.currentPrice - positionToClose.averageEntryPrice) * positionToClose.size
                            : (positionToClose.averageEntryPrice - positionToClose.currentPrice) * positionToClose.size;
                    }
                    const newBalance = currentBalance + collateralToReturn + pnl;

                    const historyQuery = userContextRef.collection("tradeHistory")
                        .where("positionId", "==", positionId)
                        .where("status", "==", "open")
                        .orderBy("timestamp", "desc").limit(1);
                    const historySnapshot = await transaction.get(historyQuery);

                    // ATOMIC WRITES
                    transaction.update(userContextRef, {balance: newBalance});
                    transaction.delete(positionRef);
                    if (!historySnapshot.empty) {
                        transaction.update(historySnapshot.docs[0].ref, {status: "closed", pnl});
                    }
                });

                logger.info(`Transaction successful for closing position ${positionId}.`);
                // By returning here, we allow the deletion to trigger the metric calculation.
                return;
            } catch (error) {
                logger.error(`Transaction failed for closing position ${positionId}:`, error);
                await positionRef.update({"details.status": "open"}); // Revert on failure
                return; // Stop further processing on failure
            }
        }
    }

    // --- JOB 2: Recalculate Aggregate Metrics ---
    // This part runs after ANY write to 'openPositions' (create, update, or the delete from a successful close).
    logger.info(`Metrics calculation triggered for user: ${userId}`);
    try {
        const [openPositionsSnapshot, tradeHistorySnapshot, userContextSnap] = await Promise.all([
            userContextRef.collection("openPositions").get(),
            userContextRef.collection("tradeHistory").get(),
            userContextRef.get(),
        ]);

        let balance = 0;
        if (!userContextSnap.exists) {
            // This case handles the very first position creation for a new user.
            const initialMetrics = {
                balance: 100000, equity: 100000, unrealizedPnl: 0, realizedPnl: 0,
                winRate: 0, wonTrades: 0, lostTrades: 0,
            };
            await userContextRef.set(initialMetrics, {merge: true});
            balance = initialMetrics.balance;
        } else {
            balance = userContextSnap.data()?.balance ?? 0;
        }

        let unrealizedPnl = 0;
        openPositionsSnapshot.forEach((doc) => {
            unrealizedPnl += doc.data().unrealizedPnl || 0;
        });

        const equity = balance + unrealizedPnl;
        let realizedPnl = 0;
        let wonTrades = 0;
        let lostTrades = 0;

        tradeHistorySnapshot.forEach((doc) => {
            const trade = doc.data();
            if (trade.status === "closed" && trade.pnl !== undefined && trade.pnl !== null) {
                realizedPnl += trade.pnl;
                if (trade.pnl > 0) wonTrades++;
                else lostTrades++;
            }
        });

        const totalClosedTrades = wonTrades + lostTrades;
        const winRate = totalClosedTrades > 0 ? (wonTrades / totalClosedTrades) * 100 : 0;
        const metrics = {equity, unrealizedPnl, realizedPnl, winRate, wonTrades, lostTrades};

        await userContextRef.update(metrics);
        logger.info(`Successfully updated account metrics for user ${userId}.`);
    } catch (error) {
        logger.error(`Error calculating metrics for user ${userId}:`, error);
    }
});
