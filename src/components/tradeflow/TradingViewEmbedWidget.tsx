
'use client';
import React, { useEffect, useRef, memo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface TradingViewEmbedWidgetProps {
  scriptSrc: string;
  config: object;
  containerClass?: string;
}

const TradingViewEmbedWidgetComponent: React.FC<TradingViewEmbedWidgetProps> = ({ scriptSrc, config, containerClass = "h-[600px] w-full" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const currentContainer = containerRef.current; // Capture ref value
    if (!currentContainer) return;

    // Always set loading to true when the effect runs (either mount or config change)
    setIsLoading(true);
    
    // Clear previous content before adding new script
    // This is important if the effect re-runs due to config changes.
    currentContainer.innerHTML = '';

    const scriptElement = document.createElement('script');
    scriptElement.src = scriptSrc;
    scriptElement.type = 'text/javascript';
    scriptElement.async = true;
    scriptElement.innerHTML = JSON.stringify(config);
    
    scriptElement.onload = () => setIsLoading(false);
    scriptElement.onerror = () => {
      setIsLoading(false); 
      console.error(`Failed to load TradingView widget script: ${scriptSrc}`);
    };
    
    currentContainer.appendChild(scriptElement);

    return () => {
      // When component unmounts or dependencies change, clear the container.
      // This should remove the script and anything it rendered inside.
      if (currentContainer) {
        try {
          currentContainer.innerHTML = '';
        } catch (e) {
          // console.warn("Error clearing innerHTML during embed widget cleanup:", e);
        }
      }
      // No need to setIsLoading(true) here in cleanup if component is unmounting.
      // If dependencies change, setIsLoading(true) at the start of the effect handles it.
    };
  }, [scriptSrc, config]); // Effect dependencies

  return (
    <div className={`tradingview-widget-container ${containerClass}`} ref={containerRef}>
      {isLoading && <Skeleton className="w-full h-full" />}
      {/* The script will inject content here */}
    </div>
  );
};

export const TradingViewEmbedWidget = memo(TradingViewEmbedWidgetComponent);
