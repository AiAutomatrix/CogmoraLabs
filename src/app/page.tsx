
'use client';

import TradeFlowLogo from '@/components/tradeflow/TradeFlowLogo';
import MainViews from '@/components/tradeflow/MainViews';
import MiniWidgets from '@/components/tradeflow/MiniWidgets';
import React, { useState } from 'react';

export default function HomePage() {
  const [activeSymbol, setActiveSymbol] = useState<string>('BINANCE:BTCUSDT'); // Default symbol, TradingView format

  const handleSymbolChange = (newSymbol: string) => {
    if (newSymbol && newSymbol.trim() !== '') {
      let formattedSymbol = newSymbol.toUpperCase().trim();
      // Ensure symbol is in TradingView format (e.g., EXCHANGE:SYMBOL)
      if (!formattedSymbol.includes(':') && formattedSymbol.length > 0) {
         // Basic heuristic: if it looks like a pair (e.g., BTCUSDT), assume Binance or a common exchange
         // This might need to be smarter based on typical user input or a default exchange preference
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

      {/* Main content area grows to fill space and is a grid container */}
      <main className="flex-grow container mx-auto grid grid-cols-1 lg:grid-cols-3">
        {/* Section for MainViews, takes 2 columns and is a flex container to allow its child to be h-full */}
        <section className="lg:col-span-2 flex flex-col">
          <MainViews currentSymbol={activeSymbol} />
        </section>
        {/* Aside for MiniWidgets, takes 1 column and is a flex container */}
        <aside className="lg:col-span-1 flex flex-col lg:border-l border-border">
          <MiniWidgets currentSymbol={activeSymbol} onSymbolChange={handleSymbolChange} />
        </aside>
      </main>

      <footer className="p-4 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} TradeFlow. All rights reserved. Market data provided by TradingView.
        </p>
      </footer>
    </div>
  );
}
