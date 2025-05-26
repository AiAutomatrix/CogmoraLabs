'use client';
import React, { useState } from 'react'; // Corrected: import React for FC and JSX
import type { FC } from 'react'; 
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combine, TrendingUp, MessageCircle, ClipboardList, Coins } from 'lucide-react'; 
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'; // Added for placeholder


// Import all mini-widget components
import TechWidgetContent from './mini-widgets/TechWidgetContent';
import TradingViewTechAnalysisWidget from './mini-widgets/TradingViewTechAnalysisWidget';
import AiWebchat from './mini-widgets/AiWebchat'; // This will now render the Botpress iframe
import TradeTracker from './mini-widgets/TradeTracker';

// Import exchange panel components
import KucoinTradePanel from './mini-widgets/exchange-panels/KucoinTradePanel';
import RaydiumTradePanel from './mini-widgets/exchange-panels/RaydiumTradePanel';
import PumpswapTradePanel from './mini-widgets/exchange-panels/PumpswapTradePanel';

interface MiniWidgetsProps {
  currentSymbol: string;
  onSymbolChange: (symbol: string) => void; 
}

type SelectedExchangeType = 'kucoin' | 'raydium' | 'pumpswap';

const MiniWidgets: React.FC<MiniWidgetsProps> = ({ currentSymbol, onSymbolChange }) => {
  const WIDGET_CONTAINER_CLASS = "h-full min-h-[500px] w-full";
  const FIXED_HEIGHT_CLASS = "w-full h-[825px]"; 

  const [selectedExchange, setSelectedExchange] = useState<SelectedExchangeType>('kucoin');

  return (
    <Tabs defaultValue="ai_chat" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-5"> 
        <TabsTrigger value="tech_overview"><Combine className="mr-1 h-4 w-4 sm:mr-2" />Overview</TabsTrigger>
        <TabsTrigger value="tech_analysis"><TrendingUp className="mr-1 h-4 w-4 sm:mr-2" />Analysis</TabsTrigger>
        <TabsTrigger value="ai_chat"><MessageCircle className="mr-1 h-4 w-4 sm:mr-2" />AI Chat</TabsTrigger>
        <TabsTrigger value="trade_log"><ClipboardList className="mr-1 h-4 w-4 sm:mr-2" />Log</TabsTrigger>
        <TabsTrigger value="trade_panels"><Coins className="mr-1 h-4 w-4 sm:mr-2" />Trade</TabsTrigger>
      </TabsList>

      <TabsContent value="tech_overview" className={`mt-0 flex-grow overflow-auto ${WIDGET_CONTAINER_CLASS}`}>
        <TechWidgetContent />
      </TabsContent>

      <TabsContent value="tech_analysis" className={`mt-0 flex-grow overflow-hidden ${FIXED_HEIGHT_CLASS}`}>
        <TradingViewTechAnalysisWidget symbol={currentSymbol} />
      </TabsContent>

      <TabsContent value="ai_chat" className={`mt-0 flex-grow overflow-hidden ${FIXED_HEIGHT_CLASS}`}>
        <AiWebchat /> {/* No onSymbolSubmit prop */}
      </TabsContent>

      <TabsContent value="trade_log" className={`mt-0 flex-grow overflow-auto ${WIDGET_CONTAINER_CLASS}`}>
        <TradeTracker />
      </TabsContent>
      
      <TabsContent value="trade_panels" className={`mt-0 flex-grow flex flex-col overflow-hidden ${FIXED_HEIGHT_CLASS}`}>
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
        <div className="flex-grow overflow-hidden min-h-0">
          {selectedExchange === 'kucoin' && <KucoinTradePanel />}
          {selectedExchange === 'raydium' && <RaydiumTradePanel />}
          {selectedExchange === 'pumpswap' && <PumpswapTradePanel />}
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default MiniWidgets;
