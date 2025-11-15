import * as admin from 'firebase-admin';

// This file is for server-side Firebase Admin SDK initialization.

// Check if there are any initialized apps, and if not, initialize one.
// This is a more robust pattern for serverless environments like Next.js API routes.
if (!admin.apps.length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountKey)),
    });
  } else {
    // This will use the default credentials in a Google Cloud environment
    // or look for GOOGLE_APPLICATION_CREDENTIALS env var locally.
    console.warn("FIREBASE_SERVICE_ACCOUNT_KEY not found. Using default application credentials.");
    admin.initializeApp();
  }
}

// Export the initialized admin instance for use in other server-side files.
// We no longer need an adminApp() function. We can just import this instance.
export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
