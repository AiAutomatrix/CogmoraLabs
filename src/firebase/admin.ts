
import * as admin from 'firebase-admin';
import 'server-only';

// This file is for server-side Firebase Admin SDK initialization.

/**
 * A robust singleton pattern to initialize Firebase Admin SDK in a serverless environment.
 * It checks if an app is already initialized to prevent re-initialization errors.
 */
function getAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0] as admin.app.App;
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    try {
      console.log("Initializing Firebase Admin with service account key.");
      return admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccountKey)),
      });
    } catch (e: any) {
      console.error("Firebase Admin SDK initialization failed with service account key:", e.message);
      // Fallback for environments where service account might be malformed but default creds exist
    }
  }

  // Fallback to default credentials in a Google Cloud environment (Cloud Run, Functions)
  // or when GOOGLE_APPLICATION_CREDENTIALS is set locally.
  console.log("Initializing Firebase Admin with default application credentials.");
  return admin.initializeApp();
}

const adminApp = getAdminApp();

// Export the initialized services for use in other server-side files.
export const adminAuth = adminApp.auth();
export const adminDb = adminApp.firestore();
