
'use client';
import type React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Newspaper, LayoutDashboard, LineChart, Columns, ListFilter } from 'lucide-react';

import BlogContent from './BlogContent';
import DashboardContent from './DashboardContent';
import { TradingViewChartWidget } from './TradingViewChartWidget';
import { TradingViewEmbedWidget } from './TradingViewEmbedWidget';

const MainViews: React.FC = () => {
  const heatmapConfig = {
    dataSource: "Crypto",
    blockSize: "market_cap_calc",
    blockColor: "change",
    locale: "en",
    symbolUrl: "",
    colorTheme: "dark",
    hasTransparentBackground: true, // Set to true for better integration
    width: "100%",
    height: "100%" // This will be controlled by parent container
  };

  const screenerConfig = {
    width: "100%",
    height: "100%", // This will be controlled by parent container
    defaultScreen: "crypto_mcap",
    theme: "dark",
    locale: "en",
    hasTransparentBackground: true,
  };

  const WIDGET_CONTAINER_CLASS = "h-[calc(100vh-250px)] min-h-[500px] w-full"; // Adjusted height

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
        <TradingViewEmbedWidget 
          scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js"
          config={heatmapConfig}
          containerClass={WIDGET_CONTAINER_CLASS}
        />
      </TabsContent>
      <TabsContent value="screener" className="flex-grow overflow-hidden">
         <TradingViewEmbedWidget
            scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-screener.js"
            config={screenerConfig}
            containerClass={WIDGET_CONTAINER_CLASS}
          />
      </TabsContent>
    </Tabs>
  );
};

export default MainViews;
