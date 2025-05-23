
'use client';
import type React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combine, MessageCircle, ClipboardList, TrendingUp, Coins } from 'lucide-react';

import TechWidgetContent from './mini-widgets/TechWidgetContent';
import AiWebchat from './mini-widgets/AiWebchat';
import TradeTracker from './mini-widgets/TradeTracker';
import TradingViewTechAnalysisWidget from './mini-widgets/TradingViewTechAnalysisWidget';
import KucoinTradePanel from './mini-widgets/KucoinTradePanel';

interface MiniWidgetsProps {
  currentSymbol: string;
  onSymbolChange: (symbol: string) => void;
}

const MiniWidgets: React.FC<MiniWidgetsProps> = ({ currentSymbol, onSymbolChange }) => {
  const WIDGET_CONTAINER_CLASS = "h-full min-h-[500px] w-full";

  return (
    <Tabs defaultValue="ai_chat" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-5 mb-4">
        <TabsTrigger value="tech_overview"><Combine className="mr-1 h-4 w-4 sm:mr-2" />Overview</TabsTrigger>
        <TabsTrigger value="tech_analysis"><TrendingUp className="mr-1 h-4 w-4 sm:mr-2" />Analysis</TabsTrigger>
        <TabsTrigger value="ai_chat"><MessageCircle className="mr-1 h-4 w-4 sm:mr-2" />AI Chat</TabsTrigger>
        <TabsTrigger value="trade_log"><ClipboardList className="mr-1 h-4 w-4 sm:mr-2" />Log</TabsTrigger>
        <TabsTrigger value="kucoin_panel"><Coins className="mr-1 h-4 w-4 sm:mr-2" />Kucoin</TabsTrigger>
      </TabsList>

      <TabsContent value="tech_overview" className={`mt-0 flex-grow flex flex-col overflow-auto min-h-0 ${WIDGET_CONTAINER_CLASS}`}>
        <TechWidgetContent />
      </TabsContent>

      <TabsContent value="tech_analysis" className={`mt-0 flex-grow flex flex-col overflow-hidden min-h-0 ${WIDGET_CONTAINER_CLASS}`}>
        <TradingViewTechAnalysisWidget symbol={currentSymbol} />
      </TabsContent>

      <TabsContent value="ai_chat" className={`mt-0 flex-grow flex flex-col overflow-hidden min-h-0 ${WIDGET_CONTAINER_CLASS}`}>
        <AiWebchat onSymbolSubmit={onSymbolChange} />
      </TabsContent>

      <TabsContent value="trade_log" className={`mt-0 flex-grow flex flex-col overflow-hidden min-h-0 ${WIDGET_CONTAINER_CLASS}`}>
        <TradeTracker />
      </TabsContent>

      <TabsContent value="kucoin_panel" className={`mt-0 flex-grow flex flex-col overflow-hidden min-h-0 ${WIDGET_CONTAINER_CLASS}`}>
        <KucoinTradePanel />
      </TabsContent>
    </Tabs>
  );
};

export default MiniWidgets;
