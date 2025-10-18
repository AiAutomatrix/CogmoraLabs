
// Import the necessary functions from the Firebase SDK.
// We are using the client-side SDK for this test to mimic the web app's behavior.
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// --- YOUR FIREBASE CONFIG ---
// This is the client-side configuration for your Firebase project.
const firebaseConfig = {
  "projectId": "studio-2613744537-e60c7",
  "appId": "1:1084135620241:web:8d9b766b81cf970c900930",
  "apiKey": "AIzaSyCtkTPALNPLwJxBFuAjJlwWZmG9djJSfGc",
  "authDomain": "studio-2613744537-e60c7.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "1084135620241"
};

// --- TEST SETUP ---
// A hardcoded User ID for testing purposes.
// Replace with a real UID from your Firebase Auth console if needed.
const TEST_USER_ID = 'test-user-for-manual-script';

// --- MAIN TEST FUNCTION ---
async function runFirestoreWriteTest() {
  console.log('🚀 Initializing Firebase App...');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  try {
    // To write to Firestore, we must be authenticated to pass the security rules.
    // We will sign in as an anonymous user for this test.
    console.log('🔒 Authenticating as an anonymous user...');
    await signInAnonymously(auth);
    const user = auth.currentUser;

    if (!user) {
        throw new Error("Authentication failed. Could not get current user.");
    }
    console.log(`✅ Authenticated successfully with temporary UID: ${user.uid}`);
    console.log(`ℹ️  Note: Security rules will be checked against this UID, not the hardcoded TEST_USER_ID.`);

    // Define the document we want to write.
    const newPositionId = `test-pos-${Date.now()}`;
    const positionData = {
        id: newPositionId,
        averageEntryPrice: 65000,
        currentPrice: 65100,
        positionType: 'spot',
        side: 'buy',
        size: 0.1,
        symbol: 'BTC-USDT',
        symbolName: 'Bitcoin',
        details: {
            triggeredBy: 'manual-test-script',
            status: 'open'
        },
        updatedAt: Date.now(), // For potential index queries
    };

    // Construct the full path to the new document.
    // NOTE: We use the authenticated user's UID here.
    const docPath = `users/${user.uid}/paperTradingContext/main/openPositions/${newPositionId}`;
    const positionDocRef = doc(db, docPath);

    console.log(`\n✍️  Attempting to write a new open position to:`);
    console.log(`   ${docPath}`);

    // Perform the write operation.
    await setDoc(positionDocRef, positionData);

    console.log('\n✅ SUCCESS! Document written to Firestore successfully.');
    console.log('   This means your security rules and indexes for this write operation are working correctly.');

  } catch (error) {
    console.error('\n❌ ERROR! The write operation failed.');
    console.error('   This is likely due to a security rule violation or a missing index.');
    console.error('   Detailed Error:', error);
  } finally {
    // In a real app you might want to sign out, but for a one-off script this is fine.
    process.exit(0);
  }
}

// Run the test
runFirestoreWriteTest();
