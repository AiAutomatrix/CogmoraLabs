
'use client';

import React, { useMemo } from 'react';

interface CryptoCoinsHeatmapProps {
  tvWidgetBaseStyle: string;
  WIDGET_CONTAINER_CLASS: string;
}

const CryptoCoinsHeatmap: React.FC<CryptoCoinsHeatmapProps> = ({ tvWidgetBaseStyle, WIDGET_CONTAINER_CLASS }) => {
  const heatmapConfigObject = useMemo(() => ({
    dataSource: "Crypto",
    blockSize: "market_cap_calc",
    blockColor: "change",
    locale: "en",
    symbolUrl: "",
    colorTheme: "dark",
    hasTransparentBackground: true,
    width: "100%",
    height: "100%"
  }), []);

  const heatmapSrcDoc = useMemo(() => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>${tvWidgetBaseStyle}</style>
    </head>
    <body>
      <div class="tradingview-widget-container">
        <div class="tradingview-widget-container__widget"></div>
         <div class="tradingview-widget-copyright">
            <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a>
        </div>
        <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js" async>
          ${JSON.stringify(heatmapConfigObject)}
        </script>
      </div>
    </body>
    </html>
  `, [heatmapConfigObject, tvWidgetBaseStyle]);

  return (
    <iframe
      key="crypto-coins-heatmap-iframe"
      srcDoc={heatmapSrcDoc}
      title="TradingView Crypto Coins Heatmap"
      className={WIDGET_CONTAINER_CLASS}
      style={{ border: 'none' }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
};

export default CryptoCoinsHeatmap;
