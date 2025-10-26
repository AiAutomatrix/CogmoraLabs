
'use client';

import MainViews from '@/components/cogmora-labs/main-views/MainViews';
import MiniWidgets from '@/components/cogmora-labs/mini-widgets/MiniWidgets';
import { PaperTradingProvider, usePaperTrading } from '@/context/PaperTradingContext';
import React, { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, LineChart, Columns, ListFilter, Settings2, SearchCode, NotebookPen, LogOut, User } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useUser, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { signOut } from 'firebase/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const PageContent: React.FC = () => {
  const [activeSymbol, setActiveSymbol] = useState<string>('KUCOIN:BTCUSDT');
  const [selectedCryptoScreener, setSelectedCryptoScreener] = useState('all_kucoin');
  const [activeView, setActiveView] = useState('paper_trading');
  const [activeMiniView, setActiveMiniView] = useState('ai_chat');
  const [selectedChartLayout, setSelectedChartLayout] = useState(1);
  const [selectedHeatmapView, setSelectedHeatmapView] = useState('crypto_coins');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  const { handleAiTriggerAnalysis, isLoaded } = usePaperTrading();

  const { toast } = useToast();

  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/');
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
    } catch (error) {
      console.error("Sign out error:", error);
      toast({ title: "Error", description: "Failed to sign out.", variant: "destructive" });
    }
  };


  // New state for multi-symbol selection
  const [numberOfChartsToSelect, setNumberOfChartsToSelect] = useState(1);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [multiChartSymbols, setMultiChartSymbols] = useState<string[]>([
    'KUCOIN:BTCUSDT',
    'BINANCE:ETHUSDT',
    'BINANCE:XRPUSDT',
    'BINANCE:SOLUSDT'
  ]);
  
  const runAiAnalysis = useCallback(async () => {
    setActiveMiniView('ai_paper_trading');
    await handleAiTriggerAnalysis();
  }, [handleAiTriggerAnalysis, setActiveMiniView]);


  useEffect(() => {
    if (activeView === 'chart') {
      setActiveMiniView('tech_analysis');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

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


  if (isUserLoading || !user || !isLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
           <p className="text-muted-foreground">Loading user session and portfolio...</p>
        </div>
      </div>
    );
  }

  const userInitials = user?.displayName?.split(' ').map(n => n[0]).join('') || user?.email?.charAt(0).toUpperCase() || 'U';


  return (
    <div className="flex flex-col bg-background h-full">
       <header className="border-b border-border shadow-md sticky top-0 bg-background z-50">
        <div className="container mx-auto flex items-center justify-between h-14">
          {/* Desktop Header */}
          <div className="hidden lg:flex items-center gap-4">
            <h1 className="text-xl font-bold cursor-pointer" onClick={() => handleViewChange('paper_trading')}>
              Cogmora Labs
            </h1>
          </div>
           {/* Mobile Header */}
           <div className="flex items-center justify-between w-full lg:hidden">
              <h1 className="text-xl font-bold cursor-pointer" onClick={() => handleViewChange('paper_trading')}>
                Cogmora Labs
              </h1>
            <div>
              <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Open navigation menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 p-0 flex flex-col">
                    <SheetHeader className="p-4 border-b">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'User'} />
                              <AvatarFallback>{userInitials}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <p className="text-sm font-medium leading-none">{user?.displayName || 'User'}</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                {user?.email || (user?.isAnonymous ? 'Anonymous User' : '')}
                                </p>
                            </div>
                        </div>
                    </SheetHeader>
                    <div className="overflow-y-auto p-4 flex-grow">
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
                    <div className="p-4 border-t mt-auto">
                         <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Sign Out
                        </Button>
                    </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          {/* Desktop User Menu */}
          <div className="hidden lg:flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.displayName || 'User'}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email || (user?.isAnonymous ? 'Anonymous User' : '')}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            handleAiTriggerAnalysis={runAiAnalysis}
          />
        </section>
        <aside className="flex flex-col lg:w-1/3 lg:border-l border-border min-h-[1000px] lg:min-h-0">
          <MiniWidgets
            currentSymbol={activeSymbol}
            onSymbolChange={handleSymbolChange}
            activeMiniView={activeMiniView}
            setActiveMiniView={setActiveMiniView}
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
    <FirebaseClientProvider>
      <PaperTradingProvider>
        <PageContent />
      </PaperTradingProvider>
    </FirebaseClientProvider>
  );
}
