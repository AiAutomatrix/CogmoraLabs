
import * as admin from 'firebase-admin';

// This file is for server-side Firebase Admin SDK initialization.

const getApp = () => {
  if (admin.apps.length > 0) {
    return admin.apps[0] as admin.app.App;
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    // In a Google Cloud environment, default credentials are used.
    // For local dev, you'd set GOOGLE_APPLICATION_CREDENTIALS.
    console.log("Initializing Firebase Admin with default credentials.");
    return admin.initializeApp();
  }

  try {
    console.log("Initializing Firebase Admin with service account key.");
    return admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountKey)),
    });
  } catch (error: any) {
    console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", error.message);
    throw new Error("Failed to initialize Firebase Admin SDK. Service account key may be malformed.");
  }
};

const app = getApp();
export const adminAuth = app.auth();
export const adminDb = app.firestore();
