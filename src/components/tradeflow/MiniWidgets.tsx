
'use client';
import type React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, ClipboardList, TrendingUp, Coins, Combine } from 'lucide-react';

import TechWidgetContent from './mini-widgets/TechWidgetContent';
import AiWebchat from './mini-widgets/AiWebchat';
import TradeTracker from './mini-widgets/TradeTracker';
import TradingViewTechAnalysisWidget from './mini-widgets/TradingViewTechAnalysisWidget';
import KucoinTradePanel from './mini-widgets/KucoinTradePanel';

const MiniWidgets: React.FC = () => {
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

      <TabsContent value="tech_overview" className={`flex-grow overflow-auto ${WIDGET_CONTAINER_CLASS}`}>
        <TechWidgetContent />
      </TabsContent>

      <TabsContent value="tech_analysis" className={`flex-grow overflow-hidden ${WIDGET_CONTAINER_CLASS}`}>
        <TradingViewTechAnalysisWidget />
      </TabsContent>

      <TabsContent value="ai_chat" className={`flex-grow overflow-hidden ${WIDGET_CONTAINER_CLASS}`}>
        <AiWebchat />
      </TabsContent>

      <TabsContent value="trade_log" className={`flex-grow overflow-hidden ${WIDGET_CONTAINER_CLASS}`}>
        <TradeTracker />
      </TabsContent>

      <TabsContent value="kucoin_panel" className={`flex-grow overflow-hidden ${WIDGET_CONTAINER_CLASS}`}>
        <KucoinTradePanel />
      </TabsContent>
    </Tabs>
  );
};

export default MiniWidgets;
