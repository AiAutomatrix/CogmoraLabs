
'use client';

import React, { useMemo } from 'react';

interface StockHeatmapProps {
  tvWidgetBaseStyle: string;
  WIDGET_CONTAINER_CLASS: string;
}

const StockHeatmap: React.FC<StockHeatmapProps> = ({ tvWidgetBaseStyle, WIDGET_CONTAINER_CLASS }) => {
  const config = useMemo(() => ({
    "exchanges": [],
    "dataSource": "SPX500",
    "grouping": "sector",
    "blockSize": "market_cap_basic",
    "blockColor": "change",
    "locale": "en",
    "symbolUrl": "",
    "colorTheme": "dark",
    "hasTopBar": false,
    "isDataSetEnabled": false,
    "isZoomEnabled": true,
    "hasSymbolTooltip": true,
    "isMonoSize": false,
    "width": "100%",
    "height": "100%"
  }), []);

  const srcDoc = useMemo(() => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>${tvWidgetBaseStyle}</style>
    </head>
    <body>
      <div class="tradingview-widget-container" style="width:100%;height:100%;">
        <div class="tradingview-widget-container__widget" style="width:100%;height:100%;"></div>
        <div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a></div>
        <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js" async>
          ${JSON.stringify(config)}
        </script>
      </div>
    </body>
    </html>
  `, [config, tvWidgetBaseStyle]);

  return (
    <iframe
      key="stock-heatmap-iframe"
      srcDoc={srcDoc}
      title="TradingView Stock Heatmap"
      className={WIDGET_CONTAINER_CLASS}
      style={{ border: 'none' }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
};

export default StockHeatmap;
