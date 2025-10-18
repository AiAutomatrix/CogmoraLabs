// test-firestore-query.mjs
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { getApps } from "firebase/app";

// --- 1. Firebase config with your actual project credentials ---
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

// --- 3. Function to test writing a document ---
async function runWriteTest() {
  try {
    // IMPORTANT: Replace this with a REAL User ID from your Firebase Authentication
    const testUserId = 'REPLACE_WITH_A_REAL_USER_ID';
    if (testUserId === 'REPLACE_WITH_A_REAL_USER_ID') {
        console.error("❌ ERROR: Please replace 'REPLACE_WITH_A_REAL_USER_ID' in the script with a real User ID from your Firebase project.");
        return;
    }
    
    const positionId = `test-position-${Date.now()}`;
    const docPath = `/users/${testUserId}/paperTradingContext/main/openPositions/${positionId}`;
    const docRef = doc(db, docPath);

    const newPositionData = {
      id: positionId,
      positionType: 'spot',
      symbol: 'TEST-USDT',
      symbolName: 'Test Coin',
      size: 100,
      averageEntryPrice: 1.0,
      currentPrice: 1.0,
      side: 'buy',
      details: {
        triggeredBy: 'manual-test'
      }
    };

    console.log(`Attempting to write to: ${docPath}`);
    await setDoc(docRef, newPositionData);
    
    console.log("✅ Firestore write successful!");
    console.log("Document ID:", positionId);
    console.log("Please check your Firestore database to confirm the data was written correctly.");

  } catch (err) {
    console.error("❌ Firestore write FAILED:", err.message);
    if (err.message.includes("permission-denied")) {
        console.log("Hint: This is a permission error. Check your Firestore Security Rules and ensure the user ID you are using is correct.");
    } else if (err.code === 'failed-precondition' && err.message.includes('index')) {
        console.log("Hint: The query part of this operation requires an index. The error message should contain a link to create it.");
    }
  }
}

runWriteTest();
