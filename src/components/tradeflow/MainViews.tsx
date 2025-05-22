'use client';

import React, { useMemo } from 'react';
import type { FC } from 'react'; // Keep type FC for clarity if preferred, though React.FC works with the above import
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Newspaper, LayoutDashboard, LineChart, Columns, ListFilter, Settings2 } from 'lucide-react';
import BlogContent from './BlogContent';
import DashboardContent from './DashboardContent';
import { TradingViewChartWidget } from './TradingViewChartWidget';

const MainViews: React.FC = () => {
  const WIDGET_CONTAINER_CLASS = "w-full h-full min-h-[500px] max-h-[calc(100vh-200px)] overflow-auto";

  const tvWidgetBaseStyle = `
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: transparent;
      box-sizing: border-box;
    }
    
    *, *::before, *::after {
      box-sizing: inherit;
    }
    
    .tradingview-widget-container {
      width: 100%;
      height: 100%;
      min-height: 500px; /* Ensure a minimum height for visibility */
      position: relative;
    }
    
    .tradingview-widget-container__widget {
      width: 100% !important;
      height: 100% !important;
      min-height: 500px; /* Ensure a minimum height for visibility */
    }
    
    /* Default scrollbar style for heatmap - can be overridden for screeners */
    ::-webkit-scrollbar {
      width: 12px;
      height: 12px;
    }
    
    ::-webkit-scrollbar-track {
      background: #2d3748; /* A dark track color */
      border-radius: 12px;
    }
    
    ::-webkit-scrollbar-thumb {
      background-color: #4a5568; /* A medium dark thumb color */
      border-radius: 12px;
      border: 3px solid #2d3748; /* Creates padding around thumb */
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background-color: #718096; /* Lighter thumb on hover */
    }
  `;

  const heatmapConfigObject = useMemo(() => ({
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
        ${tvWidgetBaseStyle}
        /* Heatmap specific styles if any, otherwise tvWidgetBaseStyle applies */
        html, body {
             overflow: hidden; /* Heatmap typically doesn't need its own scrollbars */
        }
      </style>
    </head>
    <body>
      <div class="tradingview-widget-container">
        <div class="tradingview-widget-container__widget"></div>
        <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js" async>
          ${JSON.stringify(heatmapConfigObject)}
        </script>
      </div>
    </body>
    </html>
  `, [heatmapConfigObject, tvWidgetBaseStyle]);


  const screenerBaseStyle = `
    ${tvWidgetBaseStyle} /* Inherit base styles */
    html, body {
      overflow: auto !important; /* Ensure iframe content can scroll */
    }
    /* Thicker scrollbars for screeners */
    ::-webkit-scrollbar {
      width: 24px !important;
      height: 24px !important;
    }
    ::-webkit-scrollbar-track {
      background: #1e222d; /* Slightly different track for screeners if needed */
      border-radius: 10px;
    }
    ::-webkit-scrollbar-thumb {
      background-color: #363a45; /* Thumb color for screeners */
      border-radius: 10px;
      border: 6px solid #1e222d; /* Creates padding around thumb */
    }
    ::-webkit-scrollbar-thumb:hover {
      background-color: #4f535d; /* Lighter thumb on hover */
    }
    .tradingview-widget-container { /* Ensure container has space for footer */
        padding-bottom: 20px; /* Space for copyright footer, adjust as needed */
        position: relative;
        height: 100%;
        box-sizing: border-box;
    }
    .tradingview-widget-container__widget { /* Widget should fill the container */
        height: 100% !important;
        width: 100% !important;
        overflow: hidden; /* Widget itself should not overflow this div */
    }
  `;


  const optionsScreenerConfigObject = useMemo(() => ({
    width: "100%",
    height: "100%",
    defaultColumn: "overview",
    screener_type: "stock", // For options/stock
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
    screener_type: "crypto_mkt", // For crypto
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
        <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-screener.js" async>
          ${JSON.stringify(cryptoScreenerConfigObject)}
        </script>
      </div>
    </body>
    </html>
  `, [cryptoScreenerConfigObject, screenerBaseStyle]);

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

      <TabsContent value="chart" className="flex-grow overflow-hidden" forceMount>
        <TradingViewChartWidget 
          symbol="BINANCE:BTCUSDT" 
          containerClass={WIDGET_CONTAINER_CLASS} 
        />
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
        <div className="h-full w-full overflow-auto"> {/* Ensure this div can scroll if iframe content is too large */}
          <iframe
            srcDoc={optionsScreenerSrcDoc}
            title="TradingView Options/Stock Screener"
            className={WIDGET_CONTAINER_CLASS}
            style={{ border: 'none', minHeight: '500px' }} // minHeight helps visibility
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </TabsContent>

      <TabsContent value="crypto_screener" className="flex-grow overflow-hidden">
         <div className="h-full w-full overflow-auto"> {/* Ensure this div can scroll if iframe content is too large */}
            <iframe
              srcDoc={cryptoScreenerSrcDoc}
              title="TradingView Crypto Screener"
              className={WIDGET_CONTAINER_CLASS}
              style={{ border: 'none', minHeight: '500px' }} // minHeight helps visibility
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default MainViews;
