import { useState, useEffect } from "react";

const KUCOIN_FUTURES_PROXY_URL = "/api/kucoin-futures-tickers";

export interface KucoinFuturesContract {
symbol: string;
rootSymbol: string;
type: string;
firstOpenDate: number;
expireDate: number | null;
settleDate: number | null;
baseCurrency: string;
quoteCurrency: string;
settleCurrency: string;
maxOrderQty: number;
maxPrice: number;
lotSize: number;
tickSize: number;
indexPriceTickSize: number;
multiplier: number;
initialMargin: number;
maintainMargin: number;
maxRiskLimit: number;
minRiskLimit: number;
riskStep: number;
makerFeeRate: number;
takerFeeRate: number;
takerFixFee: number;
makerFixFee: number;
settlementFee: number | null;
isDeleverage: boolean;
isQuanto: boolean;
isInverse: boolean;
markMethod: string;
fairMethod: string;
fundingBaseSymbol: string;
fundingQuoteSymbol: string;
fundingRateSymbol: string;
indexSymbol: string;
settlementSymbol: string;
status: string;
fundingFeeRate: number;
predictedFundingFeeRate: number;
openInterest: string;
turnoverOf24h: number;
volumeOf24h: number;
markPrice: number;
indexPrice: number;
lastTradePrice: number;
nextFundingRateTime: number;
maxLeverage: number;
sourceExchanges: string[];
premiumsSymbol1M: string;
premiumsSymbol8H: string;
fundingBaseSymbol1M: string;
fundingQuoteSymbol1M: string;
lowPrice: number;
highPrice: number;
priceChgPct: number;
priceChg: number;
k: number;
m: number;
f: number;
mmrLimit: number;
mmrLevConstant: number;
supportCross: boolean;
buyLimit: number;
sellLimit: number;
}


interface KucoinFuturesApiResponse {
code: string;
data: KucoinFuturesContract[];
}

export function useKucoinFuturesContracts() {
const [contracts, setContracts] = useState<KucoinFuturesContract[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
const fetchContracts = async () => {
try {
const response = await fetch(KUCOIN_FUTURES_PROXY_URL);
if (!response.ok) {
throw new Error("Failed to fetch KuCoin futures contracts from proxy");
}
const data: KucoinFuturesApiResponse = await response.json();
if (data && data.code === "200000" && data.data) {
setContracts(data.data);
}
} catch (error) {
console.error("Error fetching futures contracts:", error);
} finally {
setLoading(false);
}
};

fetchContracts();
const interval = setInterval(fetchContracts, 60000); 

return () => clearInterval(interval);
}, []);

return { contracts, loading };
}

