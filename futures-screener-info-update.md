Perfect — that’s the right instinct. You don’t actually need the spot data to know who’s paying whom; your futures screener already has the essential ingredients. Let’s wire this cleanly so your paper trading agent can use it as a contextual sentiment signal.


---

⚙️ 1. Inputs you already have

From your KuCoin Futures screener API:

fundingRate → shows the direction of payment.

Positive = longs pay shorts

Negative = shorts pay longs


openInterest → shows how much money is in the game (conviction).

volume24h → shows recent trading activity (momentum).


That’s enough to calculate a sentiment “tension” or “bias” score.


---

🧮 2. Core calculation

You can encode this as a normalized signal for your agent, something like:

const fundingBias = fundingRate > 0 ? 1 : fundingRate < 0 ? -1 : 0;

const openInterestStrength = normalize(openInterest, minOI, maxOI);
const volumeStrength = normalize(volume24h, minVol, maxVol);

const sentimentScore = fundingBias * (0.6 * openInterestStrength + 0.4 * volumeStrength);

Then interpret it:

Positive score → longs dominant (bullish bias)

Negative score → shorts dominant (bearish bias)

Magnitude gives strength of imbalance (e.g., crowded positions = higher squeeze risk)


Your normalize() can be a simple min–max scaling function across your watchlist symbols.


---

🧠 3. Signal logic (for display or automation)

You can turn this into a semantic label for your screener:

let signal = "";
if (fundingRate > 0 && openInterest > avgOI * 1.2) {
  signal = "🟥 Longs paying (bullish overcrowding)";
} else if (fundingRate < 0 && openInterest > avgOI * 1.2) {
  signal = "🟩 Shorts paying (bearish overcrowding)";
} else if (Math.abs(fundingRate) < 0.0001) {
  signal = "⚪ Neutral funding";
} else {
  signal = fundingRate > 0 ? "🔴 Mild bullish bias" : "🟢 Mild bearish bias";
}

That can be added as a new field in your screener output, for example:

{
  "symbol": "XBTUSDTM",
  "price": 68200,
  "fundingRate": 0.00012,
  "openInterest": 2.3e9,
  "volume24h": 1.1e9,
  "sentiment": "🟥 Longs paying (bullish overcrowding)"
}


---

🚀 4. What this gives your agent

Your paper trading agent can now:

Read a simple sentiment field (sentimentScore or sentimentLabel).

Bias its entry logic toward mean-reversion or breakout trades.

e.g., when fundingRate > 0 and sentiment overheated → watch for short setups.

when fundingRate < 0 → possible long setups after shakeouts.




---

Would you like me to show you the exact Node.js function that takes your KuCoin Futures screener response and adds this calculated “who’s paying whom” sentiment field for each symbol?