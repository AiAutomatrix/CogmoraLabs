
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// --- Your Firebase Project Configuration ---
// This is added directly into the file as requested for the test.
const firebaseConfig = {
  "projectId": "studio-2613744537-e60c7",
  "appId": "1:1084135620241:web:8d9b766b81cf970c900930",
  "apiKey": "AIzaSyCtkTPALNPLwJxBFuAjJlwWZmG9djJSfGc",
  "authDomain": "studio-2613744537-e60c7.firebaseapp.com",
};

// --- Test Parameters ---
// Using a hardcoded user ID for this test.
// IMPORTANT: This user ID must exist in your Firebase Authentication.
// If you are testing with a specific user, replace this with their actual UID.
const TEST_USER_ID = "REPLACE_WITH_A_REAL_USER_ID";
const TEST_POSITION_ID = `test-pos-${Date.now()}`;


async function runFirestoreWriteTest() {
  console.log("🚀 Starting Firestore write test...");

  if (TEST_USER_ID === "REPLACE_WITH_A_REAL_USER_ID") {
    console.error("❌ ERROR: Please replace 'REPLACE_WITH_A_REAL_USER_ID' in the script with an actual user ID from your Firebase project.");
    return;
  }

  // 1. Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  console.log(`🔥 Firebase App initialized for project: ${app.options.projectId}`);

  // 2. Define the document reference
  const positionRef = doc(db, `users/${TEST_USER_ID}/paperTradingContext/main/openPositions/${TEST_POSITION_ID}`);
  console.log(`📝 Preparing to write to path: ${positionRef.path}`);

  // 3. Define the sample data to write
  const samplePositionData = {
    averageEntryPrice: 65000,
    currentPrice: 65100,
    id: TEST_POSITION_ID,
    positionType: "spot",
    side: "buy",
    size: 0.1,
    symbol: "BTC-USDT",
    symbolName: "BTC-USDT",
    unrealizedPnl: 10,
    details: {
      status: "open",
      triggeredBy: "manual-test-script"
    },
    updatedAt: Date.now()
  };

  // 4. Attempt the write operation
  try {
    await setDoc(positionRef, samplePositionData);
    console.log("✅ SUCCESS: Document written successfully to Firestore!");
    console.log(`\t- User ID: ${TEST_USER_ID}`);
    console.log(`\t- Position ID: ${TEST_POSITION_ID}`);
    console.log("\nCheck your Firestore console to verify the data.");
  } catch (error) {
    console.error("❌ FAILED: An error occurred while writing to Firestore.");
    console.error("\n==================== ERROR DETAILS ====================");
    console.error(error);
    console.error("=======================================================");
    console.log("\nIf this is a permission error, check your Security Rules.");
    console.log("If this is a 'FAILED_PRECONDITION' error, it may contain a link to create the required index. Copy and paste that link into your browser.");
  }
}

runFirestoreWriteTest();
