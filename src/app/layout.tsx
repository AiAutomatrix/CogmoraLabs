
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FirebaseClientProvider } from '@/firebase';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Cogmora Labs - AI-Powered Crypto Trading & Analysis Platform',
    template: '%s | Cogmora Labs',
  },
  description: 'Cogmora Labs offers a comprehensive suite of AI-powered tools for cryptocurrency traders, including advanced charting, real-time spot and futures screeners, a DEX explorer, and a live paper trading engine to test your strategies risk-free.',
  keywords: [
    'crypto', 'trading', 'AI', 'screener', 'paper trading', 'technical analysis',
    'cryptocurrency', 'blockchain', 'market analysis', 'trading tools', 'financial charts',
    'DEX screener', 'futures trading', 'spot trading', 'KuCoin', 'TradingView'
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-0823M46Q58"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-0823M46Q58');
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased h-full flex flex-col bg-black text-white`}>
        <FirebaseClientProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
