
'use client';

import React, { useMemo, useState } from 'react';
import type { FC } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Newspaper, LayoutDashboard, LineChart, Columns, ListFilter, Settings2, SearchCode, Activity, BarChart3, TrendingUp } from 'lucide-react'; // Added Activity, BarChart3, TrendingUp

import BlogContent from './main-views/BlogContent';
import DashboardContent from './main-views/DashboardContent';
import DexScreenerContent from './main-views/DexScreenerContent';
import CryptoCoinsHeatmap from './main-views/heatmaps/CryptoCoinsHeatmap';
import StockHeatmap from './main-views/heatmaps/StockHeatmap';
import EtfHeatmap from './main-views/heatmaps/EtfHeatmap';
import ForexCrossRatesWidget from './main-views/heatmaps/ForexCrossRatesWidget';
import ForexHeatmapWidget from './main-views/heatmaps/ForexHeatmapWidget';
import ThreeChartAnalysisPanel from './main-views/ThreeChartAnalysisPanel';

interface MainViewsProps {
  currentSymbol: string;
}

const MainViews: React.FC<MainViewsProps> = ({ currentSymbol }) => {
  // Simplified WIDGET_CONTAINER_CLASS for iframes to fill their parent
  const WIDGET_CONTAINER_CLASS = "w-full h-full"; 
  // The min-h-[500px] and max-h will be handled by TabsContent or specific wrappers if needed

  const [selectedHeatmapView, setSelectedHeatmapView] = useState<string>('crypto_coins');
  const heatmapViewOptions = [
    { value: 'crypto_coins', label: 'Crypto Coins Heatmap' },
    { value: 'stock_market', label: 'Stock Market Heatmap' },
    { value: 'etf_heatmap', label: 'ETF Heatmap' },
    { value: 'forex_cross_rates', label: 'Forex Cross Rates' },
    { value: 'forex_heatmap', label: 'Forex Heatmap' },
  ];

  const [selectedChartLayout, setSelectedChartLayout] = useState<number>(1);
  const chartLayoutOptions = [
    { value: 1, label: '1 Chart', icon: <BarChart3 className="mr-2 h-4 w-4" /> },
    { value: 2, label: '2 Charts', icon: <LayoutDashboard className="mr-2 h-4 w-4" /> }, // Using LayoutDashboard for 2 charts
    { value: 3, label: '3 Charts + Analysis', icon: <TrendingUp className="mr-2 h-4 w-4" /> },
    { value: 4, label: '4 Charts', icon: <Columns className="mr-2 h-4 w-4" /> },
  ];

  const tvWidgetBaseStyle = useMemo(() => `
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #222222; 
      box-sizing: border-box;
      overflow: hidden; 
    }
    *, *::before, *::after { box-sizing: inherit; }
    .tradingview-widget-container { 
      width: 100%;
      height: 100%;
      position: relative;
    }
    .tradingview-widget-container__widget { 
      width: 100% !important;
      height: 100% !important;
      overflow: hidden;
    }
    ::-webkit-scrollbar { width: 12px; height: 12px; }
    ::-webkit-scrollbar-track { background: #2d3748; border-radius: 12px; }
    ::-webkit-scrollbar-thumb { background-color: #4a5568; border-radius: 12px; border: 3px solid #2d3748; }
    ::-webkit-scrollbar-thumb:hover { background-color: #718096; }
    .tradingview-widget-copyright {
      position:absolute; bottom:0; left:0; right:0; text-align:center; padding:2px 0; font-size:11px; color:#9db2bd; background-color:rgba(34,34,34,0.8); box-sizing:border-box; z-index:10;
    }
    .tradingview-widget-copyright a { color:#9db2bd; text-decoration: none; }
    .tradingview-widget-copyright a:hover { text-decoration: underline; }
  `, []);

  const baseChartConfig = {
    width: "100%",
    height: "100%", // Widgets inside grid cells should take 100% of cell
    autosize: true,
    interval: "180",
    timezone: "exchange",
    theme: "dark",
    style: "1",
    withdateranges: true,
    hide_side_toolbar: true,
    allow_symbol_change: true,
    save_image: false,
    studies: ["StochasticRSI@tv-basicstudies", "MASimple@tv-basicstudies"],
    show_popup_button: true,
    popup_width: "1000",
    popup_height: "650",
    support_host: "https://www.tradingview.com",
    locale: "en",
    enable_publishing: false,
  };

  const chartConfigObject1 = useMemo(() => ({
    ...baseChartConfig,
    container_id: "tradingview-chart-1",
    symbol: currentSymbol,
  }), [currentSymbol, baseChartConfig]); // baseChartConfig is stable due to useMemo

  const chartConfigObject2 = useMemo(() => ({
    ...baseChartConfig,
    container_id: "tradingview-chart-2",
    symbol: "BINANCE:ETHUSDT",
  }), [baseChartConfig]);

  const chartConfigObject3 = useMemo(() => ({
    ...baseChartConfig,
    container_id: "tradingview-chart-3",
    symbol: "BINANCE:XRPUSDT",
  }), [baseChartConfig]);

  const chartConfigObject4 = useMemo(() => ({
    ...baseChartConfig,
    container_id: "tradingview-chart-4",
    symbol: "BINANCE:SOLUSDT",
  }), [baseChartConfig]);
  
  const generateChartSrcDoc = (config: any) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>${tvWidgetBaseStyle}</style>
    </head>
    <body>
      <div class="tradingview-widget-container">
        <div id="${config.container_id}" style="width:100%; height:100%;"></div>
        <div class="tradingview-widget-copyright">
            <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span>Track all markets on TradingView</span></a>
        </div>
      </div>
      <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
      <script type="text/javascript">
        new TradingView.widget(${JSON.stringify(config)});
      </script>
    </body>
    </html>
  `;

  const chartSrcDoc1 = useMemo(() => generateChartSrcDoc(chartConfigObject1), [chartConfigObject1, tvWidgetBaseStyle]);
  const chartSrcDoc2 = useMemo(() => generateChartSrcDoc(chartConfigObject2), [chartConfigObject2, tvWidgetBaseStyle]);
  const chartSrcDoc3 = useMemo(() => generateChartSrcDoc(chartConfigObject3), [chartConfigObject3, tvWidgetBaseStyle]);
  const chartSrcDoc4 = useMemo(() => generateChartSrcDoc(chartConfigObject4), [chartConfigObject4, tvWidgetBaseStyle]);

  const screenerBaseStyle = useMemo(() => `
    ${tvWidgetBaseStyle} 
    html, body {
      overflow: auto !important; /* Allow scrolling for screeners */
    }
    ::-webkit-scrollbar { width: 24px !important; height: 24px !important; }
    ::-webkit-scrollbar-track { background: #1e222d; border-radius: 10px; }
    ::-webkit-scrollbar-thumb { background-color: #363a45; border-radius: 10px; border: 6px solid #1e222d; }
    ::-webkit-scrollbar-thumb:hover { background-color: #4f535d; }
    .tradingview-widget-container { padding-bottom: 20px; height: 100%; box-sizing: border-box; }
    .tradingview-widget-container__widget { height: 100% !important; width: 100% !important; overflow: hidden; }
  `, [tvWidgetBaseStyle]);

  const optionsScreenerConfigObject = useMemo(() => ({
    width: "100%",
    height: "100%",
    defaultColumn: "overview",
    screener_type: "stock", 
    displayCurrency: "USD",
    colorTheme: "dark",
    locale: "en",
    isTransparent: true,
  }), []);

  const optionsScreenerSrcDoc = useMemo(() => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>${screenerBaseStyle}</style>
    </head>
    <body>
      <div class="tradingview-widget-container">
        <div class="tradingview-widget-container__widget"></div>
         <div class="tradingview-widget-copyright">
            <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span>Track all markets on TradingView</span></a>
        </div>
        <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-screener.js" async>
          ${JSON.stringify(optionsScreenerConfigObject)}
        </script>
      </div>
    </body>
    </html>
  `, [optionsScreenerConfigObject, screenerBaseStyle]);

  const cryptoScreenerConfigObject = useMemo(() => ({
    width: "100%",
    height: "100%",
    defaultColumn: "overview",
    screener_type: "crypto_mkt",
    displayCurrency: "USD",
    colorTheme: "dark",
    locale: "en",
    isTransparent: true,
  }), []);

  const cryptoScreenerSrcDoc = useMemo(() => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>${screenerBaseStyle}</style>
    </head>
    <body>
      <div class="tradingview-widget-container">
        <div class="tradingview-widget-container__widget"></div>
        <div class="tradingview-widget-copyright">
            <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span>Track all markets on TradingView</span></a>
        </div>
        <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-screener.js" async>
          ${JSON.stringify(cryptoScreenerConfigObject)}
        </script>
      </div>
    </body>
    </html>
  `, [cryptoScreenerConfigObject, screenerBaseStyle]);

  const TABS_CONTENT_BASE_CLASS = "mt-0 flex-grow flex flex-col overflow-hidden min-h-0";
  const TABS_CONTENT_SCROLL_CLASS = "mt-0 flex-grow overflow-auto min-h-0"; // For Blog/Dashboard

  return (
    <Tabs defaultValue="dashboard" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 md:grid-cols-8"> {/* Adjusted for 8 tabs */}
        <TabsTrigger value="blog"><Newspaper className="mr-2" />Blog</TabsTrigger>
        <TabsTrigger value="dashboard"><LayoutDashboard className="mr-2" />Dashboard</TabsTrigger>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TabsTrigger value="chart" className="flex items-center data-[state=active]:text-foreground">
              <LineChart className="mr-2 h-4 w-4" />Chart
            </TabsTrigger>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {chartLayoutOptions.map(option => (
              <DropdownMenuItem key={option.value} onSelect={() => setSelectedChartLayout(option.value)} className="flex items-center">
                {option.icon}
                <span className="ml-2">{option.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TabsTrigger value="heatmap" className="flex items-center data-[state=active]:text-foreground">
              <Columns className="mr-2 h-4 w-4" />Heatmap
            </TabsTrigger>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {heatmapViewOptions.map(option => (
              <DropdownMenuItem key={option.value} onSelect={() => setSelectedHeatmapView(option.value)}>
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <TabsTrigger value="options_screener"><Settings2 className="mr-2" />Options</TabsTrigger>
        <TabsTrigger value="crypto_screener"><ListFilter className="mr-2" />Crypto</TabsTrigger>
        <TabsTrigger value="dex_screener"><SearchCode className="mr-2" />DEX</TabsTrigger>
        <TabsTrigger value="live_ops"><Activity className="mr-2" />Live Ops</TabsTrigger> {/* Assuming AllTickersScreener for Live Ops */}
      </TabsList>

      <TabsContent value="blog" className={TABS_CONTENT_SCROLL_CLASS}>
        <BlogContent />
      </TabsContent>

      <TabsContent value="dashboard" className={TABS_CONTENT_SCROLL_CLASS}>
        <DashboardContent />
      </TabsContent>

      <TabsContent value="chart" className={TABS_CONTENT_BASE_CLASS}>
        <div className={`grid w-full h-full ${
            selectedChartLayout === 1 ? 'grid-cols-1 grid-rows-1' :
            selectedChartLayout === 2 ? 'grid-cols-1 md:grid-cols-2 grid-rows-1 gap-0' :
            selectedChartLayout === 3 || selectedChartLayout === 4 ? 'grid-cols-1 md:grid-cols-2 grid-rows-2 gap-0' : ''
          }`}>
          {selectedChartLayout >= 1 && (
            <div className="w-full h-full overflow-hidden">
              <iframe
                key={`chart-iframe-1-${currentSymbol}`}
                srcDoc={chartSrcDoc1}
                title="TradingView Chart 1"
                className="w-full h-full"
                style={{ border: 'none' }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          )}
          {selectedChartLayout >= 2 && (
            <div className="w-full h-full overflow-hidden">
              <iframe
                key="chart-iframe-2"
                srcDoc={chartSrcDoc2}
                title="TradingView Chart 2"
                className="w-full h-full"
                style={{ border: 'none' }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          )}
          { (selectedChartLayout === 3 || selectedChartLayout === 4) && (
            <div className="w-full h-full overflow-hidden">
              <iframe
                key="chart-iframe-3"
                srcDoc={chartSrcDoc3}
                title="TradingView Chart 3"
                className="w-full h-full"
                style={{ border: 'none' }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          )}
          {selectedChartLayout === 3 && (
            <div className="w-full h-full overflow-hidden p-1"> {/* Added small padding for analysis panel */}
              <ThreeChartAnalysisPanel />
            </div>
          )}
          {selectedChartLayout === 4 && (
            <div className="w-full h-full overflow-hidden">
              <iframe
                key="chart-iframe-4"
                srcDoc={chartSrcDoc4}
                title="TradingView Chart 4"
                className="w-full h-full"
                style={{ border: 'none' }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="heatmap" className={TABS_CONTENT_BASE_CLASS}>
        <div className="w-full h-full"> {/* Wrapper for selected heatmap to fill space */}
          {selectedHeatmapView === 'crypto_coins' && <CryptoCoinsHeatmap tvWidgetBaseStyle={tvWidgetBaseStyle} WIDGET_CONTAINER_CLASS={WIDGET_CONTAINER_CLASS} />}
          {selectedHeatmapView === 'stock_market' && <StockHeatmap tvWidgetBaseStyle={tvWidgetBaseStyle} WIDGET_CONTAINER_CLASS={WIDGET_CONTAINER_CLASS} />}
          {selectedHeatmapView === 'etf_heatmap' && <EtfHeatmap tvWidgetBaseStyle={tvWidgetBaseStyle} WIDGET_CONTAINER_CLASS={WIDGET_CONTAINER_CLASS} />}
          {selectedHeatmapView === 'forex_cross_rates' && <ForexCrossRatesWidget tvWidgetBaseStyle={tvWidgetBaseStyle} WIDGET_CONTAINER_CLASS={WIDGET_CONTAINER_CLASS} />}
          {selectedHeatmapView === 'forex_heatmap' && <ForexHeatmapWidget tvWidgetBaseStyle={tvWidgetBaseStyle} WIDGET_CONTAINER_CLASS={WIDGET_CONTAINER_CLASS} />}
        </div>
      </TabsContent>

      <TabsContent value="options_screener" className={TABS_CONTENT_BASE_CLASS}>
        <div className="h-full w-full overflow-auto"> {/* This structure matches user's working example for screeners */}
            <iframe
              key="options-screener-iframe"
              srcDoc={optionsScreenerSrcDoc}
              title="TradingView Options/Stock Screener"
              className={WIDGET_CONTAINER_CLASS} // User's original class
              style={{ border: 'none', minHeight: '500px' }} // User's original style
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
        </div>
      </TabsContent>

      <TabsContent value="crypto_screener" className={TABS_CONTENT_BASE_CLASS}>
         <div className="h-full w-full overflow-auto">  {/* This structure matches user's working example for screeners */}
            <iframe
              key="crypto-screener-iframe"
              srcDoc={cryptoScreenerSrcDoc}
              title="TradingView Crypto Screener"
              className={WIDGET_CONTAINER_CLASS} // User's original class
              style={{ border: 'none', minHeight: '500px' }} // User's original style
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
        </div>
      </TabsContent>

      <TabsContent value="dex_screener" className={TABS_CONTENT_BASE_CLASS}>
        <DexScreenerContent /> {/* This component has its own h-full Card */}
      </TabsContent>
      
      <TabsContent value="live_ops" className={TABS_CONTENT_BASE_CLASS}>
        {/* Assuming AllTickersScreener is also designed with h-full Card */}
        {/* <AllTickersScreener /> */} {/* Placeholder if AllTickersScreener is ready */}
        <div className="p-4 text-center">Live Ops Dashboard Content (using AllTickersScreener)</div>
      </TabsContent>
    </Tabs>
  );
};

export default MainViews;

    