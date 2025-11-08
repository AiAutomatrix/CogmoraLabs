
import * as admin from 'firebase-admin';

// This file is for server-side Firebase Admin SDK initialization.

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : null;

let app: admin.app.App;

export function adminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }
  
  if (!serviceAccount) {
    console.warn("FIREBASE_SERVICE_ACCOUNT_KEY is not set. Using default credentials.");
    app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } else {
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  return app;
}
