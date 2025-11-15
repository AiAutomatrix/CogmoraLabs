
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
import { Bot, Loader2, CreditCard } from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
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
  const [isLoading, setIsLoading] = React.useState<string | null>(null);

  const handlePurchase = async (productId: string) => {
    if (!user || !firestore) {
      toast({ title: "Authentication Error", description: "You must be signed in to make a purchase.", variant: "destructive" });
      return;
    }
    
    setIsLoading(productId);

    try {
      const idToken = await user.getIdToken();
      
      const response = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ productId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create checkout session.');
      }
      
      const { firestoreDocPath } = data;
      if (!firestoreDocPath) {
          throw new Error('Did not receive Firestore document path from server.');
      }
      
      // Listen to the document for the Stripe URL
      const docRef = doc(firestore, firestoreDocPath);
      const unsubscribe = onSnapshot(docRef, async (snap) => {
        const { error, url } = snap.data() || {};

        if (error) {
          unsubscribe();
          throw new Error(error.message);
        }

        if (url) {
          unsubscribe();
          window.location.assign(url);
        }
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error('Purchase Error:', errorMessage);
      toast({ title: 'Purchase Error', description: errorMessage, variant: 'destructive' });
      setIsLoading(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buy AI Credits</DialogTitle>
          <DialogDescription>
            Purchase AI credits to continue using the AI Trading Agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            <div className="p-4 border rounded-lg flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center"><Bot className="mr-2 h-4 w-4" /> Add 100 AI Credits</h3>
                <p className="text-sm text-muted-foreground">$29.99 CAD</p>
              </div>
              <Button onClick={() => handlePurchase('AI_CREDIT_PACK_100')} disabled={isLoading === 'AI_CREDIT_PACK_100'}>
                {isLoading === 'AI_CREDIT_PACK_100' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                Purchase
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
