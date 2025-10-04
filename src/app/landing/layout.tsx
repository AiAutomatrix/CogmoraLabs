import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cogmora Labs - AI-Powered Crypto Trading Tools',
  description: 'Explore advanced crypto trading analysis, real-time data screeners, and paper trading with Cogmora Labs. Trade smarter with AI insights.',
  keywords: ['crypto', 'trading', 'AI', 'screener', 'paper trading', 'technical analysis'],
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="bg-black text-white">{children}</div>;
}
