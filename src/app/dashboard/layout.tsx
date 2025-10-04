import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cogmora Labs - Dashboard',
  description: 'Cryptocurrency trading analysis and tracking platform',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
