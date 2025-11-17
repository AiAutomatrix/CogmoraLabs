
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
import { doc, onSnapshot } from 'firebase/firestore';

interface BillingPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

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
      const idToken = await user.getIdToken();

      // Step 1: Call the secure backend Cloud Function to create the checkout document.
      const response = await fetch("https://handlecheckoutcreation-tzoen76fpa-uc.a.run.app", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ productId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Server responded with ${response.status}`);
      }
      
      // Step 2: The backend returns the path to the document it created.
      const { firestoreDocPath } = await response.json();
      if (!firestoreDocPath) {
        throw new Error("Backend did not return a valid document path.");
      }
      console.log(`[BillingPopup] Cloud Function created doc at path: ${firestoreDocPath}`);

      // Step 3: Listen to the specific document path for the redirect URL.
      const docRef = doc(firestore, firestoreDocPath);
      
      const unsubscribe = onSnapshot(docRef, (snap) => {
          const { error, url, sessionId } = snap.data() || {};

          if (error) {
              unsubscribe();
              console.error(`[BillingPopup] Stripe Extension Error:`, error);
              toast({ title: "Purchase Error", description: `Stripe Error: ${error.message}`, variant: "destructive" });
              setIsLoading(null);
              return;
          }

          // Step 4: When the Stripe Extension populates the URL, redirect the user.
          if (sessionId || url) {
              console.log("[BillingPopup] Stripe URL/Session received. Redirecting...");
              unsubscribe();
              const redirectUrl = url || `https://checkout.stripe.com/pay/${sessionId}`;
              window.location.assign(redirectUrl);
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
