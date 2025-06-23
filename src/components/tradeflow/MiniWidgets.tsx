
'use client';
import React, { useState } from 'react';
import type { FC } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, MessageCircle } from 'lucide-react';

// Import mini-widget components
import TradingViewTechAnalysisWidget from './mini-widgets/TradingViewTechAnalysisWidget';
import AiWebchat from './mini-widgets/AiWebchat';

interface MiniWidgetsProps {
  currentSymbol: string;
  onSymbolChange: (symbol: string) => void;
}

const MiniWidgets: FC<MiniWidgetsProps> = ({ currentSymbol, onSymbolChange }) => {

  return (
    <Tabs defaultValue="ai_chat" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="tech_analysis"><TrendingUp className="mr-1 h-4 w-4 sm:mr-2" />Analysis</TabsTrigger>
        <TabsTrigger value="ai_chat"><MessageCircle className="mr-1 h-4 w-4 sm:mr-2" />AI Chat</TabsTrigger>
      </TabsList>

      <TabsContent value="tech_analysis" className="flex-grow overflow-hidden min-h-0 mt-0">
        <TradingViewTechAnalysisWidget symbol={currentSymbol} />
      </TabsContent>

      <TabsContent value="ai_chat" className="flex-grow overflow-hidden min-h-0 mt-0">
        <AiWebchat />
      </TabsContent>
    </Tabs>
  );
};

export default MiniWidgets;
