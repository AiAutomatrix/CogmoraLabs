import { Coins } from 'lucide-react';
import type React from 'react';

const TradeFlowLogo: React.FC = () => {
  return (
    <div className="flex items-center gap-2">
      <Coins className="h-8 w-8 text-primary" />
      <h1 className="text-2xl font-bold text-foreground">TradeFlow</h1>
    </div>
  );
};

export default TradeFlowLogo;
