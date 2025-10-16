
'use client';
    
import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/firebase';

export interface UseUser {
  user: User | null;
  isUserLoading: boolean;
}

export function useUser(): UseUser {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsUserLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  return { user, isUserLoading };
}
