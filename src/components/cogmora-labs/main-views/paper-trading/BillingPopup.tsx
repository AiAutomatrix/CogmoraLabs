
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

const AI_CREDIT_PRICE_ID = "price_1SREGsR1GTVMlhwAIHGT4Ofd";


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
    console.log(`[BillingPopup] Starting purchase for productId: ${productId}`);

    try {
      const priceId = AI_CREDIT_PRICE_ID;
      
      // CRITICAL FIX: Write to the 'customers' collection, which is the default the Stripe Extension watches.
      console.log(`[BillingPopup] Creating Firestore document in customers/${user.uid}/checkout_sessions`);

      const docRef = await addDoc(
        collection(firestore, "customers", user.uid, "checkout_sessions"),
        {
          price: priceId,
          success_url: window.location.href,
          cancel_url: window.location.href,
          metadata: {
              userId: user.uid,
              productId: productId,
          }
        }
      );
      
      console.log(`[BillingPopup] Document created: ${docRef.path}. Now listening for Stripe URL...`);

      const unsubscribe = onSnapshot(docRef, (snap) => {
        const { error, url } = snap.data() || {};

        if (error) {
          unsubscribe();
          console.error(`[BillingPopup] Stripe Extension Error:`, error);
          toast({ title: "Purchase Error", description: `Stripe Error: ${error.message}`, variant: "destructive" });
          setIsLoading(null);
          return;
        }

        if (url) {
          console.log("[BillingPopup] Stripe URL received. Redirecting...");
          unsubscribe();
          window.location.assign(url);
        }
      }, (err) => {
        console.error("[BillingPopup] onSnapshot listener error:", err);
        toast({ title: "Listener Error", description: "Could not listen for checkout session updates.", variant: "destructive"});
        setIsLoading(null);
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error('[BillingPopup] Purchase initiation failed:', err);
      // Let's log the full error object to see if it's a Firestore permission issue
      console.error(err);
      
      // We are trying to read the body of a 500 error, which isn't JSON.
      // We need to read it as text.
      if (err instanceof TypeError && err.message.includes("not valid JSON")) {
          toast({ title: 'Purchase Error', description: "Server returned a non-JSON error. Check console for details.", variant: 'destructive' });
      } else {
          toast({ title: 'Purchase Error', description: errorMessage, variant: 'destructive' });
      }
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
