
import type React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

const DashboardContent: React.FC = () => {
  return (
    <Card className="h-full overflow-auto"> {/* Ensure card itself can scroll if content exceeds */}
      <CardHeader>
        <CardTitle>Dashboard Overview</CardTitle>
        <CardDescription>Your trading performance at a glance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Trades</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5</div>
              <p className="text-xs text-muted-foreground">+2 since last week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open P&L</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">+$1,250.75</div>
              <p className="text-xs text-muted-foreground">Based on current prices</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Risk Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1</div>
              <p className="text-xs text-muted-foreground">ETH/USDT near stop loss</p>
            </CardContent>
          </Card>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-2">Portfolio Distribution</h3>
          <Image src="https://placehold.co/800x400.png" alt="Portfolio Distribution Chart" data-ai-hint="pie chart" width={800} height={400} className="rounded-md" />
        </div>

        <p className="text-center text-lg font-semibold py-8">More detailed dashboard features coming soon!</p>
      </CardContent>
    </Card>
  );
};

export default DashboardContent;
