
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

      <main className="flex-grow container mx-auto flex flex-col">
        {/* This div is the direct child of main, it needs to grow */}
        <div className="grid grid-cols-1 lg:grid-cols-3 flex-grow"> {/* Removed gap */}
          <section className="lg:col-span-2 h-full flex flex-col"> {/* h-full is correct here as grid child */}
            <MainViews currentSymbol={activeSymbol} />
          </section>
          <aside className="lg:col-span-1 h-full flex flex-col lg:border-l border-border"> {/* Added border for separation */}
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
