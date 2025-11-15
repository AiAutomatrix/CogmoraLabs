
"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bot, Loader2, RefreshCw } from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { usePaperTrading } from '@/context/PaperTradingContext';
import { useToast } from '@/hooks/use-toast';
import { loadStripe } from '@stripe/stripe-js';
import { doc, onSnapshot } from 'firebase/firestore';

interface BillingPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export const BillingPopup: React.FC<BillingPopupProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { resetAccount, balance } = usePaperTrading();
  const [isLoading, setIsLoading] = React.useState<string | null>(null);

  const handlePurchase = async (productId: string) => {
    console.log(`[BillingPopup] handlePurchase started for productId: ${productId}`);
    if (!user || !firestore) {
      toast({ title: "Authentication Error", description: "You must be signed in to make a purchase.", variant: "destructive" });
      return;
    }
    
    setIsLoading(productId);

    try {
      const idToken = await user.getIdToken();
      console.log("[BillingPopup] Got user ID token.");
      
      const response = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ productId }),
      });
      
      console.log(`[BillingPopup] API response status: ${response.status}`);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('[BillingPopup] API responded with an error:', errorBody);
        throw new Error(`Server responded with ${response.status}. Check console for details.`);
      }
      
      const { firestoreDocPath } = await response.json();
      console.log(`[BillingPopup] Received Firestore doc path: ${firestoreDocPath}. Listening for Stripe URL...`);

      // Listen to the Firestore document for the Stripe session URL
      const unsub = onSnapshot(doc(firestore, firestoreDocPath), async (snap) => {
        const data = snap.data();
        const { error, url } = data || {};

        if (error) {
          console.error(`[BillingPopup] Stripe Extension Error: ${error.message}`);
          toast({ title: 'Stripe Error', description: error.message, variant: 'destructive' });
          unsub(); // Stop listening
          setIsLoading(null);
        }

        if (url) {
          console.log('[BillingPopup] Stripe URL received. Redirecting to checkout...');
          unsub(); // Stop listening
          const stripe = await stripePromise;
          if (!stripe) {
            throw new Error('Stripe.js has not loaded yet.');
          }
          await stripe.redirectToCheckout({ sessionId: snap.id });
          // The user is redirected, so no need to set isLoading to null here.
        }
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error('Purchase Error:', errorMessage);
      toast({ title: 'Purchase Error', description: errorMessage, variant: 'destructive' });
      setIsLoading(null);
    }
  };

  const handleReset = () => {
    if (balance < 5000) {
      resetAccount();
    } else {
       toast({ title: "Reset Not Allowed", description: "You can only reset your account when your balance is below $5,000.", variant: "destructive" });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Account Actions</DialogTitle>
          <DialogDescription>
            Purchase AI credits or reset your paper trading account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            <div className="p-4 border rounded-lg flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center"><Bot className="mr-2 h-4 w-4" /> Add 100 AI Credits</h3>
                <p className="text-sm text-muted-foreground">$29.99 CAD</p>
              </div>
              <Button onClick={() => handlePurchase('AI_CREDIT_PACK_100')} disabled={isLoading === 'AI_CREDIT_PACK_100'}>
                {isLoading === 'AI_CREDIT_PACK_100' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Purchase
              </Button>
            </div>
             <div className="p-4 border rounded-lg flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center"><RefreshCw className="mr-2 h-4 w-4" /> Reset Account</h3>
                <p className="text-sm text-muted-foreground">Reset balance to $100k and clear history.</p>
              </div>
              <Button onClick={handleReset} variant="destructive" disabled={balance >= 5000}>
                Reset
              </Button>
            </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
