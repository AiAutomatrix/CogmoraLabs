
'use client';
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cpu, MessageCircle, ClipboardList, Settings, TrendingUp, Coins } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import TechWidgetContent from './mini-widgets/TechWidgetContent';
import AiWebchat from './mini-widgets/AiWebchat';
import TradeTracker from './mini-widgets/TradeTracker';
import TradingViewTechAnalysisWidget from './mini-widgets/TradingViewTechAnalysisWidget';
import KucoinTradePanel from './mini-widgets/KucoinTradePanel';

type TechWidgetSelection = 'overview' | 'technical_analysis';
type TrackerViewSelection = 'trade_log' | 'kucoin_panel';

const MiniWidgets: React.FC = () => {
  const [selectedTechWidget, setSelectedTechWidget] = useState<TechWidgetSelection>('overview');
  const [selectedTrackerView, setSelectedTrackerView] = useState<TrackerViewSelection>('trade_log');

  return (
    <Tabs defaultValue="ai_chat" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="tech_widget"><Cpu className="mr-2" />Tech</TabsTrigger>
        <TabsTrigger value="ai_chat"><MessageCircle className="mr-2" />AI Chat</TabsTrigger>
        <TabsTrigger value="trade_tracker"><ClipboardList className="mr-2" />Tracker</TabsTrigger>
      </TabsList>

      <TabsContent value="tech_widget" className="mt-0 flex-grow flex flex-col overflow-hidden">
        <div className="p-2 border-b border-border">
          <Select value={selectedTechWidget} onValueChange={(value) => setSelectedTechWidget(value as TechWidgetSelection)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Tech Widget" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview"><Settings className="mr-2 h-4 w-4 inline-block" />Tech Overview</SelectItem>
              <SelectItem value="technical_analysis"><TrendingUp className="mr-2 h-4 w-4 inline-block" />Technical Analysis</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-grow overflow-hidden min-h-0">
            {selectedTechWidget === 'overview' && <TechWidgetContent />}
            {selectedTechWidget === 'technical_analysis' && <TradingViewTechAnalysisWidget />}
        </div>
      </TabsContent>

      <TabsContent value="ai_chat" className="mt-0 flex-grow flex flex-col overflow-hidden">
        <AiWebchat />
      </TabsContent>

      <TabsContent value="trade_tracker" className="mt-0 flex-grow flex flex-col overflow-hidden">
        <div className="p-2 border-b border-border">
          <Select value={selectedTrackerView} onValueChange={(value) => setSelectedTrackerView(value as TrackerViewSelection)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Tracker View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trade_log"><ClipboardList className="mr-2 h-4 w-4 inline-block" />Trade Log</SelectItem>
              <SelectItem value="kucoin_panel"><Coins className="mr-2 h-4 w-4 inline-block" />Kucoin Trade Panel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-grow overflow-hidden min-h-0">
            {selectedTrackerView === 'trade_log' && <TradeTracker />}
            {selectedTrackerView === 'kucoin_panel' && <KucoinTradePanel />}
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default MiniWidgets;
