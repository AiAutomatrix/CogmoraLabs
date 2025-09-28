
'use client';

import React, { useMemo } from 'react';

interface ForexCrossRatesWidgetProps {
  tvWidgetBaseStyle: string; // Assuming this style will be compatible
  WIDGET_CONTAINER_CLASS: string;
}

const ForexCrossRatesWidget: React.FC<ForexCrossRatesWidgetProps> = ({ tvWidgetBaseStyle, WIDGET_CONTAINER_CLASS }) => {
  const config = useMemo(() => ({
    "width": "100%", // Changed from fixed
    "height": "100%", // Changed from fixed
    "currencies": [
      "EUR",
      "USD",
      "JPY",
      "GBP",
      "CHF",
      "AUD",
      "CAD",
      "NZD"
    ],
    "isTransparent": false, // If tvWidgetBaseStyle sets a background, this might be fine
    "colorTheme": "dark",
    "locale": "en",
    "backgroundColor": "#222222" // Match tvWidgetBaseStyle background
  }), []);

  const srcDoc = useMemo(() => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        ${tvWidgetBaseStyle}
        /* Specific overrides if needed for this widget */
      </style>
    </head>
    <body>
      <div class="tradingview-widget-container" style="width:100%;height:100%;">
        <div class="tradingview-widget-container__widget" style="width:100%;height:100%;"></div>
        <div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a></div>
        <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-forex-cross-rates.js" async>
          ${JSON.stringify(config)}
        </script>
      </div>
    </body>
    </html>
  `, [config, tvWidgetBaseStyle]);

  return (
    <iframe
      key="forex-cross-rates-iframe"
      srcDoc={srcDoc}
      title="TradingView Forex Cross Rates"
      className={WIDGET_CONTAINER_CLASS}
      style={{ border: 'none' }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
};

export default ForexCrossRatesWidget;
