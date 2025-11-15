
import * as admin from 'firebase-admin';

// This file is for server-side Firebase Admin SDK initialization.

// This is the correct pattern for initializing the Admin SDK in a serverless environment.
// It ensures that we don't try to re-initialize the app on every API call.
if (!admin.apps.length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccountKey)),
      });
      console.log("Firebase Admin SDK initialized with service account key.");
    } catch (e: any) {
        console.error("Firebase Admin SDK initialization failed:", e);
    }
  } else {
    // This will use the default credentials in a Google Cloud environment
    // (like Cloud Run or Cloud Functions)
    console.warn("FIREBASE_SERVICE_ACCOUNT_KEY not found. Using default application credentials. This is expected in a deployed Google Cloud environment.");
    admin.initializeApp();
  }
}

// Export the initialized admin instance for use in other server-side files.
export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
