// test-firestore-query.mjs
import { initializeApp } from "firebase/app";
import { getFirestore, collectionGroup, query, where, orderBy, getDocs } from "firebase/firestore";
import { getApps } from "firebase/app";

// --- 1. Firebase config (replace with your actual keys or load from env) ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
};

// --- 2. Initialize Firebase ---
if (!getApps().length) {
  initializeApp(firebaseConfig);
}

const db = getFirestore();

// --- 3. Run the query you want to test ---
async function runQuery() {
  try {
    const q = query(
      collectionGroup(db, "openPositions"),
      where("positionData.symbol", "==", "RVV-USDT"),
      orderBy("positionData.updatedAt")
    );

    const snapshot = await getDocs(q);
    console.log("✅ Query ran successfully. Docs found:", snapshot.size);
  } catch (err) {
    console.error("❌ Query failed:", err.message);
    if (err.message.includes("create index")) {
      console.log("⚠️ Firestore will print a URL below — click it to create the missing index.");
    }
  }
}

runQuery();