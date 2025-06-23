
'use client';

import React, { useMemo, useState } from 'react';
import type { FC } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LineChart, Columns, ListFilter, Settings2, SearchCode } from 'lucide-react';
import DexScreenerContent from './main-views/DexScreenerContent';
import ThreeChartAnalysisPanel from './main-views/ThreeChartAnalysisPanel';

// Import individual heatmap components
import CryptoCoinsHeatmap from './main-views/heatmaps/CryptoCoinsHeatmap';
import StockHeatmap from './main-views/heatmaps/StockHeatmap';
import EtfHeatmap from './main-views/heatmaps/EtfHeatmap';
import ForexCrossRatesWidget from './main-views/heatmaps/ForexCrossRatesWidget';
import ForexHeatmapWidget from './main-views/heatmaps/ForexHeatmapWidget';

interface MainViewsProps {
  currentSymbol: string;
}

const MainViews: FC<MainViewsProps> = ({ currentSymbol }) => {
  const WIDGET_CONTAINER_CLASS = "w-full h-full";
  const TABS_CONTENT_CLASS = "mt-0 flex-grow flex flex-col overflow-hidden min-h-0";

  // Heatmap state
  const [selectedHeatmapView, setSelectedHeatmapView] = useState('crypto_coins');
  const heatmapViewOptions = [
    { value: 'crypto_coins', label: 'Crypto Coins Heatmap' },
    { value: 'stock_market', label: 'Stock Market Heatmap' },
    { value: 'etf_heatmap', label: 'ETF Heatmap' },
    { value: 'forex_cross_rates', label: 'Forex Cross Rates' },
    { value: 'forex_heatmap', label: 'Forex Heatmap' },
  ];

  // Chart layout state
  const [selectedChartLayout, setSelectedChartLayout] = useState(1);
  const chartLayoutOptions = [
    { value: 1, label: '1 Chart' },
    { value: 2, label: '2 Charts' },
    { value: 3, label: '3 Charts + Analysis' },
    { value: 4, label: '4 Charts' },
  ];

  // TradingView base styles
  const tvWidgetBaseStyle = useMemo(() => `
    html, body { width:100%; height:100%; margin:0; padding:0; background-color:#222; box-sizing:border-box; overflow:hidden; }
    *, *::before, *::after { box-sizing:inherit; }
    .tradingview-widget-container, .tradingview-widget-container__widget { width:100% !important; height:100% !important; overflow:hidden; }
    ::-webkit-scrollbar { width:12px; height:12px; }
    ::-webkit-scrollbar-track { background:#2d3748; border-radius:12px; }
    ::-webkit-scrollbar-thumb { background:#4a5568; border-radius:12px; border:3px solid #2d3748; }
    ::-webkit-scrollbar-thumb:hover { background:#718096; }
    .tradingview-widget-copyright { position:absolute; bottom:0; width:100%; text-align:center; padding:2px 0; font-size:11px; color:#9db2bd; background-color:rgba(34,34,34,0.8); z-index:10; }
    .tradingview-widget-copyright a { color:#9db2bd; text-decoration:none; }
    .tradingview-widget-copyright a:hover { text-decoration:underline; }
  `, []);

  // Base chart config for all charts to share
  const baseChartConfig = useMemo(() => ({
    width:'100%', height:'100%', autosize:true,
    interval:'180', timezone:'exchange', theme:'dark', style:'1',
    withdateranges:true, hide_side_toolbar:true, allow_symbol_change:true, save_image:false,
    studies:['StochasticRSI@tv-basicstudies','MASimple@tv-basicstudies'],
    show_popup_button:true, popup_width:'1000', popup_height:'650', support_host:'https://www.tradingview.com',
    locale:'en', enable_publishing:false
  }), []);

  // Specific chart configs
  const chartConfigObject1 = useMemo(() => ({
    ...baseChartConfig,
    container_id: 'tradingview-chart-1',
    symbol: currentSymbol,
  }), [baseChartConfig, currentSymbol]);

  const chartConfigObject2 = useMemo(() => ({
    ...baseChartConfig,
    container_id: 'tradingview-chart-2',
    symbol: 'BINANCE:ETHUSDT',
  }), [baseChartConfig]);

  const chartConfigObject3 = useMemo(() => ({
    ...baseChartConfig,
    container_id: 'tradingview-chart-3',
    symbol: 'BINANCE:SOLUSDT',
  }), [baseChartConfig]);

  const chartConfigObject4 = useMemo(() => ({
    ...baseChartConfig,
    container_id: 'tradingview-chart-4',
    symbol: 'BINANCE:DOGEUSDT',
  }), [baseChartConfig]);

  // Function to create the HTML for an iframe
  const createChartSrcDoc = (config: any) => `
    <!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${tvWidgetBaseStyle}</style></head><body>
    <div class="tradingview-widget-container"><div id="${config.container_id}" style="width:100%;height:100%;"></div>
    <div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/" target="_blank">Track all markets on TradingView</a></div>
    </div><script src="https://s3.tradingview.com/tv.js"></script><script>new TradingView.widget(${JSON.stringify(config)});</script>
    </body></html>
  `;

  // Generate srcDoc for each chart
  const chartSrcDoc1 = useMemo(() => createChartSrcDoc(chartConfigObject1), [chartConfigObject1, tvWidgetBaseStyle]);
  const chartSrcDoc2 = useMemo(() => createChartSrcDoc(chartConfigObject2), [chartConfigObject2, tvWidgetBaseStyle]);
  const chartSrcDoc3 = useMemo(() => createChartSrcDoc(chartConfigObject3), [chartConfigObject3, tvWidgetBaseStyle]);
  const chartSrcDoc4 = useMemo(() => createChartSrcDoc(chartConfigObject4), [chartConfigObject4, tvWidgetBaseStyle]);

  // For screeners which require scrollbars
  const screenerStyle = useMemo(() => tvWidgetBaseStyle + ' html, body { overflow:auto!important; }', [tvWidgetBaseStyle]);
  const makeScreenerSrc = (type:string) => `<!DOCTYPE html><html><head><style>${screenerStyle}</style></head><body>
    <div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div>
    <script src="https://s3.tradingview.com/external-embedding/embed-widget-screener.js" async>${JSON.stringify({width:'100%',height:'100%',screener_type:type,defaultColumn:'overview',displayCurrency:'USD',colorTheme:'dark',locale:'en',isTransparent:true})}</script>
    </div></body></html>`;
  const optionsSrc = useMemo(() => makeScreenerSrc('stock'), [screenerStyle]);
  const cryptoSrc = useMemo(() => makeScreenerSrc('crypto_mkt'), [screenerStyle]);

  return (
    <Tabs defaultValue="chart" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 md:grid-cols-5">

        {/* Chart dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TabsTrigger value="chart" className="flex items-center"><LineChart className="mr-2"/>Chart</TabsTrigger>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {chartLayoutOptions.map(o=><DropdownMenuItem key={o.value} onSelect={()=>setSelectedChartLayout(o.value)}>{o.label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Heatmap dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TabsTrigger value="heatmap" className="flex items-center"><Columns className="mr-2 h-4 w-4"/>Heatmap</TabsTrigger>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {heatmapViewOptions.map(o=><DropdownMenuItem key={o.value} onSelect={()=>setSelectedHeatmapView(o.value)}>{o.label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>

        <TabsTrigger value="options_screener"><Settings2 className="mr-2"/>Options</TabsTrigger>
        <TabsTrigger value="crypto_screener"><ListFilter className="mr-2"/>Crypto</TabsTrigger>
        <TabsTrigger value="dex_screener"><SearchCode className="mr-2"/>DEX</TabsTrigger>
      </TabsList>


      <TabsContent value="chart" className={TABS_CONTENT_CLASS}>
        <div className={`grid w-full h-full p-0 m-0 gap-0 ${
            selectedChartLayout === 1 ? 'grid-cols-1 grid-rows-1' :
            selectedChartLayout === 2 ? 'grid-cols-1 md:grid-cols-2 grid-rows-1' :
            'grid-cols-1 md:grid-cols-2 grid-rows-2'
          }`} >
          {/* Chart 1 */}
          <div className="w-full h-full overflow-hidden">
            <iframe
              key={`chart-${chartConfigObject1.symbol}-${chartConfigObject1.container_id}`}
              srcDoc={chartSrcDoc1}
              title="Chart 1"
              className={WIDGET_CONTAINER_CLASS}
              style={{ border: 'none' }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>

          {/* Chart 2 */}
          {selectedChartLayout > 1 && (
            <div className="w-full h-full overflow-hidden">
              <iframe
                key={`chart-${chartConfigObject2.symbol}-${chartConfigObject2.container_id}`}
                srcDoc={chartSrcDoc2}
                title="Chart 2"
                className={WIDGET_CONTAINER_CLASS}
                style={{ border: 'none' }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          )}

          {/* Chart 3 */}
          {(selectedChartLayout === 3 || selectedChartLayout === 4) && (
            <div className="w-full h-full overflow-hidden">
              <iframe
                key={`chart-${chartConfigObject3.symbol}-${chartConfigObject3.container_id}`}
                srcDoc={chartSrcDoc3}
                title="Chart 3"
                className={WIDGET_CONTAINER_CLASS}
                style={{ border: 'none' }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          )}

          {/* Chart 4 or Analysis */}
          {selectedChartLayout === 3 ? (
            <div className="w-full h-full overflow-hidden">
              <ThreeChartAnalysisPanel />
            </div>
          ) : selectedChartLayout === 4 ? (
            <div className="w-full h-full overflow-hidden">
              <iframe
                key={`chart-${chartConfigObject4.symbol}-${chartConfigObject4.container_id}`}
                srcDoc={chartSrcDoc4}
                title="Chart 4"
                className={WIDGET_CONTAINER_CLASS}
                style={{ border: 'none' }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          ) : null}
        </div>
      </TabsContent>

      <TabsContent value="heatmap" className={TABS_CONTENT_CLASS}>
        <div className="h-full w-full">
          {selectedHeatmapView==='crypto_coins'&&<CryptoCoinsHeatmap tvWidgetBaseStyle={tvWidgetBaseStyle} WIDGET_CONTAINER_CLASS={WIDGET_CONTAINER_CLASS}/>}          
          {selectedHeatmapView==='stock_market'&&<StockHeatmap tvWidgetBaseStyle={tvWidgetBaseStyle} WIDGET_CONTAINER_CLASS={WIDGET_CONTAINER_CLASS}/>}          
          {selectedHeatmapView==='etf_heatmap'&&<EtfHeatmap tvWidgetBaseStyle={tvWidgetBaseStyle} WIDGET_CONTAINER_CLASS={WIDGET_CONTAINER_CLASS}/>}          
          {selectedHeatmapView==='forex_cross_rates'&&<ForexCrossRatesWidget tvWidgetBaseStyle={tvWidgetBaseStyle} WIDGET_CONTAINER_CLASS={WIDGET_CONTAINER_CLASS}/>}          
          {selectedHeatmapView==='forex_heatmap'&&<ForexHeatmapWidget tvWidgetBaseStyle={tvWidgetBaseStyle} WIDGET_CONTAINER_CLASS={WIDGET_CONTAINER_CLASS}/>}          
        </div>
      </TabsContent>

      <TabsContent value="options_screener" className={TABS_CONTENT_CLASS}>
        <div className="h-full w-full overflow-auto">
          <iframe srcDoc={optionsSrc} title="Options Screener" className={WIDGET_CONTAINER_CLASS} style={{border:'none'}} sandbox="allow-scripts allow-same-origin allow-forms allow-popups"/>
        </div>
      </TabsContent>

      <TabsContent value="crypto_screener" className={TABS_CONTENT_CLASS}>
        <div className="h-full w-full overflow-auto">
          <iframe srcDoc={cryptoSrc} title="Crypto Screener" className={WIDGET_CONTAINER_CLASS} style={{border:'none'}} sandbox="allow-scripts allow-same-origin allow-forms allow-popups"/>
        </div>
      </TabsContent>

      <TabsContent value="dex_screener" className={TABS_CONTENT_CLASS}>
        <DexScreenerContent/>
      </TabsContent>
    </Tabs>
  );
};

export default MainViews;
