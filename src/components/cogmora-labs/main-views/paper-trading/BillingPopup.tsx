
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
import { Bot, Loader2 } from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';

interface BillingPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

// NOTE: The Price ID is hardcoded here for simplicity in this implementation.
// In a real-world scenario, you might fetch this from a configuration or your backend.
const AI_CREDIT_PRICE_ID = "price_1SREGsR1GTVMlhwAIHGT4Ofd";


export const BillingPopup: React.FC<BillingPopupProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useUser();
  const firestore = useFirestore(); // Get the firestore instance
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState<string | null>(null);

  const handlePurchase = async (productId: string) => {
    if (!user || !firestore) {
      toast({ title: "Authentication Error", description: "You must be signed in to make a purchase.", variant: "destructive" });
      return;
    }
    
    setIsLoading(productId);
    console.log(`[BillingPopup] Starting purchase for productId: ${productId}`);

    try {
      const priceId = AI_CREDIT_PRICE_ID;
      
      console.log(`[BillingPopup] Creating Firestore document in users/${user.uid}/checkout_sessions`);

      // 1. Directly create the document in Firestore from the client.
      const docRef = await addDoc(
        collection(firestore, "users", user.uid, "checkout_sessions"),
        {
          price: priceId,
          success_url: window.location.href, // Redirect back to the current page
          cancel_url: window.location.href,
          metadata: {
              userId: user.uid,
              productId: productId,
          }
        }
      );
      
      console.log(`[BillingPopup] Document created: ${docRef.path}. Now listening for Stripe URL...`);

      // 2. Listen to the document for the Stripe Extension to add the URL.
      const unsubscribe = onSnapshot(docRef, (snap) => {
        const { error, url } = snap.data() || {};

        if (error) {
          unsubscribe();
          console.error(`[BillingPopup] Stripe Extension Error: ${error.message}`);
          toast({ title: "Purchase Error", description: `Stripe Error: ${error.message}`, variant: "destructive" });
          setIsLoading(null);
          return;
        }

        if (url) {
          console.log("[BillingPopup] Stripe URL received. Redirecting...");
          unsubscribe();
          // Redirect the user to Stripe's checkout page.
          window.location.assign(url);
        }
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error('[BillingPopup] Purchase initiation failed:', errorMessage);
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
                {isLoading === 'AI_CREDIT_PACK_100' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
