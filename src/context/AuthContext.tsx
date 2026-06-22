import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { clearData } from '../storage';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  authLoading: boolean;
  /** True once Supabase delivers a PASSWORD_RECOVERY auth event (user followed a reset-password email link). */
  passwordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Sends a reset-password email. Returns an error message, or null on success. */
  resetPassword: (email: string) => Promise<string | null>;
  /** Sets a new password while in password-recovery mode. Returns an error message, or null on success. */
  updatePassword: (newPassword: string) => Promise<string | null>;
  /** Bail out of password-recovery mode back to the sign-in screen without changing the password. */
  cancelPasswordRecovery: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });

    // Re-validate session each time the app comes to the foreground
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
      }
    });

    return () => {
      subscription.unsubscribe();
      appStateSub.remove();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    await clearData();
    await supabase.auth.signOut();
    setPasswordRecovery(false);
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<string | null> => {
    const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    return error?.message ?? null;
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) setPasswordRecovery(false);
    return error?.message ?? null;
  }, []);

  const cancelPasswordRecovery = useCallback(async () => {
    await supabase.auth.signOut();
    setPasswordRecovery(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        authLoading,
        passwordRecovery,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        cancelPasswordRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
