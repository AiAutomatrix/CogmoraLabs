
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { usePaperTrading } from '@/context/PaperTradingContext';
import { useAuth } from '@/firebase';
import { Bot, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BillingPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const BillingPopup: React.FC<BillingPopupProps> = ({ isOpen, onOpenChange }) => {
  const { equity, resetAccount } = usePaperTrading();
  const auth = useAuth();
  const { toast } = useToast();
  const [isCheckoutLoading, setIsCheckoutLoading] = React.useState(false);

  const handleCheckout = async (productId: 'AI_CREDIT_PACK_100' | 'ACCOUNT_RESET') => {
    setIsCheckoutLoading(true);

    if (!auth.currentUser) {
      toast({ title: "Authentication Error", description: "You must be signed in to make a purchase.", variant: "destructive" });
      setIsCheckoutLoading(false);
      return;
    }

    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ productId }),
      });

      const session = await response.json();

      if (response.ok && session.url) {
        // Redirect to Stripe's checkout page
        window.location.href = session.url;
      } else {
        throw new Error(session.error?.message || 'Failed to create checkout session.');
      }
    } catch (error: any) {
      console.error("Stripe checkout error:", error);
      toast({
        title: "Checkout Error",
        description: error.message || "Could not connect to the payment processor.",
        variant: "destructive",
      });
      setIsCheckoutLoading(false);
    }
  };


  const handleResetAccount = () => {
    resetAccount();
    onOpenChange(false);
  };

  const isResetDisabled = equity >= 5000;

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
                    <p className="text-sm text-muted-foreground">$30 CAD</p>
                </div>
                <Button onClick={() => handleCheckout('AI_CREDIT_PACK_100')} disabled={isCheckoutLoading}>
                    {isCheckoutLoading ? 'Redirecting...' : 'Purchase'}
                </Button>
            </div>
        
         <div className="p-4 border rounded-lg flex items-center justify-between">
            <div>
                <h3 className="font-semibold flex items-center"><RefreshCw className="mr-2 h-4 w-4" /> Reset Account</h3>
                <p className="text-sm text-muted-foreground">Resets balance to $100,000 and clears trade history. Only available if equity is below $5,000.</p>
            </div>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isResetDisabled}>Reset</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                        This will permanently delete your trade history and reset your balance to $100,000. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetAccount}>Confirm Reset</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
