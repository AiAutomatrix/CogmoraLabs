
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
    if (!isScriptLoaded || typeof window.TradingView === 'undefined') {
      return; // Script not ready or TradingView object not available
    }

    const chartHostElement = document.getElementById(containerId);
    if (!chartHostElement) {
      console.warn(`TradingViewChartWidget: Container with id ${containerId} not found.`);
      return;
    }

    // Ensure the target DOM element is completely empty before creating a new widget.
    while (chartHostElement.firstChild) {
      chartHostElement.removeChild(chartHostElement.firstChild);
    }
    
    let createdWidget: any = null;
    try {
      createdWidget = new window.TradingView.widget({
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
      widgetInstanceRef.current = createdWidget;
    } catch (e) {
      console.error("Error creating TradingView widget:", e);
      widgetInstanceRef.current = null;
    }

    return () => {
      const instanceToRemove = widgetInstanceRef.current;
      // Check if the host element for the widget still exists in the DOM.
      // React might have already unmounted and removed it.
      const currentChartHostElement = document.getElementById(containerId);

      if (instanceToRemove && typeof instanceToRemove.remove === 'function') {
        // Only attempt to remove if the container element is still part of the document
        if (currentChartHostElement && document.body.contains(currentChartHostElement)) {
          try {
            instanceToRemove.remove();
          } catch (error) {
            console.error("Error removing TradingView widget during cleanup:", error);
          }
        }
      }
      widgetInstanceRef.current = null;
    };
  }, [isScriptLoaded, symbol, containerId, width, height]);

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
