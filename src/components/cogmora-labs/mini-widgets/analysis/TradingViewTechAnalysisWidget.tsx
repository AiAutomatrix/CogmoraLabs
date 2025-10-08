
'use client';

import React, { useMemo } from 'react';

interface TradingViewTechAnalysisWidgetProps {
  symbol?: string;
}

const TradingViewTechAnalysisWidget: React.FC<TradingViewTechAnalysisWidgetProps> = ({
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
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              overflow: hidden;
              background-color: transparent;
            }
            .tradingview-widget-container, .tradingview-widget-container__widget {
              width: 100%;
              height: 100%;
            }
            .tradingview-widget-copyright {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <div class="tradingview-widget-container">
            <div class="tradingview-widget-container__widget"></div>
            <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js" async>
              ${JSON.stringify(widgetConfig)}
            </script>
          </div>
        </body>
      </html>
    `;
  }, [symbol]);

  return (
    <div className="h-full w-full">
      <iframe
        title={`Technical Analysis for ${symbol}`}
        srcDoc={widgetSrcDoc}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
};

export default TradingViewTechAnalysisWidget;
