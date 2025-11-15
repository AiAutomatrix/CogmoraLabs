
import * as admin from 'firebase-admin';
import 'server-only';

// This file is for server-side Firebase Admin SDK initialization.

// Check if the service account key is available in environment variables
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccount) {
    // In a Google Cloud environment (like Cloud Run), default credentials are often used.
    // We will attempt to initialize without a key first.
    console.log("FIREBASE_SERVICE_ACCOUNT_KEY not found. Attempting to initialize with default application credentials.");
}

/**
 * A robust singleton pattern to initialize Firebase Admin SDK in a serverless environment.
 * It checks if an app is already initialized to prevent re-initialization errors.
 */
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      // If serviceAccount is defined, parse it and use it.
      // Otherwise, allow initializeApp to use default credentials (for Cloud Run/Functions).
      credential: serviceAccount 
        ? admin.credential.cert(JSON.parse(serviceAccount)) 
        : admin.credential.applicationDefault(),
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (e: any) {
    console.error("Firebase Admin SDK initialization failed:", e.message);
    // This will prevent the app from starting if admin SDK fails, which is intended
    // as admin features are critical for this part of the app.
  }
}

// Export the initialized services for use in other server-side files.
export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
