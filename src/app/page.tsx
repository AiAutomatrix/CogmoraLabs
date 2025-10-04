
'use client';

import MainViews from '@/components/cogmora-labs/main-views/MainViews';
import MiniWidgets from '@/components/cogmora-labs/mini-widgets/MiniWidgets';
import { PaperTradingProvider } from '@/context/PaperTradingContext';
import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, LineChart, Columns, ListFilter, Settings2, SearchCode, NotebookPen } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function HomePage() {
  const [activeSymbol, setActiveSymbol] = useState<string>('KUCOIN:BTC-USDT');
  const [selectedCryptoScreener, setSelectedCryptoScreener] = useState('all_kucoin');
  const [activeView, setActiveView] = useState('paper_trading');
  const [selectedChartLayout, setSelectedChartLayout] = useState(1);
  const [selectedHeatmapView, setSelectedHeatmapView] = useState('crypto_coins');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const handleSymbolChange = (newSymbol: string) => {
    if (newSymbol && newSymbol.trim() !== '') {
      let formattedSymbol = newSymbol.toUpperCase().trim();
      if (!formattedSymbol.includes(':') && formattedSymbol.length > 0) {
        // Default to KUCOIN for symbols from our screeners
        formattedSymbol = `KUCOIN:${formattedSymbol}`;
      }
      setActiveSymbol(formattedSymbol);
    }
  };

  const handleSymbolSelect = (newSymbol: string) => {
    handleSymbolChange(newSymbol);
    setActiveView('chart');
  };

  const handleViewChange = (view: string) => {
    setActiveView(view);
    setIsMobileNavOpen(false);
  };
  
  const chartLayoutOptions = [
    { value: 1, label: '1 Chart' },
    { value: 2, label: '2 Charts' },
    { value: 3, label: '3 Charts + Analysis' },
    { value: 4, label: '4 Charts' },
  ];
  
  const heatmapViewOptions = [
    { value: 'crypto_coins', label: 'Crypto Coins' },
    { value: 'stock_market', label: 'Stock Market' },
    { value: 'etf_heatmap', label: 'ETFs' },
    { value: 'forex_cross_rates', label: 'Forex Cross Rates' },
    { value: 'forex_heatmap', label: 'Forex Heatmap' },
  ];
  
  const cryptoScreenerOptions = [
    { value: 'all_kucoin', label: 'Kucoin Spot' },
    { value: 'kucoin_futures', label: 'Kucoin Futures' },
    { value: 'tradingview_crypto', label: 'TradingView' },
  ];


  return (
    <PaperTradingProvider>
      <div className="flex flex-col bg-background h-full">
        <header className="border-b border-border shadow-md sticky top-0 bg-background z-50">
          <div className="container mx-auto flex items-center justify-between h-14">
            <div className="hidden lg:flex items-center">
              <h1 className="text-xl font-bold">Cogmora Labs</h1>
            </div>
             <div className="flex items-center justify-between w-full lg:hidden">
               <h1 className="text-xl font-bold">Cogmora Labs</h1>
              <div>
                <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Menu className="h-6 w-6" />
                      <span className="sr-only">Open navigation menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-64 p-0">
                      <SheetHeader className="p-4 border-b">
                          <SheetTitle className="sr-only">Cogmora Labs</SheetTitle>
                          <SheetDescription className="sr-only">Main navigation menu for the Cogmora Labs application.</SheetDescription>
                          <h2 className="text-lg font-semibold">Cogmora Labs</h2>
                      </SheetHeader>
                      <div className="overflow-y-auto p-4">
                          <Accordion type="single" collapsible defaultValue="main">
                              <AccordionItem value="main">
                                  <Button
                                      variant="ghost"
                                      className="w-full justify-start text-base mb-2"
                                      onClick={() => handleViewChange('paper_trading')}
                                  >
                                      <NotebookPen className="mr-2 h-4 w-4" /> Paper Trading
                                  </Button>
                              </AccordionItem>
                              <AccordionItem value="charts">
                                  <AccordionTrigger>
                                      <span className="flex items-center"><LineChart className="mr-2 h-4 w-4"/> Charts</span>
                                  </AccordionTrigger>
                                  <AccordionContent className="pl-4">
                                      {chartLayoutOptions.map(o => (
                                          <Button key={`chart-${o.value}`} variant="ghost" className="w-full justify-start" onClick={() => { setSelectedChartLayout(o.value); handleViewChange('chart'); }}>{o.label}</Button>
                                      ))}
                                  </AccordionContent>
                              </AccordionItem>
                              <AccordionItem value="heatmaps">
                                  <AccordionTrigger>
                                      <span className="flex items-center"><Columns className="mr-2 h-4 w-4"/> Heatmaps</span>
                                  </AccordionTrigger>
                                  <AccordionContent className="pl-4">
                                       {heatmapViewOptions.map(o => (
                                          <Button key={`heatmap-${o.value}`} variant="ghost" className="w-full justify-start" onClick={() => { setSelectedHeatmapView(o.value); handleViewChange('heatmap'); }}>{o.label}</Button>
                                      ))}
                                  </AccordionContent>
                              </AccordionItem>
                              <AccordionItem value="screeners">
                                  <AccordionTrigger>
                                      <span className="flex items-center"><ListFilter className="mr-2 h-4 w-4"/> Screeners</span>
                                  </AccordionTrigger>
                                  <AccordionContent className="pl-4">
                                      <Button variant="ghost" className="w-full justify-start" onClick={() => handleViewChange('options_screener')}><Settings2 className="mr-2 h-4 w-4"/>Options</Button>
                                      {cryptoScreenerOptions.map(o => (
                                          <Button key={`crypto-${o.value}`} variant="ghost" className="w-full justify-start" onClick={() => { setSelectedCryptoScreener(o.value); handleViewChange('crypto_screener'); }}>{o.label}</Button>
                                      ))}
                                      <Button variant="ghost" className="w-full justify-start" onClick={() => handleViewChange('dex_screener')}><SearchCode className="mr-2 h-4 w-4"/>DEX</Button>
                                  </AccordionContent>
                              </AccordionItem>
                          </Accordion>
                      </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </header>

        <main className="flex flex-col lg:flex-row flex-grow lg:min-h-0">
          <section className="flex flex-col lg:w-2/3 lg:min-h-0">
            <MainViews
              activeView={activeView}
              setActiveView={setActiveView}
              currentSymbol={activeSymbol}
              onSymbolSelect={handleSymbolSelect}
              selectedCryptoScreener={selectedCryptoScreener}
              setSelectedCryptoScreener={setSelectedCryptoScreener}
              selectedChartLayout={selectedChartLayout}
              setSelectedChartLayout={setSelectedChartLayout}
              selectedHeatmapView={selectedHeatmapView}
              setSelectedHeatmapView={setSelectedHeatmapView}
            />
          </section>
          <aside className="flex flex-col lg:w-1/3 lg:border-l border-border min-h-[1000px] lg:min-h-0">
            <MiniWidgets currentSymbol={activeSymbol} onSymbolChange={handleSymbolChange} />
          </aside>
        </main>

        <footer className="p-4 border-t border-border text-center flex-shrink-0">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Cogmora Labs. All rights reserved. Market data provided by TradingView.
          </p>
        </footer>
      </div>
    </PaperTradingProvider>
  );
}
