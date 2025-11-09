
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
import { useUser, useFirestore, usePaperTrading } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { loadStripe } from '@stripe/stripe-js';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';

interface BillingPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

// Load Stripe.js. Your public key must be in .env.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export const BillingPopup: React.FC<BillingPopupProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { resetAccount, balance } = usePaperTrading();
  const [isLoading, setIsLoading] = React.useState<string | null>(null);

  const handlePurchase = async (productId: string, priceId: string) => {
    if (!user || !firestore) {
      toast({ title: "Authentication Error", description: "You must be signed in to make a purchase.", variant: "destructive" });
      return;
    }
    
    setIsLoading(productId);

    try {
      // 1. Create a new document in the `checkout_sessions` collection in Firestore.
      // This is the trigger for the official "Run Payments with Stripe" Firebase Extension.
      const checkoutSessionRef = await addDoc(
        collection(firestore, 'users', user.uid, 'checkout_sessions'), 
        {
          price: priceId,
          success_url: `${window.location.origin}/dashboard?payment=success`,
          cancel_url: `${window.location.origin}/dashboard?payment=cancelled`,
          mode: 'payment', // Important: for one-time purchases
          metadata: {
             productId: productId, // Pass our internal product ID
          }
        }
      );

      // 2. Listen for the checkout URL to be added to the document by the extension.
      const unsubscribe = onSnapshot(checkoutSessionRef, async (snap) => {
        const { error, url } = snap.data() || {};
        
        if (error) {
          unsubscribe();
          throw new Error(`An error occurred: ${error.message}`);
        }

        if (url) {
          // 3. We have a URL, stop listening and redirect to Stripe.
          unsubscribe();
          window.location.assign(url);
        }
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error('Purchase Error:', errorMessage);
      toast({ title: 'Purchase Error', description: `Could not initiate checkout. ${errorMessage}`, variant: 'destructive' });
      setIsLoading(null);
    }
    // Note: We don't set isLoading to false here because the redirect will happen.
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
                <p className="text-sm text-muted-foreground">$5.00</p>
              </div>
              <Button onClick={() => handlePurchase('AI_CREDIT_PACK_100', 'price_1SREGsR1GTVMlhwAIHGT4Ofd')} disabled={isLoading === 'AI_CREDIT_PACK_100'}>
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
