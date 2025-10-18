
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closePositionHandler = exports.watchlistScraperScheduler = exports.aiAgentScheduler = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const params_1 = require("firebase-functions/params");
// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// Define a runtime option for the scheduler functions
const maxInstances = (0, params_1.defineInt)("SCHEDULE_MAX_INSTANCES", { default: 10 });
/**
 * Scheduled function that runs every minute to execute due AI agent tasks.
 */
exports.aiAgentScheduler = (0, scheduler_1.onSchedule)({
    schedule: "every 1 minutes",
    maxInstances,
}, async () => {
    var _a;
    logger.info("AI Agent Scheduler waking up...");
    const now = admin.firestore.Timestamp.now();
    const currentTime = now.toMillis();
    try {
        const aiUsersSnapshot = await db.collectionGroup("paperTradingContext")
            .where("aiSettings.nextRun", "<=", currentTime)
            .get();
        if (aiUsersSnapshot.empty) {
            logger.info("No due AI agent tasks found.");
            return;
        }
        logger.info(`Found ${aiUsersSnapshot.docs.length} potential users with due AI tasks.`);
        for (const doc of aiUsersSnapshot.docs) {
            const userId = (_a = doc.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id;
            const aiSettings = doc.data().aiSettings;
            if (!userId || !aiSettings || !aiSettings.scheduleInterval) {
                continue;
            }
            logger.info(`Processing AI task for user: ${userId}`);
            // In a real implementation, you would invoke the Genkit flow here.
            // ...
            const nextRun = currentTime + aiSettings.scheduleInterval;
            await doc.ref.update({ "aiSettings.nextRun": nextRun });
            logger.info(`AI task for user ${userId} completed. Next run scheduled for ${new Date(nextRun).toISOString()}`);
        }
    }
    catch (error) {
        logger.error("--- ERROR IN AI AGENT SCHEDULER ---", error);
    }
});
/**
 * Scheduled function that runs every minute to execute due watchlist scraper tasks.
 */
exports.watchlistScraperScheduler = (0, scheduler_1.onSchedule)({
    schedule: "every 1 minutes",
    maxInstances,
}, async () => {
    var _a;
    logger.info("Watchlist Scraper Scheduler waking up...");
    const now = admin.firestore.Timestamp.now();
    const currentTime = now.toMillis();
    try {
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
            const userId = (_a = doc.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId)
                continue;
            logger.info(`Processing watchlist scraper task for user: ${userId}`);
            // In a real implementation, you would invoke scraping logic here.
            // ...
            await doc.ref.update({ "automationConfig.lastRun": currentTime });
            logger.info(`Watchlist scraper task for user ${userId} completed.`);
        }
    }
    catch (error) {
        logger.error("--- ERROR IN WATCHLIST SCRAPER SCHEDULER ---", error);
    }
});
/**
 * Firestore trigger to handle the closing of a paper trading position.
 * This function calculates P&L, updates the user's balance, and cleans up records.
 */
exports.closePositionHandler = (0, firestore_1.onDocumentWritten)("/users/{userId}/paperTradingContext/main/openPositions/{positionId}", async (event) => {
    var _a, _b;
    const change = event.data;
    if (!change)
        return;
    const dataAfter = change.after.data();
    const dataBefore = change.before.data();
    if (((_a = dataAfter === null || dataAfter === void 0 ? void 0 : dataAfter.details) === null || _a === void 0 ? void 0 : _a.status) !== "closing" || ((_b = dataBefore === null || dataBefore === void 0 ? void 0 : dataBefore.details) === null || _b === void 0 ? void 0 : _b.status) === "closing") {
        return;
    }
    const { userId, positionId } = event.params;
    logger.info(`Detected position closing event for user ${userId}, position ${positionId}`);
    const position = dataAfter;
    const userContextRef = db.doc(`users/${userId}/paperTradingContext/main`);
    try {
        await db.runTransaction(async (transaction) => {
            var _a, _b;
            const userContextDoc = await transaction.get(userContextRef);
            if (!userContextDoc.exists) {
                throw new Error("User context document does not exist!");
            }
            const currentBalance = (_b = (_a = userContextDoc.data()) === null || _a === void 0 ? void 0 : _a.balance) !== null && _b !== void 0 ? _b : 0;
            let pnl = 0;
            let collateralToReturn = 0;
            if (position.positionType === "spot") {
                pnl = (position.currentPrice - position.averageEntryPrice) * position.size;
                collateralToReturn = position.size * position.averageEntryPrice;
            }
            else { // Futures
                const contractValue = position.size * position.averageEntryPrice;
                collateralToReturn = contractValue / position.leverage;
                if (position.side === "long") {
                    pnl = (position.currentPrice - position.averageEntryPrice) * position.size;
                }
                else { // short
                    pnl = (position.averageEntryPrice - position.currentPrice) * position.size;
                }
            }
            const newBalance = currentBalance + collateralToReturn + pnl;
            transaction.update(userContextRef, { balance: newBalance });
            transaction.delete(change.after.ref);
            const historyQuery = db.collection(`users/${userId}/paperTradingContext/main/tradeHistory`)
                .where("positionId", "==", positionId)
                .where("status", "==", "open")
                .orderBy("timestamp", "desc")
                .limit(1);
            const historySnapshot = await transaction.get(historyQuery);
            if (!historySnapshot.empty) {
                const historyDocRef = historySnapshot.docs[0].ref;
                transaction.update(historyDocRef, { status: "closed", pnl });
            }
            logger.info(`Transaction successful for position ${positionId}. New balance: ${newBalance}, P&L: ${pnl}`);
        });
    }
    catch (error) {
        logger.error(`Transaction failed for closing position ${positionId}:`, error);
        await change.after.ref.update({ "details.status": "open" });
    }
});
//# sourceMappingURL=index.js.map
