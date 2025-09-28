
'use client';
import React, { useState } from 'react';
import type { FC } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, MessageCircle } from 'lucide-react';

// Import mini-widget components
import TradingViewTechAnalysisWidget from './TradingViewTechAnalysisWidget';
import AiWebchat from './AiWebchat';

interface MiniWidgetsProps {
  currentSymbol: string;
  onSymbolChange: (symbol: string) => void;
}

const MiniWidgets: FC<MiniWidgetsProps> = ({ currentSymbol, onSymbolChange }) => {

  return (
    <Tabs defaultValue="ai_chat" className="w-full flex-grow flex flex-col min-h-0">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="tech_analysis"><TrendingUp className="mr-1 h-4 w-4 sm:mr-2" />Analysis</TabsTrigger>
        <TabsTrigger value="ai_chat"><MessageCircle className="mr-1 h-4 w-4 sm:mr-2" />AI Chat</TabsTrigger>
      </TabsList>

      <TabsContent value="tech_analysis" className="overflow-hidden min-h-0 mt-0 h-full">
        <TradingViewTechAnalysisWidget symbol={currentSymbol} />
      </TabsContent>

      <TabsContent value="ai_chat" className="overflow-hidden min-h-0 mt-0 h-full">
        <AiWebchat />
      </TabsContent>
    </Tabs>
  );
};

export default MiniWidgets;
