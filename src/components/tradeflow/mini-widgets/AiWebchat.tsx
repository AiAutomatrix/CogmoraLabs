
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { marketAnalysisQuery, type MarketAnalysisQueryInput } from '@/ai/flows/market-analysis-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bot, User, Loader2 } from 'lucide-react';
import type { ChatMessage } from '@/types';
import { useToast } from "@/hooks/use-toast";

// This component is NOW the original custom AI chat, NOT Botpress.
// The onSymbolSubmit prop is used by this custom chat.
interface AiWebchatProps {
  onSymbolSubmit?: (symbol: string) => void;
}

const AiWebchat: React.FC<AiWebchatProps> = ({ onSymbolSubmit }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cryptocurrency, setCryptocurrency] = useState<string>('BTCUSDT');
  const [userQuery, setUserQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim() || !cryptocurrency.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both a cryptocurrency symbol and your query.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    if (onSymbolSubmit) {
      onSymbolSubmit(cryptocurrency);
    }

    const newUserMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: `Analysis for ${cryptocurrency}: ${userQuery}`,
      timestamp: new Date(),
    };
    setMessages((prevMessages) => [...prevMessages, newUserMessage]);
    setUserQuery('');
    setIsLoading(true);

    try {
      const input: MarketAnalysisQueryInput = {
        cryptocurrency: cryptocurrency,
        userQuery: userQuery,
        // tradingViewData: "..." // If you plan to send chart data
      };
      const result = await marketAnalysisQuery(input);
      const aiResponse: ChatMessage = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: result.analysis,
        timestamp: new Date(),
      };
      setMessages((prevMessages) => [...prevMessages, aiResponse]);
    } catch (error) {
      console.error('Error fetching AI analysis:', error);
      const errorResponse: ChatMessage = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: 'Sorry, I encountered an error trying to get analysis. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prevMessages) => [...prevMessages, errorResponse]);
      toast({
        title: "AI Error",
        description: "Could not fetch analysis from AI. Check console for details.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="h-full flex flex-col rounded-none border-0 shadow-none">
      <CardHeader className="px-3 pt-1 pb-2 border-b">
        <CardTitle className="text-lg">AI Market Analysis</CardTitle>
        <CardDescription className="text-xs">Ask about cryptocurrency market trends. Symbol affects chart.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col gap-2 overflow-hidden min-h-0 p-0">
        <ScrollArea className="flex-grow p-3 min-h-0">
          {messages.length === 0 && <p className="text-muted-foreground text-center text-sm">No messages yet. Ask a question!</p>}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 mb-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && <Bot className="h-6 w-6 text-primary flex-shrink-0" />}
              <div
                className={`p-3 rounded-lg max-w-[80%] text-sm ${
                  msg.sender === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                <p>{msg.text}</p>
                <p className={`text-xs mt-1 ${ msg.sender === 'user' ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground/70'}`}>
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
              {msg.sender === 'user' && <User className="h-6 w-6 text-accent flex-shrink-0" />}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start gap-2 mb-3">
              <Bot className="h-6 w-6 text-primary flex-shrink-0" />
              <div className="p-3 rounded-lg bg-secondary text-secondary-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            </div>
          )}
        </ScrollArea>
        <form onSubmit={handleSubmit} className="p-3 space-y-2 border-t">
          <Input
            type="text"
            placeholder="Cryptocurrency (e.g., BTCUSDT)"
            value={cryptocurrency}
            onChange={(e) => setCryptocurrency(e.target.value.toUpperCase())}
            disabled={isLoading}
            aria-label="Cryptocurrency Symbol"
            className="h-9"
          />
          <Textarea
            placeholder="Your query (e.g., What are the short-term prospects?)"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            disabled={isLoading}
            rows={2}
            aria-label="Your Query"
          />
          <Button type="submit" disabled={isLoading} className="w-full h-9">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send Query'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AiWebchat;
