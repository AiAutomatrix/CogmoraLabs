
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
    default: 'Cogmora Labs - AI Crypto Paper Trading & Analysis',
    template: '%s | Cogmora Labs',
  },
  description: 'An AI-powered cryptocurrency analysis and paper trading platform. Test strategies with a live paper trading engine, real-time screeners, advanced charting, and an autonomous AI agent.',
  keywords: [
    'crypto', 'trading', 'AI', 'paper trading', 'screener', 'technical analysis',
    'cryptocurrency', 'blockchain', 'market analysis', 'trading tools', 'financial charts',
    'DEX screener', 'futures trading', 'spot trading', 'KuCoin', 'TradingView', 'AI trading agent'
  ],
  openGraph: {
    title: 'Cogmora Labs - AI Crypto Paper Trading & Analysis',
    description: 'Test trading strategies with a live paper trading engine, real-time screeners, advanced charting, and an autonomous AI agent.',
    url: 'https://cogmora-labs.web.app', // Using a placeholder, but good practice
    siteName: 'Cogmora Labs',
    images: [
      {
        url: '/action-plan.jpg', // Main hero image for social sharing
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cogmora Labs - AI Crypto Paper Trading & Analysis',
    description: 'Test trading strategies with a live paper trading engine, real-time screeners, advanced charting, and an autonomous AI agent.',
    images: ['/action-plan.jpg'],
  },
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
