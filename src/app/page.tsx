
'use client';

import TradeFlowLogo from '@/components/tradeflow/TradeFlowLogo';
import MainViews from '@/components/tradeflow/MainViews';
import MiniWidgets from '@/components/tradeflow/MiniWidgets';
import React, { useState } from 'react';

export default function HomePage() {
  const [activeSymbol, setActiveSymbol] = useState<string>('BINANCE:BTCUSDT'); // Default symbol, TradingView format

  const handleSymbolChange = (newSymbol: string) => {
    if (newSymbol && newSymbol.trim() !== '') {
      // Assuming newSymbol might come from user input like "LTCUSDT"
      // We might need to prepend "BINANCE:" or similar if not already formatted
      // For now, let's assume the AiWebchat sends it in a usable format or we adapt it there.
      // A common format for TradingView symbols is EXCHANGE:PAIR (e.g., BINANCE:BTCUSDT)
      // For simplicity, let's ensure it's uppercase and trim.
      // If the symbol from AI chat doesn't include an exchange, we might default to BINANCE.
      let formattedSymbol = newSymbol.toUpperCase().trim();
      if (!formattedSymbol.includes(':')) {
        formattedSymbol = `BINANCE:${formattedSymbol}`;
      }
      setActiveSymbol(formattedSymbol);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="p-4 border-b border-border shadow-md sticky top-0 bg-background z-50">
        <div className="container mx-auto">
          <TradeFlowLogo />
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-6 h-full">
          <section className="lg:col-span-2 h-full flex flex-col">
            <MainViews currentSymbol={activeSymbol} />
          </section>
          <aside className="lg:col-span-1 h-full flex flex-col">
            <MiniWidgets currentSymbol={activeSymbol} onSymbolChange={handleSymbolChange} />
          </aside>
        </div>
      </main>

      <footer className="p-4 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} TradeFlow. All rights reserved. Market data provided by TradingView.
        </p>
      </footer>
    </div>
  );
}
