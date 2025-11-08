
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
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

interface BillingPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const BillingPopup: React.FC<BillingPopupProps> = ({ isOpen, onOpenChange }) => {
  const { user } = useUser();
  const { toast } = useToast();

  // This component now uses a simple form submission, so the complex handlePurchase function is removed.

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
            {/* The form will POST to the API route which handles the redirect */}
            <form action="/api/stripe/checkout_sessions" method="POST">
              <div className="p-4 border rounded-lg flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center"><Bot className="mr-2 h-4 w-4" /> Add 100 AI Credits</h3>
                  <p className="text-sm text-muted-foreground">$5.00</p>
                </div>
                <Button type="submit">
                  Purchase
                </Button>
              </div>
            </form>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
