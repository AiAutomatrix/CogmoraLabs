'use client';
import React, { useEffect, useRef, memo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface TradingViewEmbedWidgetProps {
  scriptSrc: string;
  config: object;
  containerClass?: string;
}

const TradingViewEmbedWidgetComponent: React.FC<TradingViewEmbedWidgetProps> = ({ scriptSrc, config, containerClass = "h-[600px] w-full" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptAddedRef = useRef(false);
  const [isLoading, setIsLoading] = React.useState(true);

  useEffect(() => {
    if (!containerRef.current || scriptAddedRef.current) return;

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify(config);
    
    script.onload = () => setIsLoading(false);
    script.onerror = () => {
      setIsLoading(false); // Stop loading on error too
      console.error(`Failed to load TradingView widget script: ${scriptSrc}`);
    }

    // Clear previous content if any, for hot reloads or dynamic changes
    while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
    }
    
    containerRef.current.appendChild(script);
    scriptAddedRef.current = true; // Mark script as added

    // The script itself will create necessary child elements like .tradingview-widget-container__widget
    // and the copyright notice.

  }, [scriptSrc, config]); // Re-run if scriptSrc or config changes

  return (
    <div className={`tradingview-widget-container ${containerClass}`} ref={containerRef}>
      {isLoading && <Skeleton className="w-full h-full" />}
      {/* The script will inject content here. The structure it creates often includes
          a .tradingview-widget-container__widget and a copyright div.
          We provide the outer container. */}
    </div>
  );
};

export const TradingViewEmbedWidget = memo(TradingViewEmbedWidgetComponent);
