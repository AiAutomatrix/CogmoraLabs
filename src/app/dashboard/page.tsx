
'use client';

import MainViews from '@/components/cogmora-labs/main-views/MainViews';
import MiniWidgets from '@/components/cogmora-labs/mini-widgets/MiniWidgets';
import { PaperTradingProvider, usePaperTrading } from '@/context/PaperTradingContext';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, LineChart, Columns, ListFilter, Settings2, SearchCode, NotebookPen } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';
import type { ProposeTradeTriggersOutput, AiTriggerSettings, TradeTrigger } from '@/types';
import { proposeTradeTriggers } from '@/ai/flows/propose-trade-triggers-flow';
import { useToast } from '@/hooks/use-toast';

const PageContent: React.FC = () => {
  const [activeSymbol, setActiveSymbol] = useState<string>('KUCOIN:BTCUSDT');
  const [selectedCryptoScreener, setSelectedCryptoScreener] = useState('all_kucoin');
  const [activeView, setActiveView] = useState('paper_trading');
  const [activeMiniView, setActiveMiniView] = useState('ai_chat');
  const [selectedChartLayout, setSelectedChartLayout] = useState(1);
  const [selectedHeatmapView, setSelectedHeatmapView] = useState('crypto_coins');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { watchlist, addTradeTrigger, tradeTriggers } = usePaperTrading();
  const { toast } = useToast();

  // State for AI Agent moved here
  const [aiAgentState, setAiAgentState] = useState<ProposeTradeTriggersOutput & { isLoading: boolean }>({
    analysis: '',
    proposedTriggers: [],
    isLoading: false,
  });

  const [aiSettings, setAiSettings] = useState<AiTriggerSettings>({
    instructions: '',
    setSlTp: true,
    scheduleInterval: null,
    autoExecute: false,
  });
  
  const [nextAiScrapeTime, setNextAiScrapeTime] = useState(0);
  const aiAutomationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // New state for multi-symbol selection
  const [numberOfChartsToSelect, setNumberOfChartsToSelect] = useState(1);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [multiChartSymbols, setMultiChartSymbols] = useState<string[]>([
    'KUCOIN:BTCUSDT',
    'BINANCE:ETHUSDT',
    'BINANCE:XRPUSDT',
    'BINANCE:SOLUSDT'
  ]);
  
  const handleAiTriggerAnalysis = useCallback(async (isScheduled = false) => {
    if (watchlist.length === 0) {
      if (!isScheduled) {
        toast({ title: "AI Analysis Skipped", description: "Please add items to your watchlist first.", variant: "destructive"});
      }
      return;
    }
    
    if (!isScheduled) {
      setActiveMiniView('ai_paper_trading');
    }
    setAiAgentState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await proposeTradeTriggers({ watchlist, settings: aiSettings, activeTriggers: tradeTriggers });

      if (aiSettings.autoExecute) {
        response.proposedTriggers.forEach((trigger: Omit<TradeTrigger, 'id' | 'status'>) => {
          addTradeTrigger(trigger);
        });
        toast({ title: 'AI Auto-Execution', description: `${response.proposedTriggers.length} triggers were automatically added.` });
        setAiAgentState({ analysis: response.analysis, proposedTriggers: [], isLoading: false });
      } else {
        setAiAgentState({ ...response, isLoading: false });
      }

    } catch (error) {
      console.error("AI Trigger Analysis failed:", error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      if (!isScheduled) {
        setAiAgentState({ analysis: `An error occurred: ${errorMessage}`, proposedTriggers: [], isLoading: false });
      }
      toast({ title: "AI Analysis Failed", description: errorMessage, variant: "destructive"});
    }
  }, [watchlist, aiSettings, addTradeTrigger, toast, setActiveMiniView, tradeTriggers]);

  // Effect for AI scheduling
  useEffect(() => {
    if (aiAutomationIntervalRef.current) {
      clearInterval(aiAutomationIntervalRef.current);
    }
    if (aiSettings.scheduleInterval && aiSettings.scheduleInterval > 0) {
      const runScheduledAnalysis = () => handleAiTriggerAnalysis(true);
      
      const lastScrape = localStorage.getItem('aiPaperTrading_lastScrapeTime');
      const lastScrapeTime = lastScrape ? parseInt(lastScrape, 10) : Date.now();
      const timeSinceLast = Date.now() - lastScrapeTime;
      const initialDelay = Math.max(0, aiSettings.scheduleInterval - timeSinceLast);

      const timeoutId = setTimeout(() => {
        runScheduledAnalysis(); // Run first scrape after initial delay
        localStorage.setItem('aiPaperTrading_lastScrapeTime', Date.now().toString());
        setNextAiScrapeTime(Date.now() + aiSettings.scheduleInterval!);

        aiAutomationIntervalRef.current = setInterval(() => {
          runScheduledAnalysis();
          localStorage.setItem('aiPaperTrading_lastScrapeTime', Date.now().toString());
          setNextAiScrapeTime(Date.now() + aiSettings.scheduleInterval!);
        }, aiSettings.scheduleInterval!);
      }, initialDelay);
      
      setNextAiScrapeTime(Date.now() + initialDelay);

      return () => {
        clearTimeout(timeoutId);
        if (aiAutomationIntervalRef.current) {
          clearInterval(aiAutomationIntervalRef.current);
        }
      };
    } else {
      setNextAiScrapeTime(0);
    }
  }, [aiSettings.scheduleInterval, handleAiTriggerAnalysis]);

  useEffect(() => {
    if (activeView === 'chart') {
      if (activeMiniView !== 'ai_paper_trading') {
         setActiveMiniView('tech_analysis');
      }
    } else {
       if (activeMiniView !== 'ai_paper_trading') {
        setActiveMiniView('ai_chat');
      }
    }
  }, [activeView, activeMiniView]);

  const formatTradingViewSymbol = (kucoinSymbol: string): string => {
    if (!kucoinSymbol || kucoinSymbol.trim() === '') return '';
  
    let formattedSymbol = kucoinSymbol.toUpperCase().trim();
  
    if (formattedSymbol.includes(':')) {
      return formattedSymbol;
    }
  
    // For futures contracts, strip 'M' and let TradingView decide
    if (formattedSymbol.endsWith('M')) {
        return formattedSymbol.slice(0, -1);
    }
  
    // Handle special KCS spot pairs for TradingView
    if (formattedSymbol === 'ETH-KCS') {
      return 'KCSETH';
    } else if (formattedSymbol === 'BTC-KCS') {
      return 'KCSBTC';
    }
  
    // For standard spot symbols like 'BTC-USDT', format for KuCoin
    if (formattedSymbol.includes('-')) {
      formattedSymbol = formattedSymbol.replace('-', '');
      return `KUCOIN:${formattedSymbol}`;
    }
  
    // Fallback for any other case (like a direct symbol)
    return formattedSymbol;
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
            setAiAgentState={setAiAgentState}
            setActiveMiniView={setActiveMiniView}
            aiSettings={aiSettings}
            setAiSettings={setAiSettings}
            handleAiTriggerAnalysis={handleAiTriggerAnalysis}
            nextAiScrapeTime={nextAiScrapeTime}
          />
        </section>
        <aside className="flex flex-col lg:w-1/3 lg:border-l border-border min-h-[1000px] lg:min-h-0">
          <MiniWidgets
            currentSymbol={activeSymbol}
            onSymbolChange={handleSymbolChange}
            activeMiniView={activeMiniView}
            setActiveMiniView={setActiveMiniView}
            aiAgentState={aiAgentState}
            setAiAgentState={setAiAgentState}
          />
        </aside>
      </main>

      <footer className="p-4 border-t border-border text-center flex-shrink-0">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Cogmora Labs. All rights reserved. Market data provided by TradingView.
        </p>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <PaperTradingProvider>
      <PageContent />
    </PaperTradingProvider>
  );
}
