
'use client';
import type React from 'react';
// Removed useMemo as configs are now part of srcDoc for iframes
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Newspaper, LayoutDashboard, LineChart, Columns, ListFilter } from 'lucide-react';

import BlogContent from './BlogContent';
import DashboardContent from './DashboardContent';
import { TradingViewChartWidget } from './TradingViewChartWidget';
// TradingViewEmbedWidget is no longer used in this file

const MainViews: React.FC = () => {
  const WIDGET_CONTAINER_CLASS = "h-[calc(100vh-250px)] min-h-[500px] w-full";

  const heatmapConfigObject = {
    dataSource: "Crypto",
    blockSize: "market_cap_calc",
    blockColor: "change",
    locale: "en",
    symbolUrl: "",
    colorTheme: "dark",
    hasTransparentBackground: true, // Widget's own background transparency
    width: "100%",
    height: "100%"
  };

  const heatmapSrcDoc = `
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
          background-color: transparent; /* Allows parent background to show if iframe is transparent */
        }
        .tradingview-widget-container {
          width: 100%;
          height: 100%;
        }
      </style>
    </head>
    <body>
      <!-- TradingView Widget BEGIN -->
      <div class="tradingview-widget-container">
        <div class="tradingview-widget-container__widget"></div>
        <div class="tradingview-widget-copyright" style="width: 100%; text-align: center; font-size: 12px; position: absolute; bottom: 0; padding: 2px 0;">
            <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank" style="color: #828282; text-decoration: none;">
                <span class="blue-text">Track all markets on TradingView</span>
            </a>
        </div>
        <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js" async>
        ${JSON.stringify(heatmapConfigObject)}
        </script>
      </div>
      <!-- TradingView Widget END -->
    </body>
    </html>
  `;

  const screenerConfigObject = {
    width: "100%",
    height: "100%",
    defaultScreen: "crypto_mcap",
    theme: "dark",
    locale: "en",
    hasTransparentBackground: true, // Widget's own background transparency
  };

  const screenerSrcDoc = `
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
        }
         .tradingview-widget-container {
          width: 100%;
          height: 100%;
        }
      </style>
    </head>
    <body>
      <!-- TradingView Widget BEGIN -->
      <div class="tradingview-widget-container">
        <div class="tradingview-widget-container__widget"></div>
         <div class="tradingview-widget-copyright" style="width: 100%; text-align: center; font-size: 12px; position: absolute; bottom: 0; padding: 2px 0;">
            <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank" style="color: #828282; text-decoration: none;">
                <span class="blue-text">Track all markets on TradingView</span>
            </a>
        </div>
        <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-screener.js" async>
        ${JSON.stringify(screenerConfigObject)}
        </script>
      </div>
      <!-- TradingView Widget END -->
    </body>
    </html>
  `;

  return (
    <Tabs defaultValue="dashboard" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 mb-4">
        <TabsTrigger value="blog"><Newspaper className="mr-2" />Blog</TabsTrigger>
        <TabsTrigger value="dashboard"><LayoutDashboard className="mr-2" />Dashboard</TabsTrigger>
        <TabsTrigger value="chart"><LineChart className="mr-2" />Chart</TabsTrigger>
        <TabsTrigger value="heatmap"><Columns className="mr-2" />Heatmap</TabsTrigger>
        <TabsTrigger value="screener"><ListFilter className="mr-2" />Screener</TabsTrigger>
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
      <TabsContent value="screener" className="flex-grow overflow-hidden">
         <iframe
            srcDoc={screenerSrcDoc}
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
