/**
 * useOptionalAuth — Returns auth state without blocking.
 * For pages that work both authenticated and guest.
 */

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { User, onAuthStateChanged } from "firebase/auth";

interface AuthState {
  user: User | null;
  isGuest: boolean;
  loading: boolean;
}

export function useOptionalAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() => {
    const current = auth.currentUser;
    return {
      user: current,
      isGuest: !current,
      loading: current ? false : true,
    };
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState({
        user,
        isGuest: !user,
        loading: false,
      });
    });
    return () => unsubscribe();
  }, []);

  return state;
}
