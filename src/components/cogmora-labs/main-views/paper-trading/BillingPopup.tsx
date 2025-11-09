
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
import { collection, addDoc, onSnapshot } from 'firebase/firestore';

interface BillingPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

// The publishable key is safe to be included in client-side code.
const stripePromise = loadStripe("pk_test_51SREAlR1GTVMlhwAIotsbUvdCPhwra3r7i0wsWC0PbIAkg7YdnGCCQaizXkDFBl7qmlWKsvj2aVpVn5rGjHFPUuN00DWxAJ7Qb");

export const BillingPopup: React.FC<BillingPopupProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { resetAccount, balance } = usePaperTrading();
  const [isLoading, setIsLoading] = React.useState<string | null>(null);

  const handlePurchase = async (productId: string) => {
    if (!user || !firestore) {
      toast({ title: "Authentication Error", description: "You must be signed in to make a purchase.", variant: "destructive" });
      return;
    }
    
    setIsLoading(productId);

    try {
        // This is the Price ID from your Stripe dashboard for the "AI Credit Pack" product.
        const priceId = "price_1SREGsR1GTVMlhwAIHGT4Ofd"; 

        const checkoutSessionsRef = collection(firestore, 'users', user.uid, 'checkout_sessions');
        const docRef = await addDoc(checkoutSessionsRef, {
            price: priceId,
            success_url: window.location.href, // Redirect back to the current page on success
            cancel_url: window.location.href,  // Redirect back on cancellation
            metadata: {
              productId: productId,
              userId: user.uid,
            }
        });

        // Listen for the session ID to be added by the extension
        const unsubscribe = onSnapshot(docRef, async (snap) => {
            const { error, sessionId } = snap.data() || {};

            if (error) {
                console.error(`Stripe Checkout Error from extension: ${error.message}`);
                toast({ title: 'Stripe Error', description: error.message, variant: 'destructive' });
                setIsLoading(null);
                unsubscribe();
            }

            if (sessionId) { 
                // We have a session ID, let's redirect to Stripe Checkout.
                unsubscribe();
                const stripe = await stripePromise;
                if (!stripe) {
                    throw new Error('Stripe.js has not loaded yet.');
                }
                
                await stripe.redirectToCheckout({ sessionId });
                // No need to setIsLoading(null) here as the page will redirect.
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
    resetAccount();
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
              <Button onClick={handleReset} variant="destructive" disabled={balance > 5000}>
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
