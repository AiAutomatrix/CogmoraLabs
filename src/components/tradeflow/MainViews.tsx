'use client';

import React, { useMemo, useState } from 'react';
import type { FC } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LineChart, Columns, ListFilter, Settings2, SearchCode } from 'lucide-react';
import DexScreenerContent from './main-views/DexScreenerContent';
import ThreeChartAnalysisPanel from './main-views/ThreeChartAnalysisPanel';
import CryptoCoinsHeatmap from './main-views/heatmaps/CryptoCoinsHeatmap';
import StockHeatmap from './main-views/heatmaps/StockHeatmap';
import EtfHeatmap from './main-views/heatmaps/EtfHeatmap';
import ForexCrossRatesWidget from './main-views/heatmaps/ForexCrossRatesWidget';
import ForexHeatmapWidget from './main-views/heatmaps/ForexHeatmapWidget';

interface MainViewsProps {
  currentSymbol: string;
}

const MainViews: FC<MainViewsProps> = ({ currentSymbol }) => {
  const FIXED_HEIGHT_CLASS = "h-[890px]";
  const BASE_CLASS = "w-full overflow-hidden";

  const [activeTab, setActiveTab] = useState("heatmap");
  const [selectedHeatmapView, setSelectedHeatmapView] = useState('crypto_coins');
  const heatmapViewOptions = [
    { value: 'crypto_coins', label: 'Crypto Coins Heatmap' },
    { value: 'stock_market', label: 'Stock Market Heatmap' },
    { value: 'etf_heatmap', label: 'ETF Heatmap' },
    { value: 'forex_cross_rates', label: 'Forex Cross Rates' },
    { value: 'forex_heatmap', label: 'Forex Heatmap' },
  ];

  const [selectedChartLayout, setSelectedChartLayout] = useState(1);
  const chartLayoutOptions = [
    { value: 1, label: '1 Chart' },
    { value: 2, label: '2 Charts' },
    { value: 3, label: '3 Charts + Analysis' },
    { value: 4, label: '4 Charts' },
  ];

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

  const baseChartConfig = useMemo(() => ({
    width:'100%', height:'100%', autosize:true,
    symbol:currentSymbol, interval:'180', timezone:'exchange', theme:'dark', style:'1',
    withdateranges:true, hide_side_toolbar:true, allow_symbol_change:true, save_image:false,
    studies:['StochasticRSI@tv-basicstudies','MASimple@tv-basicstudies'],
    show_popup_button:true, popup_width:'1000', popup_height:'650', support_host:'https://www.tradingview.com',
    locale:'en', enable_publishing:false
  }), [currentSymbol]);

  const chartConfig = useMemo(() => ({ ...baseChartConfig, container_id:'tv-chart-main' }), [baseChartConfig]);
  const chartSrcDoc = useMemo(() => `
    <!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${tvWidgetBaseStyle}</style></head><body>
    <div class="tradingview-widget-container"><div id="${chartConfig.container_id}" style="width:100%;height:100%;"></div>
    <div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/" target="_blank">Track all markets on TradingView</a></div>
    </div><script src="https://s3.tradingview.com/tv.js"></script><script>new TradingView.widget(${JSON.stringify(chartConfig)});</script>
    </body></html>
  `, [chartConfig, tvWidgetBaseStyle]);

  const screenerStyle = useMemo(() => tvWidgetBaseStyle + ' html, body { overflow:auto!important; }', [tvWidgetBaseStyle]);
  const makeScreenerSrc = (type:string) => `<!DOCTYPE html><html><head><style>${screenerStyle}</style></head><body>
    <div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div>
    <script src="https://s3.tradingview.com/external-embedding/embed-widget-screener.js" async>${JSON.stringify({width:'100%',height:'100%',screener_type:type,defaultColumn:'overview',displayCurrency:'USD',colorTheme:'dark',locale:'en',isTransparent:true})}</script>
    </div></body></html>`;
  const optionsSrc = useMemo(() => makeScreenerSrc('stock'), [screenerStyle]);
  const cryptoSrc = useMemo(() => makeScreenerSrc('crypto_mkt'), [screenerStyle]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col p-0 m-0">
      {/* 📱 Mobile Menus */}
      <div className="w-full flex flex-col space-y-2 p-2 md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full bg-zinc-800 text-white p-2 rounded text-left">
            📊 Chart & Heatmap Views
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-full">
            <DropdownMenuItem onSelect={() => setActiveTab('chart')}>Chart View</DropdownMenuItem>
            {chartLayoutOptions.map(o => (
              <DropdownMenuItem key={o.value} onSelect={() => {
                setSelectedChartLayout(o.value);
                setActiveTab('chart');
              }}>{o.label}</DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => setActiveTab('heatmap')}>Heatmap View</DropdownMenuItem>
            {heatmapViewOptions.map(o => (
              <DropdownMenuItem key={o.value} onSelect={() => {
                setSelectedHeatmapView(o.value);
                setActiveTab('heatmap');
              }}>{o.label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="w-full bg-zinc-800 text-white p-2 rounded text-left">
            📈 Screener Views
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-full">
            <DropdownMenuItem onSelect={() => setActiveTab('options_screener')}>Options Screener</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setActiveTab('crypto_screener')}>Crypto Screener</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setActiveTab('dex_screener')}>DEX Screener</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 🖥️ Desktop Tabs */}
      <TabsList className="hidden md:grid w-full grid-cols-2 sm:grid-cols-4 md:grid-cols-5 mb-0 p-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TabsTrigger value="chart" className="flex items-center"><LineChart className="mr-2"/>Chart</TabsTrigger>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {chartLayoutOptions.map(o=><DropdownMenuItem key={o.value} onSelect={()=>setSelectedChartLayout(o.value)}>{o.label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>

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

      {/* 🔁 Tab Content */}
      <TabsContent value="chart" className="flex-grow overflow-hidden p-0 m-0">
        <div className={`grid w-full ${FIXED_HEIGHT_CLASS} gap-0 p-0 m-0 ${
          selectedChartLayout === 1 ? 'grid-cols-1 grid-rows-1' :
          selectedChartLayout === 2 ? 'grid-cols-2 grid-rows-1' :
          'grid-cols-2 grid-rows-2'
        }`}>
          {[1, 2, 3, 4].slice(0, selectedChartLayout === 3 ? 3 : selectedChartLayout).map((_, i) => (
            <div key={i} className={`${BASE_CLASS} ${FIXED_HEIGHT_CLASS} p-0 m-0`}>
              <iframe
                srcDoc={chartSrcDoc}
                title={`Chart ${i + 1}`}
                className="w-full h-full"
                style={{ border: 'none' }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          ))}
          {selectedChartLayout === 3 && (
            <div className={`${BASE_CLASS} ${FIXED_HEIGHT_CLASS} p-0 m-0`}>
              <ThreeChartAnalysisPanel />
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="heatmap" className="flex-grow overflow-hidden p-0 m-0">
        <div className={`${BASE_CLASS} ${FIXED_HEIGHT_CLASS}`}>
          {selectedHeatmapView==='crypto_coins'&&<CryptoCoinsHeatmap tvWidgetBaseStyle={tvWidgetBaseStyle} WIDGET_CONTAINER_CLASS={`${BASE_CLASS} ${FIXED_HEIGHT_CLASS}`} />}          
          {selectedHeatmapView==='stock_market'&&<StockHeatmap tvWidgetBaseStyle={tvWidgetBaseStyle} WIDGET_CONTAINER_CLASS={`${BASE_CLASS} ${FIXED_HEIGHT_CLASS}`} />}          
          {selectedHeatmapView==='etf_heatmap'&&<EtfHeatmap tvWidgetBaseStyle={tvWidgetBaseStyle} WIDGET_CONTAINER_CLASS={`${BASE_CLASS} ${FIXED_HEIGHT_CLASS}`} />}          
          {selectedHeatmapView==='forex_cross_rates'&&<ForexCrossRatesWidget tvWidgetBaseStyle={tvWidgetBaseStyle} WIDGET_CONTAINER_CLASS={`${BASE_CLASS} ${FIXED_HEIGHT_CLASS}`} />}          
          {selectedHeatmapView==='forex_heatmap'&&<ForexHeatmapWidget tvWidgetBaseStyle={tvWidgetBaseStyle} WIDGET_CONTAINER_CLASS={`${BASE_CLASS} ${FIXED_HEIGHT_CLASS}`} />}          
        </div>
      </TabsContent>

      <TabsContent value="options_screener" className="flex-grow overflow-hidden p-0 m-0">
        <div className={`${BASE_CLASS} ${FIXED_HEIGHT_CLASS}`}>
          <iframe srcDoc={optionsSrc} title="Options Screener" className="w-full h-full" style={{border:'none'}} sandbox="allow-scripts allow-same-origin allow-forms allow-popups"/>
        </div>
      </TabsContent>

      <TabsContent value="crypto_screener" className="flex-grow overflow-hidden p-0 m-0">
        <div className={`${BASE_CLASS} ${FIXED_HEIGHT_CLASS}`}>
          <iframe srcDoc={cryptoSrc} title="Crypto Screener" className="w-full h-full" style={{border:'none'}} sandbox="allow-scripts allow-same-origin allow-forms allow-popups"/>
        </div>
      </TabsContent>

      <TabsContent value="dex_screener" className="flex-grow overflow-hidden p-0 m-0">
        <DexScreenerContent />
      </TabsContent>
    </Tabs>
  );
};

export default MainViews;
