
'use client';

// import TradeFlowLogo from '@/components/tradeflow/TradeFlowLogo';
import MainViews from '@/components/tradeflow/main-views/MainViews';
import MiniWidgets from '@/components/tradeflow/mini-widgets/MiniWidgets';
import { PaperTradingProvider } from '@/context/PaperTradingContext';
import React, { useState } from 'react';

export default function HomePage() {
  const [activeSymbol, setActiveSymbol] = useState<string>('BINANCE:BTCUSDT'); // Default symbol, TradingView format

  const [selectedCryptoScreener, setSelectedCryptoScreener] = useState('all_kucoin');
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
    <PaperTradingProvider>
      <div className="flex-grow flex flex-col bg-background min-h-0 overflow-y-auto">
        <header className="border-b border-border shadow-md sticky top-0 bg-background z-50">
          <div className="container mx-auto">
            {/* <TradeFlowLogo /> */}
          </div>
        </header>

        <main className="flex flex-col lg:flex-row flex-grow h-full">
          <section className="lg:w-2/3 flex flex-col h-full">
            <MainViews
              currentSymbol={activeSymbol}
              selectedCryptoScreener={selectedCryptoScreener}
              setSelectedCryptoScreener={setSelectedCryptoScreener}
            />
          </section>
          <aside className="lg:w-1/3 flex flex-col lg:border-l border-border flex-grow h-[calc(100vh-8rem)] lg:h-full overflow-y-auto">
            <MiniWidgets currentSymbol={activeSymbol} onSymbolChange={handleSymbolChange} />
          </aside>
        </main>

        <footer className="p-4 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} TradeFlow. All rights reserved. Market data provided by TradingView.
          </p>
        </footer>
      </div>
    </PaperTradingProvider>
  );
}
