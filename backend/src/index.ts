
      
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
 * Handles all trade events and metric calculations.
 * Triggered when a document in 'openPositions' or 'tradeHistory' is written.
 */
export const calculateAccountMetrics = onDocumentWritten(
    "/users/{userId}/paperTradingContext/main/{collectionId}/{docId}",
    async (event) => {
        const {userId, collectionId} = event.params;

        if (collectionId !== "openPositions" && collectionId !== "tradeHistory") {
            return;
        }

        const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);

        // --- Handle Position Closing Logic ---
        if (collectionId === "openPositions" && event.data) {
            const dataBefore = event.data.before.data();
            const dataAfter = event.data.after.data();

            if (dataAfter?.details?.status === "closing" && dataBefore?.details?.status !== "closing") {
                const positionId = event.params.docId;
                const position = dataAfter;
                const positionRef = event.data.after.ref;

                logger.info(`Detected position closing event for user ${userId}, position ${positionId}.`);

                try {
                    await db.runTransaction(async (transaction) => {
                        const userContextDoc = await transaction.get(userContextRef);
                        if (!userContextDoc.exists) {
                            throw new Error(`User context document does not exist for user ${userId}!`);
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

                        const historyQuery = db.collection(`users/${userId}/paperTradingContext/main/tradeHistory`)
                            .where("positionId", "==", positionId)
                            .where("status", "==", "open")
                            .orderBy("timestamp", "desc")
                            .limit(1);

                        const historySnapshot = await transaction.get(historyQuery);

                        transaction.update(userContextRef, {balance: newBalance});
                        transaction.delete(positionRef);

                        if (!historySnapshot.empty) {
                            const historyDocRef = historySnapshot.docs[0].ref;
                            transaction.update(historyDocRef, {status: "closed", pnl: pnl});
                        }
                    });
                    logger.info(`Transaction successful for closing position ${positionId}.`);
                    return; // Exit early, metrics will recalc on next trigger
                } catch (error) {
                    logger.error(`Transaction failed for closing position ${positionId}:`, error);
                    await positionRef.update({"details.status": "open"});
                    return; // Exit on failure
                }
            }
        }

        // --- Recalculate Aggregate Metrics ---
        logger.info(`Metrics calculation triggered for user: ${userId} by change in ${collectionId}`);
        try {
            const [openPositionsSnapshot, tradeHistorySnapshot, userContextSnap] = await Promise.all([
                userContextRef.collection("openPositions").get(),
                userContextRef.collection("tradeHistory").get(),
                userContextRef.get(),
            ]);

            let balance = 0;
            if (!userContextSnap.exists) {
                logger.warn(`User context for ${userId} not found during metrics calculation. Creating it.`);
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
            const metrics = {equity, unrealizedPnl, realizedPnl, winRate, wonTrades, lostTrades};

            await userContextRef.update(metrics);
            logger.info(`Successfully updated account metrics for user ${userId}.`, metrics);
        } catch (error) {
            logger.error(`Error calculating metrics for user ${userId}:`, error);
        }
    }
);

    