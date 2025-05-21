'use client';
import React, { useEffect, useRef, memo, useState } from 'react';
import Script from 'next/script';
import { Skeleton } from '@/components/ui/skeleton';

declare global {
  interface Window {
    TradingView: any;
  }
}

interface TradingViewChartWidgetProps {
  symbol?: string;
  containerClass?: string;
  width?: string | number;
  height?: string | number;
}

const TV_SCRIPT_ID = 'tradingview-tv-script';

const TradingViewChartWidgetComponent: React.FC<TradingViewChartWidgetProps> = ({
  symbol = "BINANCE:BTCUSDT",
  containerClass = "h-[600px] w-full",
  width = "100%",
  height = "100%", // Will be relative to containerClass height
}) => {
  const containerId = useRef(`tradingview_chart_${Math.random().toString(36).substring(2, 9)}`).current;
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const widgetCreatedRef = useRef(false);

  useEffect(() => {
    if (isScriptLoaded && typeof window.TradingView !== 'undefined' && !widgetCreatedRef.current) {
      const chartContainer = document.getElementById(containerId);
      if (!chartContainer) {
        console.warn(`TradingViewChartWidget: Container with id ${containerId} not found.`);
        return;
      }
      // Clear previous widget if any (for HMR or prop changes)
      while (chartContainer.firstChild) {
        chartContainer.removeChild(chartContainer.firstChild);
      }

      new window.TradingView.widget({
        width: width,
        height: height,
        symbol: symbol,
        interval: "D",
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        enable_publishing: false,
        allow_symbol_change: true,
        container_id: containerId,
        autosize: true, // Make widget responsive
      });
      widgetCreatedRef.current = true;
    }
  }, [isScriptLoaded, symbol, width, height, containerId]);
  
  useEffect(() => {
    // Reset widgetCreatedRef if symbol changes to allow re-initialization
    widgetCreatedRef.current = false;
  }, [symbol]);


  return (
    <>
      <Script
        id={TV_SCRIPT_ID}
        src="https://s3.tradingview.com/tv.js"
        strategy="lazyOnload"
        onLoad={() => setIsScriptLoaded(true)}
        onError={(e) => {
          console.error("TradingView tv.js script failed to load", e);
          setIsScriptLoaded(false); // Or handle error state
        }}
      />
      <div className={`tradingview-widget-container relative ${containerClass}`}>
        {(!isScriptLoaded || !widgetCreatedRef.current) && (
             <Skeleton className="absolute inset-0 w-full h-full z-0" />
        )}
        <div id={containerId} className="w-full h-full z-10" />
        <div className="tradingview-widget-copyright absolute bottom-0 left-0 right-0 text-center p-1 bg-background/50 backdrop-blur-sm z-20">
          <a href="https://www.tradingview.com/" rel="noopener noreferrer" target="_blank" className="text-xs text-muted-foreground hover:text-accent-foreground">
            Track all markets on TradingView
          </a>
        </div>
      </div>
    </>
  );
};
export const TradingViewChartWidget = memo(TradingViewChartWidgetComponent);
