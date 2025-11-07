
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
import { Bot, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BillingPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const BillingPopup: React.FC<BillingPopupProps> = ({ isOpen, onOpenChange }) => {
  const { addAiCredits, resetAccount, equity } = usePaperTrading();
  const { toast } = useToast();
  
  const handleAddCredits = () => {
    addAiCredits(100);
    toast({ title: 'Success', description: '100 AI credits added.' });
    onOpenChange(false);
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
            Add AI credits or reset your account. In a real app, this would use Stripe for payments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            <div className="p-4 border rounded-lg flex items-center justify-between">
                <div>
                    <h3 className="font-semibold flex items-center"><Bot className="mr-2 h-4 w-4" /> Add 100 AI Credits</h3>
                    <p className="text-sm text-muted-foreground">$5.00 (placeholder price)</p>
                </div>
                <Button onClick={handleAddCredits}>Purchase</Button>
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
