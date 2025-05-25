
'use client';
import React, { useState } from 'react'; // Corrected React import
import type { FC } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'; // Added Card imports
import { Combine, TrendingUp, MessageCircle, ClipboardList, Coins } from 'lucide-react';

import TechWidgetContent from './mini-widgets/TechWidgetContent';
import TradingViewTechAnalysisWidget from './mini-widgets/TradingViewTechAnalysisWidget';
import AiWebchat from './mini-widgets/AiWebchat';
import TradeTracker from './mini-widgets/TradeTracker';
// Updated import paths for exchange panels
import KucoinTradePanel from './mini-widgets/exchange-panels/KucoinTradePanel';
import RaydiumTradePanel from './mini-widgets/exchange-panels/RaydiumTradePanel';
import PumpswapTradePanel from './mini-widgets/exchange-panels/PumpswapTradePanel';

interface MiniWidgetsProps {
  currentSymbol: string;
  onSymbolChange: (symbol: string) => void;
}

type SelectedExchangeType = 'kucoin' | 'raydium' | 'pumpswap';

const MiniWidgets: React.FC<MiniWidgetsProps> = ({ currentSymbol, onSymbolChange }) => {
  const [selectedTechWidget, setSelectedTechWidget] = useState<'overview' | 'technical_analysis'>('overview');
  const [selectedExchange, setSelectedExchange] = useState<SelectedExchangeType>('kucoin');

  return (
    <Tabs defaultValue="ai_chat" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="tech_widget"><Combine className="mr-1 h-4 w-4 sm:mr-2" />Tech</TabsTrigger>
        <TabsTrigger value="ai_chat"><MessageCircle className="mr-1 h-4 w-4 sm:mr-2" />AI Chat</TabsTrigger>
        <TabsTrigger value="trade_tracker"><ClipboardList className="mr-1 h-4 w-4 sm:mr-2" />Log</TabsTrigger>
        <TabsTrigger value="trade_panels"><Coins className="mr-1 h-4 w-4 sm:mr-2" />Trade</TabsTrigger> 
        <TabsTrigger value="placeholder_tab">More</TabsTrigger>
      </TabsList>

      <TabsContent value="tech_widget" className="mt-0 flex-grow flex flex-col overflow-hidden min-h-0">
        <div className="p-2 border-b border-border">
          <Select onValueChange={(value) => setSelectedTechWidget(value as 'overview' | 'technical_analysis')} defaultValue="overview">
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select Tech Widget" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Tech Overview</SelectItem>
              <SelectItem value="technical_analysis">TA Widget</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-grow overflow-hidden min-h-0">
          {selectedTechWidget === 'overview' && <TechWidgetContent />}
          {selectedTechWidget === 'technical_analysis' && <TradingViewTechAnalysisWidget symbol={currentSymbol} />}
        </div>
      </TabsContent>

      <TabsContent value="ai_chat" className="mt-0 flex-grow flex flex-col overflow-hidden min-h-0">
        <AiWebchat onSymbolSubmit={onSymbolChange} />
      </TabsContent>

      <TabsContent value="trade_tracker" className="mt-0 flex-grow flex flex-col overflow-hidden min-h-0">
        <div className="p-2 border-b border-border">
          {/* Placeholder for potential Tracker dropdown, currently just TradeTracker */}
        </div>
        <div className="flex-grow overflow-hidden min-h-0">
          <TradeTracker />
        </div>
      </TabsContent>
      
      <TabsContent value="trade_panels" className="mt-0 flex-grow flex flex-col overflow-hidden min-h-0">
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

      <TabsContent value="placeholder_tab" className="mt-0 flex-grow flex flex-col overflow-hidden min-h-0">
        <Card className="h-full flex flex-col rounded-none border-0 shadow-none">
            <CardHeader className="px-3 pt-1 pb-2 border-b">
                <CardTitle>Placeholder</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow p-3">
                <p>More content coming soon.</p>
            </CardContent>
        </Card>
      </TabsContent>

    </Tabs>
  );
};

export default MiniWidgets;
