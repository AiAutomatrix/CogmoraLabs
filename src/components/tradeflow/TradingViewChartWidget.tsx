
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
  height = "100%",
}) => {
  const containerId = useRef(`tradingview_chart_${Math.random().toString(36).substring(2, 9)}`).current;
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const widgetInstanceRef = useRef<any>(null);

  useEffect(() => {
    // This effect handles widget creation, updates, and cleanup.

    if (!isScriptLoaded || typeof window.TradingView === 'undefined') {
      // Script not loaded yet, or TradingView object not available.
      return;
    }

    const chartContainer = document.getElementById(containerId);
    if (!chartContainer) {
      console.warn(`TradingViewChartWidget: Container with id ${containerId} not found.`);
      return;
    }

    // If an old widget instance exists, remove it first.
    // This ensures that if props (like symbol) change, the old widget is cleaned up before creating a new one.
    if (widgetInstanceRef.current && typeof widgetInstanceRef.current.remove === 'function') {
      try {
        widgetInstanceRef.current.remove();
      } catch (e) {
        console.error("Error removing previous TradingView widget instance:", e);
      }
      widgetInstanceRef.current = null; // Clear the ref after removing
    } else if (widgetInstanceRef.current) {
      // Fallback if remove() is not available or instance is unexpected
      console.warn("TradingView widget instance found but no remove() method. Clearing container manually.");
      while (chartContainer.firstChild) {
        try {
          chartContainer.removeChild(chartContainer.firstChild);
        } catch (e) {
          // console.warn("Error during manual DOM cleanup fallback:", e);
          break; 
        }
      }
      widgetInstanceRef.current = null;
    } else {
      // If no widgetInstanceRef.current, but chartContainer might have stale content (e.g., from HMR)
      // This is a defensive clear.
      while (chartContainer.firstChild) {
        try {
          chartContainer.removeChild(chartContainer.firstChild);
        } catch (e) {
          // console.warn("Error during initial manual DOM cleanup:", e);
          break;
        }
      }
    }
    
    // Create the new widget
    try {
      widgetInstanceRef.current = new window.TradingView.widget({
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
        autosize: true,
      });
    } catch (e) {
      console.error("Error creating TradingView widget:", e);
      widgetInstanceRef.current = null; // Ensure ref is null if creation failed
    }

    // Cleanup function: This will be called when the component unmounts,
    // or BEFORE the effect runs again due to dependency changes.
    return () => {
      if (widgetInstanceRef.current && typeof widgetInstanceRef.current.remove === 'function') {
        try {
          widgetInstanceRef.current.remove();
        } catch (e) {
          // console.warn("Error removing TradingView widget during effect cleanup:", e);
        }
        widgetInstanceRef.current = null;
      }
    };
  }, [isScriptLoaded, symbol, containerId, width, height]); // Dependencies that require widget re-creation

  return (
    <>
      <Script
        id={TV_SCRIPT_ID}
        src="https://s3.tradingview.com/tv.js"
        strategy="lazyOnload"
        onLoad={() => setIsScriptLoaded(true)}
        onError={(e) => {
          console.error("TradingView tv.js script failed to load", e);
          setIsScriptLoaded(false);
        }}
      />
      <div className={`tradingview-widget-container relative ${containerClass}`}>
        {/* Show skeleton if script not loaded OR (script loaded but widget instance not yet created/ready) */}
        {(!isScriptLoaded || (isScriptLoaded && !widgetInstanceRef.current)) && (
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
