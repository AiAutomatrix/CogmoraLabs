
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
    const currentContainer = containerRef.current; 
    if (!currentContainer) return;

    setIsLoading(true);
    
    currentContainer.innerHTML = ''; // Clear previous content

    const scriptElement = document.createElement('script');
    scriptElement.src = scriptSrc;
    scriptElement.type = 'text/javascript';
    scriptElement.async = true;
    // Use script.text to set the content that the external script will read as its configuration
    scriptElement.text = JSON.stringify(config); 
    
    scriptElement.onload = () => setIsLoading(false);
    scriptElement.onerror = () => {
      setIsLoading(false); 
      console.error(`Failed to load TradingView widget script: ${scriptSrc}`);
    };
    
    currentContainer.appendChild(scriptElement);

    return () => {
      // Cleanup script and its potential DOM modifications
      if (currentContainer) {
        try {
          currentContainer.innerHTML = '';
        } catch (e) {
          // console.warn("Error clearing innerHTML during embed widget cleanup:", e);
        }
      }
    };
  }, [scriptSrc, config]); // Effect dependencies include config

  return (
    <div className={`tradingview-widget-container ${containerClass}`} ref={containerRef}>
      {isLoading && <Skeleton className="w-full h-full" />}
      {/* The script will inject content here */}
    </div>
  );
};

export const TradingViewEmbedWidget = memo(TradingViewEmbedWidgetComponent);
