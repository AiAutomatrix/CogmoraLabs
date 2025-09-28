'use client';
import React, { useEffect, useRef, memo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface TradingViewTechAnalysisWidgetProps {
  symbol?: string;
}

const TradingViewTechAnalysisWidgetComponent: React.FC<TradingViewTechAnalysisWidgetProps> = ({
  symbol = "BINANCE:BTCUSDT",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) {
      return;
    }

    // Clean up any existing script to prevent duplicates
    if (scriptRef.current) {
      scriptRef.current.remove();
      scriptRef.current = null;
    }
    currentContainer.innerHTML = '';
    setIsLoading(true);

    const widgetConfig = {
      "interval": "1m",
      "width": "100%",
      "isTransparent": true,
      "height": "100%",
      "symbol": symbol,
      "showIntervalTabs": true,
      "locale": "en",
      "colorTheme": "dark"
    };

    const script = document.createElement('script');
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify(widgetConfig);

    script.onload = () => setIsLoading(false);
    script.onerror = () => {
      console.error("Failed to load TradingView Technical Analysis widget script.");
      setIsLoading(false);
    }
    
    currentContainer.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (scriptRef.current) {
        scriptRef.current.remove();
      }
       if (currentContainer) {
        currentContainer.innerHTML = '';
      }
    };
  }, [symbol]);

  return (
    <div className="tradingview-widget-container h-full w-full relative">
       {isLoading && <Skeleton className="absolute inset-0 w-full h-full" />}
      <div ref={containerRef} className="tradingview-widget-container__widget h-full w-full"></div>
       <div className="tradingview-widget-copyright absolute bottom-0 left-0 right-0 text-center p-1 bg-background/50 backdrop-blur-sm z-20">
          <a href={`https://www.tradingview.com/symbols/${symbol}/technicals/`} rel="noopener nofollow" target="_blank" className="text-xs text-muted-foreground hover:text-accent-foreground">
            Technical analysis for {symbol} by TradingView
          </a>
        </div>
    </div>
  );
};

const TradingViewTechAnalysisWidget = memo(TradingViewTechAnalysisWidgetComponent);

export default TradingViewTechAnalysisWidget;
