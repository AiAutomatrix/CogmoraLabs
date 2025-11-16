
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
import { doc, onSnapshot, addDoc, collection } from 'firebase/firestore';

interface BillingPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

// NOTE: This now uses the client-side SDK to write to a collection that the
// Stripe Firebase Extension listens to. This bypasses the problematic API route.
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
        console.log(`[BillingPopup] Creating Firestore document in customers/${user.uid}/checkout_sessions`);
        
        const checkoutSessionRef = await addDoc(collection(firestore, 'customers', user.uid, 'checkout_sessions'), {
            price: 'price_1SREGsR1GTVMlhwAIHGT4Ofd', // Hardcoded Price ID for "AI Credit Pack"
            success_url: `${window.location.origin}/dashboard?payment=success`,
            cancel_url: `${window.location.origin}/dashboard?payment=cancelled`,
            metadata: {
                userId: user.uid,
                productId: productId,
            }
        });
        
        console.log(`[BillingPopup] Document created. Listening to path: ${checkoutSessionRef.path}`);

        const unsubscribe = onSnapshot(checkoutSessionRef, (snap) => {
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
            unsubscribe();
            console.error("[BillingPopup] Firestore onSnapshot listener error:", err);
            toast({ title: "Real-time Listener Error", description: "Could not listen for checkout session updates.", variant: "destructive"});
            setIsLoading(null);
        });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error('[BillingPopup] Purchase initiation failed:', err);
      toast({ title: 'Purchase Error', description: errorMessage, variant: 'destructive' });
      setIsLoading(null);
    }
  };


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
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
