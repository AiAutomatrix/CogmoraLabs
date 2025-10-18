// A manual test script to diagnose Firestore write permissions.
// To run:
// 1. Replace 'REPLACE_WITH_A_REAL_USER_ID' with a valid UID from your Firebase Auth.
// 2. Run `node test-firestore-query.mjs` in your terminal.

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// --- CONFIGURATION ---

// Your actual Firebase project configuration.
const firebaseConfig = {
  projectId: "studio-2613744537-e60c7",
  apiKey: "AIzaSyCtkTPALNPLwJxBFuAjJlwWZmG9djJSfGc",
  authDomain: "studio-2613744537-e60c7.firebaseapp.com",
};

// **IMPORTANT**: Replace this with a real User ID from your Firebase Authentication console.
const TEST_USER_ID = "REPLACE_WITH_A_REAL_USER_ID";

// --- SCRIPT LOGIC ---

async function testFirestoreWrite() {
  if (TEST_USER_ID === "REPLACE_WITH_A_REAL_USER_ID") {
    console.error(
      "\n❌ ERROR: Please replace 'REPLACE_WITH_A_REAL_USER_ID' with a real User ID in the script.\n"
    );
    return;
  }

  console.log(`▶️ Initializing Firebase app for project: ${firebaseConfig.projectId}...`);
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const positionId = `test-pos-${Date.now()}`;
  const docPath = `users/${TEST_USER_ID}/paperTradingContext/main/openPositions/${positionId}`;

  console.log(`\n▶️ Preparing to write to path: ${docPath}`);

  const newPosition = {
    id: positionId,
    averageEntryPrice: 50000,
    currentPrice: 50000,
    positionType: "spot",
    side: "buy",
    size: 0.1,
    symbol: "BTC-USDT",
    symbolName: "BTC-USDT",
    unrealizedPnl: 0,
    details: {
      triggeredBy: "manual-test-script",
      status: "open",
    },
  };

  try {
    const docRef = doc(db, docPath);
    await setDoc(docRef, newPosition);
    console.log(
      `\n✅ SUCCESS: Document successfully written to Firestore!`
    );
    console.log(`You can verify it at path: ${docPath}`);
  } catch (error) {
    console.error("\n❌ FAILED: An error occurred while writing to Firestore.");
    console.error("-------------------- ERROR DETAILS --------------------");
    console.error(error);
    console.error("-----------------------------------------------------");
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
        console.error("\n💡 This looks like a permission or index issue. If the error message contains a link to create an index, please follow it.");
    }
  }
}

testFirestoreWrite();
