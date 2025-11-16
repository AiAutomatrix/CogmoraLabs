import * as admin from 'firebase-admin';
import 'server-only';

/**
 * A robust singleton pattern to initialize Firebase Admin SDK in a serverless environment.
 * It checks if an app is already initialized to prevent re-initialization errors,
 * which is a common cause of crashes in Next.js API routes during development.
 */
function getAdminApp() {
  // If an app is already initialized, return it.
  if (admin.apps.length > 0) {
    return admin.apps[0] as admin.app.App;
  }

  // If no app is initialized, create one.
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccount) {
    // If the service account key is available as an environment variable, use it.
    // This is common for local development and some deployment environments.
    try {
      console.log("Initializing Firebase Admin with service account key...");
      return admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccount)),
      });
    } catch (e: any) {
      console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", e.message);
      throw new Error("Failed to initialize Firebase Admin: Service account key may be malformed.");
    }
  } else {
    // If no service account key is found, try to initialize with default credentials.
    // This is the standard for Google Cloud environments like Cloud Run and Cloud Functions.
    console.log("Initializing Firebase Admin with default application credentials...");
    return admin.initializeApp();
  }
}

const adminApp = getAdminApp();

// Export the initialized services for use in other server-side files.
export const adminAuth = adminApp.auth();
export const adminDb = adminApp.firestore();
