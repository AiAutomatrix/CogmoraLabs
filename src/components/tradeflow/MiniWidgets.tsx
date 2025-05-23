
'use client';
import type React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cpu, MessageCircle, ClipboardList, Settings, TrendingUp, Coins, Combine } from 'lucide-react'; // Added Combine for Overview

import TechWidgetContent from './mini-widgets/TechWidgetContent';
import AiWebchat from './mini-widgets/AiWebchat';
import TradeTracker from './mini-widgets/TradeTracker';
import TradingViewTechAnalysisWidget from './mini-widgets/TradingViewTechAnalysisWidget';
import KucoinTradePanel from './mini-widgets/KucoinTradePanel';

const MiniWidgets: React.FC = () => {
  return (
    <Tabs defaultValue="ai_chat" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="tech_overview"><Combine className="mr-1 h-4 w-4 sm:mr-2" />Overview</TabsTrigger>
        <TabsTrigger value="tech_analysis"><TrendingUp className="mr-1 h-4 w-4 sm:mr-2" />Analysis</TabsTrigger>
        <TabsTrigger value="ai_chat"><MessageCircle className="mr-1 h-4 w-4 sm:mr-2" />AI Chat</TabsTrigger>
        <TabsTrigger value="trade_log"><ClipboardList className="mr-1 h-4 w-4 sm:mr-2" />Log</TabsTrigger>
        <TabsTrigger value="kucoin_panel"><Coins className="mr-1 h-4 w-4 sm:mr-2" />Kucoin</TabsTrigger>
      </TabsList>

      {/* Tech Overview Tab Content */}
      <TabsContent value="tech_overview" className="mt-0 flex-grow flex flex-col overflow-hidden">
        <TechWidgetContent />
      </TabsContent>

      {/* Technical Analysis Tab Content */}
      <TabsContent value="tech_analysis" className="mt-0 flex-grow flex flex-col overflow-hidden">
        <TradingViewTechAnalysisWidget />
      </TabsContent>

      {/* AI Chat Tab Content */}
      <TabsContent value="ai_chat" className="mt-0 flex-grow flex flex-col overflow-hidden">
        <AiWebchat />
      </TabsContent>

      {/* Trade Log Tab Content */}
      <TabsContent value="trade_log" className="mt-0 flex-grow flex flex-col overflow-hidden">
        <TradeTracker />
      </TabsContent>

      {/* Kucoin Panel Tab Content */}
      <TabsContent value="kucoin_panel" className="mt-0 flex-grow flex flex-col overflow-hidden">
        <KucoinTradePanel />
      </TabsContent>
    </Tabs>
  );
};

export default MiniWidgets;
