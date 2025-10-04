
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Trading Dashboard',
  description: 'Access the main trading terminal with live charts, paper trading, screeners, and AI analysis tools.',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
