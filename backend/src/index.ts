
"use server";

import * as logger from "firebase-functions/logger";
import {onCall} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * A basic "Hello World" callable function to verify deployment.
 */
export const helloWorld = onCall((request) => {
  logger.info("Hello logs!", {structuredData: true});
  return {
    message: `Hello from Firebase! You sent: ${request.data.text}`,
  };
});
