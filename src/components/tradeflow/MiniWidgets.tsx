
'use client';
import React, { useState } from 'react'; // Corrected: import React and useState
import type { FC } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combine, TrendingUp, MessageCircle, ClipboardList, Coins } from 'lucide-react';

// Import mini-widget components
import TechWidgetContent from './mini-widgets/TechWidgetContent';
import TradingViewTechAnalysisWidget from './mini-widgets/TradingViewTechAnalysisWidget';
import AiWebchat from './mini-widgets/AiWebchat';
import TradeTracker from './mini-widgets/TradeTracker';
import KucoinTradePanel from './mini-widgets/exchange-panels/KucoinTradePanel';
import RaydiumTradePanel from './mini-widgets/exchange-panels/RaydiumTradePanel';
import PumpswapTradePanel from './mini-widgets/exchange-panels/PumpswapTradePanel';

// Props for MiniWidgets - expecting currentSymbol and onSymbolChange
interface MiniWidgetsProps {
  currentSymbol: string;
  onSymbolChange: (symbol: string) => void;
}

type SelectedExchangeType = 'kucoin' | 'raydium' | 'pumpswap';

const MiniWidgets: React.FC<MiniWidgetsProps> = ({ currentSymbol, onSymbolChange }) => {
  const WIDGET_CONTAINER_CLASS = "h-full min-h-[500px] w-full";
  const [selectedExchange, setSelectedExchange] = useState<SelectedExchangeType>('kucoin');

  return (
    <Tabs defaultValue="ai_chat" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-5 mb-4"> {/* Using grid-cols-5 and mb-4 as per example */}
        <TabsTrigger value="tech_overview"><Combine className="mr-1 h-4 w-4 sm:mr-2" />Overview</TabsTrigger>
        <TabsTrigger value="tech_analysis"><TrendingUp className="mr-1 h-4 w-4 sm:mr-2" />Analysis</TabsTrigger>
        <TabsTrigger value="ai_chat"><MessageCircle className="mr-1 h-4 w-4 sm:mr-2" />AI Chat</TabsTrigger>
        <TabsTrigger value="trade_log"><ClipboardList className="mr-1 h-4 w-4 sm:mr-2" />Log</TabsTrigger>
        <TabsTrigger value="trade_panels"><Coins className="mr-1 h-4 w-4 sm:mr-2" />Trade</TabsTrigger> 
      </TabsList>

      <TabsContent value="tech_overview" className={`flex-grow overflow-auto ${WIDGET_CONTAINER_CLASS}`}>
        <TechWidgetContent />
      </TabsContent>

      <TabsContent value="tech_analysis" className={`flex-grow overflow-hidden ${WIDGET_CONTAINER_CLASS}`}>
        <TradingViewTechAnalysisWidget symbol={currentSymbol} />
      </TabsContent>

      <TabsContent value="ai_chat" className={`flex-grow overflow-hidden ${WIDGET_CONTAINER_CLASS}`}>
        <AiWebchat onSymbolSubmit={onSymbolChange} />
      </TabsContent>

      <TabsContent value="trade_log" className={`flex-grow overflow-hidden ${WIDGET_CONTAINER_CLASS}`}>
        <TradeTracker />
      </TabsContent>
      
      <TabsContent value="trade_panels" className={`flex-grow flex flex-col overflow-hidden ${WIDGET_CONTAINER_CLASS}`}>
        <div className="p-2 border-b border-border"> {/* Div for Select dropdown */}
          <Select onValueChange={(value) => setSelectedExchange(value as SelectedExchangeType)} defaultValue="kucoin">
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select Exchange Panel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kucoin">Kucoin Panel</SelectItem>
              <SelectItem value="raydium">Raydium Panel</SelectItem>
              <SelectItem value="pumpswap">Pumpswap Panel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-grow overflow-hidden min-h-0"> {/* This div allows the panel to take remaining height */}
          {selectedExchange === 'kucoin' && <KucoinTradePanel />}
          {selectedExchange === 'raydium' && <RaydiumTradePanel />}
          {selectedExchange === 'pumpswap' && <PumpswapTradePanel />}
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default MiniWidgets;
