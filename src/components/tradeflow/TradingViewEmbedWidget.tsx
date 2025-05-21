
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
    if (!containerRef.current) return;

    const container = containerRef.current;
    let scriptElement: HTMLScriptElement | null = null;

    // Set loading to true when we start (re)creating the widget
    setIsLoading(true);

    // Clear previous content (including old script and widget elements)
    while (container.firstChild) {
      try {
        container.removeChild(container.firstChild);
      } catch (e) {
        // console.warn("Error removing child during embed widget cleanup (before new script):", e);
        break; // Avoid infinite loop on persistent error
      }
    }
    
    scriptElement = document.createElement('script');
    scriptElement.src = scriptSrc;
    scriptElement.type = 'text/javascript';
    scriptElement.async = true;
    scriptElement.innerHTML = JSON.stringify(config); // Config is embedded in the script's content for these types of widgets
    
    scriptElement.onload = () => setIsLoading(false);
    scriptElement.onerror = () => {
      setIsLoading(false); 
      console.error(`Failed to load TradingView widget script: ${scriptSrc}`);
    };
    
    container.appendChild(scriptElement);

    // Cleanup function for when the component unmounts or dependencies (scriptSrc, config) change
    return () => {
      // The script itself and its generated content are children of `container`.
      // Clearing all children of `container` should suffice.
      if (container) { 
        while (container.firstChild) {
          try {
            container.removeChild(container.firstChild);
          } catch (e) {
            // console.warn("Error removing child during embed widget cleanup (effect return):", e);
            break; // Avoid infinite loop
          }
        }
      }
      // If unmounting or re-rendering due to prop change, reset loading state
      // This helps ensure skeleton shows correctly if widget is recreated quickly
      setIsLoading(true); 
    };
  }, [scriptSrc, config]); // Re-run if scriptSrc or config changes

  return (
    <div className={`tradingview-widget-container ${containerClass}`} ref={containerRef}>
      {isLoading && <Skeleton className="w-full h-full" />}
      {/* The script will inject content here */}
    </div>
  );
};

export const TradingViewEmbedWidget = memo(TradingViewEmbedWidgetComponent);
