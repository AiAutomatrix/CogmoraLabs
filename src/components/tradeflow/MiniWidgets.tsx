
'use client';
import React, { useState } from 'react'; // Corrected: import React for FC and JSX
import type { FC } from 'react'; // Keep type import for FC if preferred
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'; // Added Card imports
import { Combine, TrendingUp, MessageCircle, ClipboardList, Coins, GripVertical } from 'lucide-react'; // Added necessary icons

// Import all five mini-widget components
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
      <TabsList className="grid w-full grid-cols-5"> {/* Removed mb-4 */}
        <TabsTrigger value="tech_overview"><Combine className="mr-1 h-4 w-4 sm:mr-2" />Overview</TabsTrigger>
        <TabsTrigger value="tech_analysis"><TrendingUp className="mr-1 h-4 w-4 sm:mr-2" />Analysis</TabsTrigger>
        <TabsTrigger value="ai_chat"><MessageCircle className="mr-1 h-4 w-4 sm:mr-2" />AI Chat</TabsTrigger>
        <TabsTrigger value="trade_log"><ClipboardList className="mr-1 h-4 w-4 sm:mr-2" />Log</TabsTrigger>
        <TabsTrigger value="trade_panels"><Coins className="mr-1 h-4 w-4 sm:mr-2" />Trade</TabsTrigger> 
      </TabsList>

      <TabsContent value="tech_overview" className={`mt-0 flex-grow overflow-auto ${WIDGET_CONTAINER_CLASS}`}>
        <TechWidgetContent />
      </TabsContent>

      <TabsContent value="tech_analysis" className="mt-0 flex-grow overflow-hidden w-full h-[825px]">
        <TradingViewTechAnalysisWidget symbol={currentSymbol} />
      </TabsContent>

      <TabsContent value="ai_chat" className="mt-0 flex-grow overflow-hidden w-full h-[825px]">
        <AiWebchat onSymbolSubmit={onSymbolChange} />
      </TabsContent>

      <TabsContent value="trade_log" className={`mt-0 flex-grow overflow-hidden ${WIDGET_CONTAINER_CLASS}`}>
        <TradeTracker />
      </TabsContent>
      
      <TabsContent value="trade_panels" className={`mt-0 flex-grow flex flex-col overflow-hidden ${WIDGET_CONTAINER_CLASS}`}>
        <div className="p-2 border-b border-border">
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
