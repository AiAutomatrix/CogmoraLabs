import TradeFlowLogo from '@/components/tradeflow/TradeFlowLogo';
import MainViews from '@/components/tradeflow/MainViews';
import MiniWidgets from '@/components/tradeflow/MiniWidgets';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="p-4 border-b border-border shadow-md sticky top-0 bg-background z-50">
        <div className="container mx-auto">
          <TradeFlowLogo />
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-6 h-full"> {/* Changed flex-grow to h-full for more explicit height */}
          <section className="lg:col-span-2 h-full flex flex-col">
            <MainViews />
          </section>
          <aside className="lg:col-span-1 h-full flex flex-col">
            <MiniWidgets />
          </aside>
        </div>
      </main>

      <footer className="p-4 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} TradeFlow. All rights reserved. Market data provided by TradingView.
        </p>
      </footer>
    </div>
  );
}
