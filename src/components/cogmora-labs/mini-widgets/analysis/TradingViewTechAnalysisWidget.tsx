'use client';
import React, { useMemo, memo } from 'react';

interface TradingViewTechAnalysisWidgetProps {
  symbol?: string;
}

const TradingViewTechAnalysisWidgetComponent: React.FC<TradingViewTechAnalysisWidgetProps> = ({
  symbol = "BINANCE:BTCUSDT",
}) => {
  const widgetSrcDoc = useMemo(() => {
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

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            html, body { 
              width: 100%; 
              height: 100%; 
              margin: 0; 
              padding: 0; 
              overflow: hidden; 
              background-color: transparent;
            }
            .tradingview-widget-container {
              height: calc(100% - 30px); /* Adjust height to leave space for copyright */
            }
          </style>
        </head>
        <body>
          <div class="tradingview-widget-container">
            <div class="tradingview-widget-container__widget"></div>
            <div class="tradingview-widget-copyright">
              <a href="https://www.tradingview.com/symbols/${symbol}/technicals/" rel="noopener nofollow" target="_blank">
                <span class="blue-text">Technical analysis for ${symbol} by TradingView</span>
              </a>
            </div>
          </div>
          <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js" async>
            ${JSON.stringify(widgetConfig)}
          </script>
        </body>
      </html>
    `;
  }, [symbol]);

  return (
    <iframe
      srcDoc={widgetSrcDoc}
      title={`Technical Analysis for ${symbol}`}
      className="w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
};

const TradingViewTechAnalysisWidget = memo(TradingViewTechAnalysisWidgetComponent);

export default TradingViewTechAnalysisWidget;
