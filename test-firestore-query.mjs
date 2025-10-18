// test-firestore-write.mjs
// A manual test script to diagnose Firestore write permissions.
//
// To run:
// 1. Save this file
// 2. Run: node test-firestore-write.mjs

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// --- CONFIGURATION ---
// Your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCtkTPALNPLwJxBFuAjJlwWZmG9djJSfGc",
  authDomain: "studio-2613744537-e60c7.firebaseapp.com",
  projectId: "studio-2613744537-e60c7",
  storageBucket: "studio-2613744537-e60c7.firebasestorage.app",
  messagingSenderId: "1084135620241",
  appId: "1:1084135620241:web:8d9b766b81cf970c900930",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- SCRIPT LOGIC ---
async function testFirestoreWrite() {
  const testUserId = "manual-test-user"; // Any placeholder string; no auth needed for testing rules

  const positionId = `test-pos-${Date.now()}`;
  const docPath = `users/${testUserId}/paperTradingContext/main/openPositions/${positionId}`;

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
    console.log(`\n✅ SUCCESS: Document successfully written to Firestore!`);
    console.log(`You can verify it at path: ${docPath}`);
  } catch (error) {
    console.error("\n❌ FAILED: An error occurred while writing to Firestore.");
    console.error("-------------------- ERROR DETAILS --------------------");
    console.error(error);
    console.error("-----------------------------------------------------");

    if (error.code === "permission-denied" || error.code === "failed-precondition") {
      console.error(
        "\n💡 This looks like a permission or index issue. Make sure your Firestore security rules allow writes for this path."
      );
    }
  }
}

testFirestoreWrite();