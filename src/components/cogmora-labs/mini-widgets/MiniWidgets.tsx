
'use client';
import React from 'react';
import type { FC } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, MessageCircle } from 'lucide-react';

// Import mini-widget components
import TradingViewTechAnalysisWidget from './analysis/TradingViewTechAnalysisWidget';
import AiWebchat from './chat/AiWebchat';

interface MiniWidgetsProps {
  currentSymbol: string;
  onSymbolChange: (symbol: string) => void;
  activeMiniView: string;
  setActiveMiniView: (view: string) => void;
}

const MiniWidgets: FC<MiniWidgetsProps> = ({
  currentSymbol,
  onSymbolChange,
  activeMiniView,
  setActiveMiniView,
}) => {
  return (
    <Tabs
      value={activeMiniView}
      onValueChange={setActiveMiniView}
      className="w-full flex-grow flex flex-col min-h-0"
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="tech_analysis">
          <TrendingUp className="mr-1 h-4 w-4 sm:mr-2" />
          Analysis
        </TabsTrigger>
        <TabsTrigger value="ai_chat">
          <MessageCircle className="mr-1 h-4 w-4 sm:mr-2" />
          AI Chat
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="tech_analysis"
        className="overflow-hidden flex-grow mt-0"
      >
        <TradingViewTechAnalysisWidget symbol={currentSymbol} />
      </TabsContent>

      <TabsContent value="ai_chat" className="overflow-hidden flex-grow mt-0">
        <AiWebchat />
      </TabsContent>
    </Tabs>
  );
};

export default MiniWidgets;
