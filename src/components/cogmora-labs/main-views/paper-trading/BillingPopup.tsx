
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
import { Bot } from 'lucide-react';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

interface BillingPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const BillingPopup: React.FC<BillingPopupProps> = ({ isOpen, onOpenChange }) => {
  const auth = useAuth();
  const { toast } = useToast();
  const [isRedirecting, setIsRedirecting] = React.useState(false);

  const handlePurchase = async () => {
    setIsRedirecting(true);
    const user = auth.currentUser;
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be signed in to make a purchase.", variant: "destructive" });
      setIsRedirecting(false);
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          priceId: 'price_1SREGsR1GTVMlhwAIHGT4Ofd', // Using the correct hardcoded price ID
          productId: 'AI_CREDIT_PACK_100', 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || 'Failed to create checkout session.');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned from server.');
      }
    } catch (error: any) {
      console.error('Purchase Error:', error);
      toast({
        title: "Purchase Failed",
        description: error.message || "Could not initiate the purchase. Please try again.",
        variant: "destructive",
      });
      setIsRedirecting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Account Actions</DialogTitle>
          <DialogDescription>
            Purchase AI credits to continue using the AI agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 border rounded-lg flex items-center justify-between">
            <div>
              <h3 className="font-semibold flex items-center"><Bot className="mr-2 h-4 w-4" /> Add 100 AI Credits</h3>
              <p className="text-sm text-muted-foreground">$30 CAD</p>
            </div>
            <Button onClick={handlePurchase} disabled={isRedirecting}>
              {isRedirecting ? 'Redirecting...' : 'Purchase'}
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
