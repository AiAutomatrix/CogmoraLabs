
'use client';

import React, { useMemo } from 'react';

const TradingViewTechAnalysisWidget: React.FC = () => {
  const widgetConfig = useMemo(() => ({
    interval: "30m",
    width: "100%",
    isTransparent: false,
    height: "100%",
    symbol: "KUCOIN:BTCUSDT",
    showIntervalTabs: false,
    displayMode: "multiple",
    locale: "en",
    colorTheme: "dark"
  }), []);

  const srcDocContent = useMemo(() => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TradingView Technical Analysis</title>
      <style>
        html, body {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
          background-color: #222222; /* Match app's dark background */
          box-sizing: border-box;
        }
        *, *::before, *::after { box-sizing: inherit; }
        .tradingview-widget-container {
          width: 100%;
          height: 100%;
        }
        .tradingview-widget-container__widget {
            width: 100% !important; 
            height: 100% !important;
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
  `, [widgetConfig]);

  return (
    <iframe
      srcDoc={srcDocContent}
      title="TradingView Technical Analysis Widget"
      className="w-full h-full"
      style={{ border: 'none' }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
};

export default TradingViewTechAnalysisWidget;
