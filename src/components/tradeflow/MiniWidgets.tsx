
'use client';
import React from 'react'; // Corrected import
import type { FC } from 'react';
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
  const TABS_CONTENT_CLASS = "mt-0 flex-grow flex flex-col overflow-hidden min-h-0";

  return (
    <Tabs defaultValue="ai_chat" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-5"> {/* Removed mb-4 */}
        <TabsTrigger value="tech_overview"><Combine className="mr-1 h-4 w-4 sm:mr-2" />Overview</TabsTrigger>
        <TabsTrigger value="tech_analysis"><TrendingUp className="mr-1 h-4 w-4 sm:mr-2" />Analysis</TabsTrigger>
        <TabsTrigger value="ai_chat"><MessageCircle className="mr-1 h-4 w-4 sm:mr-2" />AI Chat</TabsTrigger>
        <TabsTrigger value="trade_log"><ClipboardList className="mr-1 h-4 w-4 sm:mr-2" />Log</TabsTrigger>
        <TabsTrigger value="kucoin_panel"><Coins className="mr-1 h-4 w-4 sm:mr-2" />Kucoin</TabsTrigger>
      </TabsList>

      <TabsContent value="tech_overview" className={TABS_CONTENT_CLASS}>
        <TechWidgetContent />
      </TabsContent>

      <TabsContent value="tech_analysis" className={TABS_CONTENT_CLASS}>
        <TradingViewTechAnalysisWidget symbol={currentSymbol} />
      </TabsContent>

      <TabsContent value="ai_chat" className={TABS_CONTENT_CLASS}>
        <AiWebchat onSymbolSubmit={onSymbolChange} />
      </TabsContent>

      <TabsContent value="trade_log" className={TABS_CONTENT_CLASS}>
        <TradeTracker />
      </TabsContent>

      <TabsContent value="kucoin_panel" className={TABS_CONTENT_CLASS}>
        <KucoinTradePanel />
      </TabsContent>
    </Tabs>
  );
};

export default MiniWidgets;
