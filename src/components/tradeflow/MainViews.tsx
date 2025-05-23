
'use client';

import React, { useMemo } from 'react';
import type { FC } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Newspaper, LayoutDashboard, LineChart, Columns, ListFilter, Settings2 } from 'lucide-react';
import BlogContent from './main-views/BlogContent';
import DashboardContent from './main-views/DashboardContent';

const MainViews: FC = () => {
  const WIDGET_CONTAINER_CLASS = "w-full h-full"; 

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
    .tradingview-widget-copyright {
      position:absolute; bottom:0; left:0; right:0; text-align:center; padding:2px 0; font-size:11px; color:#9db2bd; background-color:rgba(34,34,34,0.8); box-sizing:border-box; z-index:10;
    }
    .tradingview-widget-copyright a { color:#9db2bd; text-decoration: none; }
    .tradingview-widget-copyright a:hover { text-decoration: underline; }
  `, []);

  const chartConfigObject = useMemo(() => ({
    container_id: "technical-analysis-chart-demo", 
    width: "100%",
    height: "97%", 
    autosize: true, 
    symbol: "BINANCE:BTCUSDT", 
    interval: "180", 
    timezone: "exchange", 
    theme: "dark",
    style: "1",
    withdateranges: true, 
    hide_side_toolbar: true, 
    allow_symbol_change: true,
    save_image: false,
    studies: [ 
        "StochasticRSI@tv-basicstudies",
        "MASimple@tv-basicstudies"
    ],
    show_popup_button: true, 
    popup_width: "1000", 
    popup_height: "650", 
    support_host: "https://www.tradingview.com", 
    locale: "en",
    enable_publishing: false, 
  }), []);

  const chartSrcDoc = useMemo(() => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>${tvWidgetBaseStyle}</style>
    </head>
    <body>
      <div class="tradingview-widget-container">
        <div id="${chartConfigObject.container_id}" style="width:100%; height:100%;"></div>
        <div class="tradingview-widget-copyright">
            <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span>Track all markets on TradingView</span></a>
        </div>
      </div>
      <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
      <script type="text/javascript">
        new TradingView.widget(${JSON.stringify(chartConfigObject)});
      </script>
    </body>
    </html>
  `, [chartConfigObject, tvWidgetBaseStyle]);

  const heatmapConfigObject = useMemo(() => ({
    dataSource: "Crypto",
    blockSize: "market_cap_calc",
    blockColor: "change",
    locale: "en",
    symbolUrl: "",
    colorTheme: "dark",
    hasTransparentBackground: false, // Changed from true for consistency with #222222 bg
    width: "100%",
    height: "100%"
  }), []);

  const heatmapSrcDoc = useMemo(() => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>${tvWidgetBaseStyle}</style>
    </head>
    <body>
      <div class="tradingview-widget-container">
        <div class="tradingview-widget-container__widget"></div>
         <div class="tradingview-widget-copyright">
            <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span>Track all markets on TradingView</span></a>
        </div>
        <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js" async>
          ${JSON.stringify(heatmapConfigObject)}
        </script>
      </div>
    </body>
    </html>
  `, [heatmapConfigObject, tvWidgetBaseStyle]);

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
    isTransparent: false, // Changed from true
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
    isTransparent: false, // Changed from true
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

  return (
    <Tabs defaultValue="dashboard" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
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
        <iframe
          key="adv-chart-iframe"
          srcDoc={chartSrcDoc}
          title="TradingView Advanced Chart"
          className={WIDGET_CONTAINER_CLASS}
          style={{ border: 'none' }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </TabsContent>

      <TabsContent value="heatmap" className="flex-grow overflow-hidden">
        <iframe
          key="heatmap-iframe"
          srcDoc={heatmapSrcDoc}
          title="TradingView Crypto Heatmap"
          className={WIDGET_CONTAINER_CLASS}
          style={{ border: 'none' }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </TabsContent>

      <TabsContent value="options_screener" className="flex-grow overflow-hidden">
         <iframe
            key="options-screener-iframe"
            srcDoc={optionsScreenerSrcDoc}
            title="TradingView Options/Stock Screener"
            className={WIDGET_CONTAINER_CLASS}
            style={{ border: 'none' }} 
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
      </TabsContent>

      <TabsContent value="crypto_screener" className="flex-grow overflow-hidden">
          <iframe
            key="crypto-screener-iframe"
            srcDoc={cryptoScreenerSrcDoc}
            title="TradingView Crypto Screener"
            className={WIDGET_CONTAINER_CLASS}
            style={{ border: 'none'}}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
      </TabsContent>
    </Tabs>
  );
};

export default MainViews;
