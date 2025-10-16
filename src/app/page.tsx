
'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LandingPageDemoProvider } from '@/context/LandingPageDemoContext';
import LandingPageWatchlist from '@/components/landing/LandingPageWatchlist';
import Features from '@/components/landing/Features';
import { Github, Twitter } from 'lucide-react';
import { SignInDialog } from '@/components/auth/SignInDialog';
import { FirebaseClientProvider, useUser } from '@/firebase';
import { useRouter } from 'next/navigation';

const HeroContent: React.FC = () => {
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  // This effect will watch for a user to be logged in, and then redirect to the dashboard.
  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  return (
    <>
      <section className="h-[60vh] flex flex-col justify-center items-center text-center p-4" style={{ 
          backgroundImage: `
            linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2)),
            url('/lottie/hero.png')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Welcome to Cogmora Labs</h1>
        <p className="text-lg md:text-xl text-white mb-8 max-w-2xl mx-auto">
          The ultimate AI-powered toolkit for cryptocurrency analysis and paper trading. 
          Explore real-time screeners, advanced charting, and test your strategies risk-free.
        </p>
        <div className="flex gap-4">
          <Link href="/dashboard" passHref>
            <Button size="lg" variant="default">
              Launch the App
            </Button>
          </Link>
          <Button size="lg" variant="secondary" onClick={() => setIsSignInOpen(true)}>
            Sign In
          </Button>
        </div>
      </section>
      <SignInDialog isOpen={isSignInOpen} onOpenChange={setIsSignInOpen} />
    </>
  );
}

// Live Demo Section Component
const LiveDemo = () => (
  <section className="py-20 px-4">
    <div className="container mx-auto text-center">
      <h2 className="text-4xl font-bold mb-4">Live Watchlist Demo</h2>
      <p className="text-muted-foreground mb-8 max-w-3xl mx-auto">
        This is a live, real-time demonstration of our watchlist component, powered by the same engine used in the main application. Add symbols like BTC-USDT, ETH-USDT, or SOL-USDT to see it in action.
      </p>
      <div className="max-w-4xl mx-auto">
        <LandingPageDemoProvider>
          <LandingPageWatchlist />
        </LandingPageDemoProvider>
      </div>
    </div>
  </section>
);

// Footer Component
const Footer = () => (
    <footer className="border-t border-border/20 py-8">
        <div className="container mx-auto text-center text-muted-foreground">
            <div className="flex justify-center gap-6 mb-4">
                <Link href="#" className="hover:text-white"><Github /></Link>
                <Link href="#" className="hover:text-white"><Twitter /></Link>
            </div>
            <p>&copy; {new Date().getFullYear()} Cogmora Labs. All Rights Reserved.</p>
        </div>
    </footer>
);


export default function LandingPage() {
  return (
    <main>
      <FirebaseClientProvider>
        <HeroContent />
        <LiveDemo />
        <Features />
        <Footer />
      </FirebaseClientProvider>
    </main>
  );
}
