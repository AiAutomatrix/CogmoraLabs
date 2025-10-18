import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();
const docRef = db.doc("users/manual-test-user/paperTradingContext/main/openPositions/test-pos-123");
await docRef.set({
  id: "test-pos-123",
  averageEntryPrice: 50000,
  currentPrice: 50000,
  symbol: "BTC-USDT",
});
console.log("✅ Write successful via Admin SDK");