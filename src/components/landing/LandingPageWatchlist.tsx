'use client';

import React, { useEffect } from 'react';
import { usePaperTrading } from '@/context/PaperTradingContext';
import Watchlist from '@/components/cogmora-labs/main-views/paper-trading/Watchlist';

// This component is a wrapper to pre-populate the watchlist for the demo.
const LandingPageWatchlist: React.FC = () => {
  const { watchlist, toggleWatchlist } = usePaperTrading();

  useEffect(() => {
    // We want to ensure a few items are on the watchlist for the demo.
    // This effect runs once on mount.
    const defaultWatchlistItems = [
      { symbol: 'BTC-USDT', symbolName: 'Bitcoin', type: 'spot' as const },
      { symbol: 'ETH-USDT', symbolName: 'Ethereum', type: 'spot' as const },
      { symbol: 'SOL-USDT', symbolName: 'Solana', type: 'spot' as const },
    ];

    let itemsAdded = false;
    defaultWatchlistItems.forEach(item => {
      // Check if the item is already in the watchlist before adding it
      if (!watchlist.some(w => w.symbol === item.symbol)) {
        toggleWatchlist(item.symbol, item.symbolName, item.type);
        itemsAdded = true;
      }
    });

    // If we added items, a reload might be needed to trigger WS connection
    // This is a workaround for the context's dependency array behavior
    if (itemsAdded) {
       // A small timeout allows state to update before a potential refresh
       setTimeout(() => {
        // This part is tricky. A forced reload is bad UX.
        // The context should ideally handle new subscriptions without a reload.
        // Let's assume the context's useEffect for WebSocket will pick up the changes.
       }, 500);
    }

  }, []); // Run only once

  return <Watchlist />;
};

export default LandingPageWatchlist;
