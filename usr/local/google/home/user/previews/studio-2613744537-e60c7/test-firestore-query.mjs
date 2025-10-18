
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
};

// --- 2. Initialize Firebase ---
if (!getApps().length) {
  initializeApp(firebaseConfig);
}

const db = getFirestore();

// --- 3. Function to test writing to the watchlist ---
async function runWriteTest() {
  try {
    // IMPORTANT: Replace this with a REAL User ID from your Firebase Authentication
    const testUserId = 'REPLACE_WITH_A_REAL_USER_ID';
    if (testUserId === 'REPLACE_WITH_A_REAL_USER_ID') {
        console.error("❌ ERROR: Please replace 'REPLACE_WITH_A_REAL_USER_ID' in the script with a real User ID from your Firebase project.");
        return;
    }

    // This simulates the worker updating a price on a watchlist item.
    const symbolToTest = 'BTC-USDT';
    const docRef = doc(db, 'users', testUserId, 'paperTradingContext', 'main', 'watchlist', symbolToTest);

    const dataToWrite = {
      currentPrice: 65000.12,
      priceChgPct: 0.01,
      symbol: "BTC-USDT",
      symbolName: "Bitcoin",
      type: "spot",
      updatedAt: Date.now()
    };
    
    console.log(`\nAttempting to write to path: ${docRef.path}`);
    console.log('With data:', dataToWrite);

    await setDoc(docRef, dataToWrite, { merge: true });

    console.log(`\n✅ SUCCESS: Successfully wrote/updated document for '${symbolToTest}' in the watchlist.`);
    console.log("This confirms that the worker has the correct permissions and the database is ready.");

  } catch (err) {
    console.error("\n❌ WRITE FAILED:", err.message);
    if (err.message && err.message.includes("permission-denied")) {
      console.error("Reason: This is a Firestore Security Rules issue. The rules are blocking this write operation.");
    } else if (err.message && err.message.includes("create index")) {
      console.log("⚠️ Firestore will print a URL below — click it to create the missing index.");
    } else {
      console.error("An unexpected error occurred. Check your Firebase config and network connection.", err);
    }
  }
}

// --- 4. Run the test ---
runWriteTest();
