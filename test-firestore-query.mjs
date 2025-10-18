// test-firestore-query.mjs
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { getApps } from "firebase/app";

// --- 1. Firebase config with your project's actual credentials ---
const firebaseConfig = {
  "projectId": "studio-2613744537-e60c7",
  "appId": "1:1084135620241:web:8d9b766b81cf970c900930",
  "apiKey": "AIzaSyCtkTPALNPLwJxBFuAjJlwWZmG9djJSfGc",
  "authDomain": "studio-2613744537-e60c7.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "1084135620241"
};

// --- 2. Initialize Firebase ---
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

// --- 3. Function to test writing to the watchlist ---
async function runWriteTest() {
  try {
    // IMPORTANT: Replace this with a REAL User ID from your Firebase Authentication
    const testUserId = 'REPLACE_WITH_A_REAL_USER_ID';
    if (testUserId === 'REPLACE_WITH_A_REAL_USER_ID') {
        console.error("❌ ERROR: Please replace 'REPLACE_WITH_A_REAL_USER_ID' in the script with a real User ID from your Firebase project.");
        return;
    }

    // This simulates the worker updating the price of a watchlist item.
    // We are writing to the path: /users/{testUserId}/paperTradingContext/main/watchlist/BTC-USDT
    const watchlistDocRef = doc(db, 'users', testUserId, 'paperTradingContext', 'main', 'watchlist', 'BTC-USDT');
    
    const watchlistItemData = {
        currentPrice: 65000.123,
        symbol: "BTC-USDT",
        symbolName: "BTC-USDT",
        type: "spot",
        // Add other fields to make it a valid WatchlistItem
    };

    console.log(`Attempting to write to: ${watchlistDocRef.path}`);
    await setDoc(watchlistDocRef, watchlistItemData, { merge: true });

    console.log("✅ SUCCESS: Document write operation was successful!");
    console.log("This confirms the realtime-worker has the necessary permissions to update watchlist items.");

  } catch (err) {
    console.error("❌ WRITE FAILED:", err.message);
    if (err.code === 'permission-denied') {
        console.error("This is a Firestore Security Rules issue. The currently 'authenticated' user (or lack thereof) cannot write to this path.");
    } else if (err.message && err.message.includes("create index")) {
      console.log("⚠️ This is an indexing issue. Firestore will print a URL below — click it to create the missing index.");
    }
  }
}

runWriteTest();
