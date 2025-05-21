'use client';
import type React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cpu, MessageCircle, ClipboardList } from 'lucide-react';

import TechWidgetContent from './TechWidgetContent';
import AiWebchat from './AiWebchat';
import TradeTracker from './TradeTracker';

const MiniWidgets: React.FC = () => {
  const WIDGET_CONTAINER_CLASS = "h-full min-h-[500px] w-full";

  return (
    <Tabs defaultValue="ai_chat" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="tech_widget"><Cpu className="mr-2" />Tech</TabsTrigger>
        <TabsTrigger value="ai_chat"><MessageCircle className="mr-2" />AI Chat</TabsTrigger>
        <TabsTrigger value="trade_tracker"><ClipboardList className="mr-2" />Tracker</TabsTrigger>
      </TabsList>
      <TabsContent value="tech_widget" className={`flex-grow overflow-auto ${WIDGET_CONTAINER_CLASS}`}>
        <TechWidgetContent />
      </TabsContent>
      <TabsContent value="ai_chat" className={`flex-grow overflow-hidden ${WIDGET_CONTAINER_CLASS}`}>
        <AiWebchat />
      </TabsContent>
      <TabsContent value="trade_tracker" className={`flex-grow overflow-hidden ${WIDGET_CONTAINER_CLASS}`}>
        <TradeTracker />
      </TabsContent>
    </Tabs>
  );
};

export default MiniWidgets;
