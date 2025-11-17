
"use client";

import React, { useEffect, useRef } from 'react';
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
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { usePaperTrading } from '@/context/PaperTradingContext';

interface BillingPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const BillingPopup: React.FC<BillingPopupProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useUser();
  const { balance } = usePaperTrading(); // Assuming balance comes from here
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState<string | null>(null);
  
  // Use a ref to store the unsubscribe function
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Effect to listen for the checkout URL on the user's main context document
  useEffect(() => {
    if (!user || !firestore || !isOpen) return;

    const userContextRef = doc(firestore, `users/${user.uid}/paperTradingContext/main`);
    
    // Start listening when the dialog opens
    const unsubscribe = onSnapshot(userContextRef, (snap) => {
        const data = snap.data();
        const checkoutUrl = data?.activeCheckoutUrl;

        if (checkoutUrl) {
            console.log("[BillingPopup] Active checkout URL found. Redirecting...");
            // Redirect the user
            window.location.assign(checkoutUrl);
            
            // Clean up the field in Firestore so we don't redirect again on next load
            updateDoc(userContextRef, {
                activeCheckoutUrl: null,
                activeCheckoutId: null,
            });

            // Stop listening
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
        }
    }, (err) => {
        console.error("[BillingPopup] Firestore listener error:", err);
        toast({ title: "Real-time Listener Error", description: "Could not listen for checkout updates.", variant: "destructive"});
        setIsLoading(null);
    });

    unsubscribeRef.current = unsubscribe;

    // Cleanup function to unsubscribe when the component unmounts or the dialog closes
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user, firestore, isOpen, toast]);


  const handlePurchase = async (productId: string) => {
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be signed in to make a purchase.", variant: "destructive" });
      return;
    }

    setIsLoading(productId);
    console.log(`[BillingPopup] Starting purchase for productId: ${productId}`);

    try {
      const idToken = await user.getIdToken();

      // Call the secure backend Cloud Function to create the checkout document.
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
      
      console.log("[BillingPopup] Backend function acknowledged. Now listening for URL...");
      // The useEffect listener is already active and will handle the redirect.

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
