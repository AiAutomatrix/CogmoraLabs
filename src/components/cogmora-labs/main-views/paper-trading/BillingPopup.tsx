
"use client";

import React, { useState, useEffect } from 'react';
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
import { collection, addDoc, onSnapshot, query, where, getDocs, limit } from 'firebase/firestore';

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
  const [priceId, setPriceId] = useState<string | null>(null);
  const [isPriceLoading, setIsPriceLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !firestore) {
      return;
    }

    const fetchPriceId = async () => {
      setIsPriceLoading(true);
      try {
        const productsRef = collection(firestore, 'products');
        const q = query(productsRef, where('active', '==', true), limit(1));
        const productSnap = await getDocs(q);

        if (productSnap.empty) {
          throw new Error("No active products found in Firestore.");
        }

        const productDoc = productSnap.docs[0];
        const pricesRef = collection(productDoc.ref, 'prices');
        const pricesQuery = query(pricesRef, where('active', '==', true), limit(1));
        const pricesSnap = await getDocs(pricesQuery);

        if (pricesSnap.empty) {
          throw new Error(`No active prices found for product ${productDoc.id}.`);
        }

        setPriceId(pricesSnap.docs[0].id);
      } catch (e: any) {
        console.error("[BillingPopup] Failed to fetch price ID:", e);
        toast({
          title: "Pricing Error",
          description: "Could not load product information. Please try again later.",
          variant: "destructive",
        });
        setPriceId(null);
      } finally {
        setIsPriceLoading(false);
      }
    };

    fetchPriceId();
  }, [isOpen, firestore, toast]);

  const handlePurchase = async (productId: string) => {
    console.log(`[BillingPopup] handlePurchase started for productId: ${productId}`);
    if (!user || !firestore) {
      toast({ title: "Authentication Error", description: "You must be signed in to make a purchase.", variant: "destructive" });
      console.error("[BillingPopup] User or Firestore not available.");
      return;
    }
    if (!priceId) {
      toast({ title: "Pricing Error", description: "Product price could not be loaded. Cannot proceed.", variant: "destructive" });
      return;
    }
    
    setIsLoading(productId);

    try {
      const checkoutSessionRef = collection(firestore, 'customers', user.uid, 'checkout_sessions');
      
      console.log(`[BillingPopup] Creating checkout session document at: ${checkoutSessionRef.path}`);
      const docRef = await addDoc(checkoutSessionRef, {
          price: priceId,
          success_url: window.location.href,
          cancel_url: window.location.href,
          metadata: {
            productId: productId,
            userId: user.uid,
          }
      });
      console.log(`[BillingPopup] Document created with ID: ${docRef.id}. Attaching snapshot listener...`);

      const unsubscribe = onSnapshot(docRef, async (snap) => {
          console.log("[BillingPopup] onSnapshot listener triggered.", snap.data());
          const { error, url } = snap.data() || {};

          if (error) {
              console.error(`[BillingPopup] Stripe Checkout Error from extension: ${error.message}`);
              toast({ title: 'Stripe Error', description: error.message, variant: 'destructive' });
              setIsLoading(null);
              unsubscribe();
          }

          if (url) { 
              console.log(`[BillingPopup] Received checkout URL. Redirecting...`);
              unsubscribe();
              window.location.assign(url);
          }
      }, (err) => {
        console.error("[BillingPopup] onSnapshot listener failed:", err);
        toast({ title: 'Listener Error', description: 'Could not listen for checkout session updates.', variant: 'destructive' });
        setIsLoading(null);
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error('[BillingPopup] Purchase Error:', errorMessage);
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
              <Button onClick={() => handlePurchase('AI_CREDIT_PACK_100')} disabled={isLoading === 'AI_CREDIT_PACK_100' || isPriceLoading}>
                {isPriceLoading || isLoading === 'AI_CREDIT_PACK_100' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
