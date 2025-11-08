
"use client";

import React, { useState } from 'react';
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
import { Bot, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BillingPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const BillingPopup: React.FC<BillingPopupProps> = ({ isOpen, onOpenChange }) => {
  const { toast } = useToast();
  const { equity, resetAccount } = usePaperTrading();

  const handleResetAccount = () => {
    resetAccount();
    onOpenChange(false);
    toast({
      title: "Account Reset Initiated",
      description: "Your balance and trade history are being cleared.",
    });
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
            {/* Simple form submission that posts directly to the API route */}
            <form action="/api/stripe/checkout_sessions" method="POST">
                <input type="hidden" name="productId" value="AI_CREDIT_PACK_100" />
                <Button type="submit">
                    Purchase
                </Button>
            </form>
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
