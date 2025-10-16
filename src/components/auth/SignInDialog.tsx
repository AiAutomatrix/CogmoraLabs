
'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { Separator } from '../ui/separator';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';

interface SignInDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

type FormValues = z.infer<typeof formSchema>;

export const SignInDialog: React.FC<SignInDialogProps> = ({ isOpen, onOpenChange }) => {
  const auth = useAuth();
  const { toast } = useToast();
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleEmailSignIn = async (data: FormValues) => {
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast({
        title: 'Sign In Failed',
        description: error.message || 'Please check your credentials and try again.',
        variant: 'destructive',
      });
    }
  };
  
  const handleEmailSignUp = async (data: FormValues) => {
    try {
      await createUserWithEmailAndPassword(auth, data.email, data.password);
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      console.error('Sign up error:', error);
      toast({
        title: 'Sign Up Failed',
        description: error.message || 'Could not create an account.',
        variant: 'destructive',
      });
    }
  };

  const handleForgotPassword = async () => {
    const email = form.getValues('email');
    if (!email) {
      form.setError('email', { type: 'manual', message: 'Please enter your email to reset password.' });
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: 'Password Reset Email Sent',
        description: 'Please check your inbox for instructions to reset your password.',
      });
      setIsForgotPassword(false);
      form.reset();
    } catch (error: any) {
      console.error('Forgot password error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Could not send password reset email.',
        variant: 'destructive',
      });
    }
  };


  const handleAnonymousSignIn = () => {
    initiateAnonymousSignIn(auth);
  };
  
  const handleClose = (open: boolean) => {
    if (!open) {
      form.reset();
      setIsForgotPassword(false);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
             {isForgotPassword ? 'Reset Your Password' : 'Welcome to Cogmora Labs'}
          </DialogTitle>
          <DialogDescription>
            {isForgotPassword 
              ? 'Enter your email to receive a password reset link.' 
              : 'Sign in or create an account to sync your portfolio.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
            <form onSubmit={form.handleSubmit(isForgotPassword ? handleForgotPassword : handleEmailSignIn)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="name@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!isForgotPassword && (
                 <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              )}
             
             {isForgotPassword ? (
                <div className="flex flex-col space-y-2">
                    <Button type="button" onClick={handleForgotPassword}>Send Reset Email</Button>
                    <Button type="button" variant="link" onClick={() => { setIsForgotPassword(false); form.reset(); }}>Back to Sign In</Button>
                </div>
             ) : (
                <div className="flex flex-col space-y-2">
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1">Sign In</Button>
                      <Button type="button" variant="secondary" className="flex-1" onClick={form.handleSubmit(handleEmailSignUp)}>Create Account</Button>
                    </div>
                     <Button type="button" variant="link" className="text-xs text-muted-foreground" onClick={() => setIsForgotPassword(true)}>
                        Forgot Password?
                    </Button>
                </div>
             )}
            </form>
        </Form>
        
        <Separator />
        
        <div className="flex flex-col space-y-2">
            <Button onClick={handleAnonymousSignIn} variant="outline">
                Continue as Guest
            </Button>
            <p className="text-xs text-muted-foreground text-center">
                Guest accounts are stored only on this device and will not be synced.
            </p>
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default SignInDialog;
