
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
import { useUser, useFirestore, useFirebaseApp } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface BillingPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const BillingPopup: React.FC<BillingPopupProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState<string | null>(null);

  const handlePurchase = async (productId: string) => {
    if (!user || !firestore || !firebaseApp) {
      toast({ title: "Authentication Error", description: "You must be signed in to make a purchase.", variant: "destructive" });
      return;
    }
    
    setIsLoading(productId);
    console.log(`[BillingPopup] Starting purchase for productId: ${productId}`);

    try {
        const functions = getFunctions(firebaseApp); 
        const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');

        console.log('[BillingPopup] Calling createCheckoutSession Cloud Function...');
        const result = await createCheckoutSession({
            productId: productId,
        });

        const { firestoreDocPath } = result.data as { firestoreDocPath: string };
        console.log(`[BillingPopup] Cloud Function success. Listening to Firestore path: ${firestoreDocPath}`);

        if (!firestoreDocPath) {
            throw new Error("Cloud Function did not return a valid Firestore path.");
        }

        const unsubscribe = onSnapshot(doc(firestore, firestoreDocPath), (snap) => {
            const { error, url } = snap.data() || {};

            if (error) {
                unsubscribe();
                console.error(`[BillingPopup] Stripe Extension Error in Firestore doc:`, error);
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
