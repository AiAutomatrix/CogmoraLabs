
'use client';
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cpu, MessageCircle, ClipboardList } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import TechWidgetContent from './TechWidgetContent';
import AiWebchat from './AiWebchat';
import TradeTracker from './TradeTracker';
import TradingViewTechAnalysisWidget from './TradingViewTechAnalysisWidget';

type TechWidgetSelection = 'overview' | 'technical_analysis';

const MiniWidgets: React.FC = () => {
  const [selectedTechWidget, setSelectedTechWidget] = useState<TechWidgetSelection>('overview');

  return (
    <Tabs defaultValue="ai_chat" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="tech_widget"><Cpu className="mr-2" />Tech</TabsTrigger>
        <TabsTrigger value="ai_chat"><MessageCircle className="mr-2" />AI Chat</TabsTrigger>
        <TabsTrigger value="trade_tracker"><ClipboardList className="mr-2" />Tracker</TabsTrigger>
      </TabsList>

      <TabsContent value="tech_widget" className="flex-grow flex flex-col overflow-hidden">
        <div className="p-2 border-b border-border">
            <Select value={selectedTechWidget} onValueChange={(value) => setSelectedTechWidget(value as TechWidgetSelection)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Tech Widget" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Tech Overview</SelectItem>
                <SelectItem value="technical_analysis">Technical Analysis</SelectItem>
              </SelectContent>
            </Select>
        </div>
        <div className="flex-grow overflow-hidden"> {/* This div will contain the selected widget and allow it to grow */}
            {selectedTechWidget === 'overview' && <TechWidgetContent />}
            {selectedTechWidget === 'technical_analysis' && <TradingViewTechAnalysisWidget />}
        </div>
      </TabsContent>

      <TabsContent value="ai_chat" className="flex-grow overflow-hidden">
        <AiWebchat />
      </TabsContent>
      <TabsContent value="trade_tracker" className="flex-grow overflow-hidden">
        <TradeTracker />
      </TabsContent>
    </Tabs>
  );
};

export default MiniWidgets;
