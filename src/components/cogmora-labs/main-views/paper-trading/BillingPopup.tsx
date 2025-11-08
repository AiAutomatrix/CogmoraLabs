
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
import { usePaperTrading, useAuth } from '@/context/PaperTradingContext';
import { Bot, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface BillingPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const BillingPopup: React.FC<BillingPopupProps> = ({ isOpen, onOpenChange }) => {
  const { resetAccount, equity } = usePaperTrading();
  const { toast } = useToast();
  const auth = useAuth();
  const [isCheckoutLoading, setIsCheckoutLoading] = React.useState(false);

  const handleStripeCheckout = async () => {
    setIsCheckoutLoading(true);
    toast({ title: 'Redirecting to checkout...' });
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
        toast({ title: 'Authentication Error', description: 'You must be signed in to make a purchase.', variant: 'destructive'});
        setIsCheckoutLoading(false);
        return;
    }

    try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch('/api/stripe/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }

        const { url } = await response.json();
        if (url) {
            window.location.href = url;
        } else {
            throw new Error('Failed to get checkout URL.');
        }

    } catch (error: any) {
        console.error('Stripe checkout failed:', error);
        toast({
            title: 'Checkout Failed',
            description: error.message || 'Please try again later.',
            variant: 'destructive',
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
                    <p className="text-sm text-muted-foreground">$5.00</p>
                </div>
                 <Button onClick={handleStripeCheckout} disabled={isCheckoutLoading}>
                    {isCheckoutLoading ? 'Processing...' : 'Purchase'}
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
