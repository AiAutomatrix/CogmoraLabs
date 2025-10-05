
'use client';

import MainViews from '@/components/cogmora-labs/main-views/MainViews';
import MiniWidgets from '@/components/cogmora-labs/mini-widgets/MiniWidgets';
import { PaperTradingProvider } from '@/context/PaperTradingContext';
import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, LineChart, Columns, ListFilter, Settings2, SearchCode, NotebookPen } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';

export default function HomePage() {
  const [activeSymbol, setActiveSymbol] = useState<string>('KUCOIN:BTCUSDT');
  const [selectedCryptoScreener, setSelectedCryptoScreener] = useState('all_kucoin');
  const [activeView, setActiveView] = useState('paper_trading');
  const [selectedChartLayout, setSelectedChartLayout] = useState(1);
  const [selectedHeatmapView, setSelectedHeatmapView] = useState('crypto_coins');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // New state for multi-symbol selection
  const [numberOfChartsToSelect, setNumberOfChartsToSelect] = useState(1);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [multiChartSymbols, setMultiChartSymbols] = useState<string[]>([
    'KUCOIN:BTCUSDT',
    'BINANCE:ETHUSDT',
    'BINANCE:XRPUSDT',
    'BINANCE:SOLUSDT'
  ]);

  const formatTradingViewSymbol = (kucoinSymbol: string): string => {
    if (!kucoinSymbol || kucoinSymbol.trim() === '') return '';

    let formattedSymbol = kucoinSymbol.toUpperCase().trim();
    
    // If the symbol already has a ':' it's likely already formatted for TradingView
    if (formattedSymbol.includes(':')) {
      return formattedSymbol;
    }
    
    // Handle special KCS pair conversions for TradingView
    if (formattedSymbol === 'ETH-KCS') {
      formattedSymbol = 'KCSETH';
    } else if (formattedSymbol === 'BTC-KCS') {
      formattedSymbol = 'KCSBTC';
    } else {
      formattedSymbol = formattedSymbol.replace('-', '');
    }

    // Default to KUCOIN exchange for symbols coming from our screeners
    return `KUCOIN:${formattedSymbol}`;
  };

  const handleSymbolChange = (newSymbol: string) => {
    const formatted = formatTradingViewSymbol(newSymbol);
    if (formatted) {
      setActiveSymbol(formatted);
      // Also update the first symbol in the multi-chart layout
      setMultiChartSymbols(prev => [formatted, ...prev.slice(1)]);
    }
  };
  
  const handleMultiSymbolSelect = (kucoinSymbol: string) => {
    const formattedSymbol = formatTradingViewSymbol(kucoinSymbol);
    if (!formattedSymbol || selectedSymbols.includes(formattedSymbol)) return;

    const newSelectedSymbols = [...selectedSymbols, formattedSymbol];

    if (newSelectedSymbols.length < numberOfChartsToSelect) {
      setSelectedSymbols(newSelectedSymbols);
    } else {
      // Last symbol selected, update charts and switch view
      const finalSymbols = [...newSelectedSymbols];
      // Fill remaining slots if necessary, to avoid breaking chart layout
      while (finalSymbols.length < 4) {
        finalSymbols.push(multiChartSymbols[finalSymbols.length] || 'BINANCE:SOLUSDT');
      }
      setMultiChartSymbols(finalSymbols);
      setActiveSymbol(finalSymbols[0]); // Set the first symbol as the main active one
      setSelectedSymbols([]); // Clear the buffer
      setActiveView('chart'); // Switch to chart view
      window.scrollTo(0, 0); // Scroll to top
    }
  };

  const handleSymbolSelect = (newSymbol: string) => {
    // This function is now for single-symbol selection which also triggers multi-select logic
    if (numberOfChartsToSelect > 1 && selectedSymbols.length < numberOfChartsToSelect) {
      handleMultiSymbolSelect(newSymbol);
    } else {
      handleSymbolChange(newSymbol);
      setActiveView('chart');
      window.scrollTo(0, 0); // Scroll to top
    }
  };

  const handleViewChange = (view: string) => {
    setActiveView(view);
    setIsMobileNavOpen(false);
  };
  
  const handleChartLayoutChange = (layout: number) => {
    setSelectedChartLayout(layout);
    setNumberOfChartsToSelect(layout);
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
            {/* Desktop Header */}
            <div className="hidden lg:flex items-center">
              <Link href="/" passHref>
                <h1 className="text-xl font-bold cursor-pointer">Cogmora Labs</h1>
              </Link>
            </div>
             {/* Mobile Header */}
             <div className="flex items-center justify-between w-full lg:hidden">
                <Link href="/" passHref>
                  <h1 className="text-xl font-bold cursor-pointer">Cogmora Labs</h1>
                </Link>
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
                          <SheetTitle className="text-lg font-semibold sr-only">Cogmora Labs</SheetTitle>
                          <SheetDescription className="sr-only">Main navigation menu for the Cogmora Labs application.</SheetDescription>
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
                                          <Button key={`chart-${o.value}`} variant="ghost" className="w-full justify-start" onClick={() => { handleChartLayoutChange(o.value); handleViewChange('chart'); }}>{o.label}</Button>
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
              multiChartSymbols={multiChartSymbols}
              onSymbolSelect={handleSymbolSelect}
              selectedCryptoScreener={selectedCryptoScreener}
              setSelectedCryptoScreener={setSelectedCryptoScreener}
              selectedChartLayout={selectedChartLayout}
              setSelectedChartLayout={handleChartLayoutChange}
              selectedHeatmapView={selectedHeatmapView}
              setSelectedHeatmapView={setSelectedHeatmapView}
              selectedSymbolsForHighlight={selectedSymbols}
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
