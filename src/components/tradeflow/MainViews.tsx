
'use client';
import type React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Newspaper, LayoutDashboard, LineChart, Columns, ListFilter, Settings2 } from 'lucide-react';

import BlogContent from './BlogContent';
import DashboardContent from './DashboardContent';
import { TradingViewChartWidget } from './TradingViewChartWidget';
import { useMemo } from 'react'; // Import useMemo

const MainViews: React.FC = () => {
  const WIDGET_CONTAINER_CLASS = "h-full min-h-[500px] w-full"; 

  const heatmapConfigObject = useMemo(() => ({ // Memoize config
    dataSource: "Crypto",
    blockSize: "market_cap_calc",
    blockColor: "change",
    locale: "en",
    symbolUrl: "",
    colorTheme: "dark",
    hasTransparentBackground: true,
    width: "100%",
    height: "100%"
  }), []);

  const heatmapSrcDoc = useMemo(() => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        html, body { 
          width: 100%; 
          height: 100%; 
          margin: 0; 
          padding: 0; 
          overflow: hidden; 
          background-color: transparent; 
          box-sizing: border-box;
        }
        .tradingview-widget-container, .tradingview-widget-container__widget {
          width: 100%;
          height: 100%;
          overflow: hidden;
          box-sizing: border-box;
        }
        .tradingview-widget-container {
          position: relative; 
        }
        .tradingview-widget-copyright {
            width: 100%; 
            text-align: center; 
            font-size: 12px; 
            position: absolute; 
            bottom: 0; 
            padding: 2px 0; 
            box-sizing: border-box;
            color: #828282; 
        }
        .tradingview-widget-copyright a {
            color: #828282;
            text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="tradingview-widget-container">
        <div class="tradingview-widget-container__widget"></div>
        <div class="tradingview-widget-copyright">
            <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">
                <span class="blue-text">Track all markets on TradingView</span>
            </a>
        </div>
        <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js" async>
        ${JSON.stringify(heatmapConfigObject)}
        </script>
      </div>
    </body>
    </html>
  `, [heatmapConfigObject]);

  const cryptoScreenerConfigObject = useMemo(() => ({ // Memoize config
    width: "100%",
    height: "100%",
    defaultColumn: "overview",
    screener_type: "crypto_mkt",
    displayCurrency: "USD",
    colorTheme: "dark",
    locale: "en",
    hasTransparentBackground: true,
  }), []);

  const cryptoScreenerSrcDoc = useMemo(() => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        html, body { 
          width: 100%; 
          height: 100%; 
          margin: 0; 
          padding: 0; 
          overflow: hidden; 
          background-color: transparent; 
          box-sizing: border-box; /* Added */
        }
        .tradingview-widget-container, .tradingview-widget-container__widget {
          width: 100%;
          height: 100%;
          overflow: hidden;
          box-sizing: border-box; /* Added */
        }
        .tradingview-widget-container {
          position: relative; 
        }
         .tradingview-widget-copyright {
            width: 100%; 
            text-align: center; 
            font-size: 12px; 
            position: absolute; 
            bottom: 0; 
            padding: 2px 0; 
            box-sizing: border-box;
            color: #828282;
        }
        .tradingview-widget-copyright a {
            color: #828282;
            text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="tradingview-widget-container">
        <div class="tradingview-widget-container__widget"></div>
         <div class="tradingview-widget-copyright">
            <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">
                <span class="blue-text">Track all markets on TradingView</span>
            </a>
        </div>
        <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-screener.js" async>
        ${JSON.stringify(cryptoScreenerConfigObject)}
        </script>
      </div>
    </body>
    </html>
  `, [cryptoScreenerConfigObject]);

  const optionsScreenerConfigObject = useMemo(() => ({ // Memoize config
    width: "100%",
    height: "100%",
    defaultColumn: "overview",
    screener_type: "stock", 
    displayCurrency: "USD",
    colorTheme: "dark",
    locale: "en",
    hasTransparentBackground: true,
  }), []);

  const optionsScreenerSrcDoc = useMemo(() => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        html, body { 
          width: 100%; 
          height: 100%; 
          margin: 0; 
          padding: 0; 
          overflow: hidden; 
          background-color: transparent; 
          box-sizing: border-box; /* Added */
        }
        .tradingview-widget-container, .tradingview-widget-container__widget {
          width: 100%;
          height: 100%;
          overflow: hidden;
          box-sizing: border-box; /* Added */
        }
        .tradingview-widget-container {
          position: relative; 
        }
         .tradingview-widget-copyright {
            width: 100%; 
            text-align: center; 
            font-size: 12px; 
            position: absolute; 
            bottom: 0; 
            padding: 2px 0; 
            box-sizing: border-box;
            color: #828282;
        }
        .tradingview-widget-copyright a {
            color: #828282;
            text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="tradingview-widget-container">
        <div class="tradingview-widget-container__widget"></div>
         <div class="tradingview-widget-copyright">
            <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">
                <span class="blue-text">Track all markets on TradingView</span>
            </a>
        </div>
        <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-screener.js" async>
        ${JSON.stringify(optionsScreenerConfigObject)}
        </script>
      </div>
    </body>
    </html>
  `, [optionsScreenerConfigObject]);


  return (
    <Tabs defaultValue="dashboard" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6 mb-4">
        <TabsTrigger value="blog"><Newspaper className="mr-2" />Blog</TabsTrigger>
        <TabsTrigger value="dashboard"><LayoutDashboard className="mr-2" />Dashboard</TabsTrigger>
        <TabsTrigger value="chart"><LineChart className="mr-2" />Chart</TabsTrigger>
        <TabsTrigger value="heatmap"><Columns className="mr-2" />Heatmap</TabsTrigger>
        <TabsTrigger value="options_screener"><Settings2 className="mr-2" />Options</TabsTrigger>
        <TabsTrigger value="crypto_screener"><ListFilter className="mr-2" />Crypto</TabsTrigger>
      </TabsList>
      <TabsContent value="blog" className="flex-grow overflow-auto">
        <BlogContent />
      </TabsContent>
      <TabsContent value="dashboard" className="flex-grow overflow-auto">
        <DashboardContent />
      </TabsContent>
      <TabsContent value="chart" className="flex-grow overflow-hidden">
        <TradingViewChartWidget symbol="BINANCE:BTCUSDT" containerClass={WIDGET_CONTAINER_CLASS} />
      </TabsContent>
      <TabsContent value="heatmap" className="flex-grow overflow-hidden">
        <iframe
          srcDoc={heatmapSrcDoc}
          title="TradingView Crypto Heatmap"
          className={WIDGET_CONTAINER_CLASS}
          style={{ border: 'none' }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </TabsContent>
      <TabsContent value="options_screener" className="flex-grow overflow-hidden">
         <iframe
            srcDoc={optionsScreenerSrcDoc}
            title="TradingView Options/Stock Screener"
            className={WIDGET_CONTAINER_CLASS}
            style={{ border: 'none' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
      </TabsContent>
      <TabsContent value="crypto_screener" className="flex-grow overflow-hidden">
         <iframe
            srcDoc={cryptoScreenerSrcDoc}
            title="TradingView Crypto Screener"
            className={WIDGET_CONTAINER_CLASS}
            style={{ border: 'none' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
      </TabsContent>
    </Tabs>
  );
};

export default MainViews;

