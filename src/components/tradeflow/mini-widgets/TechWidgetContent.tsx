
import type React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cpu, Wifi } from 'lucide-react';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';


const TechWidgetContent: React.FC = () => {
  return (
    <Card className="h-full flex flex-col rounded-none border-0 shadow-none">
      <CardHeader className="px-3 py-2 border-b">
        <CardTitle>Tech Overview</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col p-3 overflow-y-auto min-h-0">
        <ScrollArea className="flex-grow min-h-0"> {/* ScrollArea takes grow, internal content scrolls */}
          <p className="text-muted-foreground text-sm mb-4">System status and technical indicators relevant to trading operations.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <Card className="bg-card-foreground/5">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">API Latency</CardTitle>
                      <Wifi className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                      <div className="text-2xl font-bold">15ms</div>
                      <p className="text-xs text-muted-foreground">Exchange: Binance</p>
                  </CardContent>
              </Card>
              <Card className="bg-card-foreground/5">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Server Load</CardTitle>
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                      <div className="text-2xl font-bold">35%</div>
                      <p className="text-xs text-muted-foreground">Strategy Engine</p>
                  </CardContent>
              </Card>
          </div>

          <div className="mb-4">
              <h3 className="text-md font-semibold mb-2">Market Data Feed Status</h3>
              <Image src="https://placehold.co/400x200.png" alt="Market Data Feed" data-ai-hint="network status" width={400} height={200} className="rounded-md w-full object-cover" />
              <p className="text-sm text-green-400 mt-1">All systems operational.</p>
          </div>

          <p className="text-center text-muted-foreground text-sm py-4">More technical indicators coming soon!</p>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default TechWidgetContent;
