'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, friendlyError, UserProfile, UserRole } from '@/lib/supabase';
import { logAuthEvent } from '@/lib/auth-events';

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  city?: string;
  role: Exclude<UserRole, 'admin'>;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  /** Resolve to null on success, or a human-readable error message. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (input: SignUpInput) => Promise<string | null>;
  /** Sends a password-reset email. Resolves to null on success (regardless of whether the email exists, to avoid leaking that). */
  resetPassword: (email: string) => Promise<string | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: null,
  loading: true,
  signIn: async () => 'Auth not ready',
  signUp: async () => 'Auth not ready',
  resetPassword: async () => 'Auth not ready',
  logout: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  // Whose profile is already loaded, so a token refresh does not refetch it.
  const loadedFor = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!mounted.current) return;

    if (error) {
      // A missing profiles table (schema not applied) shouldn't wedge the app —
      // the user stays signed in with no role, and the portals stay locked.
      console.error('Could not load profile:', friendlyError(error));
      setProfile(null);
      return;
    }
    setProfile((data as UserProfile) ?? null);
  }, []);

  useEffect(() => {
    mounted.current = true;

    // One source: onAuthStateChange fires INITIAL_SESSION on subscribe, so a
    // separate getSession() call only loaded the same profile a second time —
    // an extra trip to the database on every page.
    const applySession = (event: string, session: Session | null) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        loadedFor.current = null;
        setProfile(null);
        if (mounted.current) setLoading(false);
        return;
      }
      if (loadedFor.current === nextUser.id && event !== 'USER_UPDATED') {
        if (mounted.current) setLoading(false);
        return;
      }
      loadedFor.current = nextUser.id;
      // Deferred: awaiting Supabase inside the auth callback can deadlock it.
      setTimeout(() => {
        loadProfile(nextUser.id).finally(() => {
          if (mounted.current) setLoading(false);
        });
      }, 0);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      applySession(event, session);
    });

    return () => {
      mounted.current = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        void logAuthEvent('failed_password', { email });
        return error.message;
      }
      void logAuthEvent('sign_in');
      if (data.user) {
        loadedFor.current = data.user.id;
        await loadProfile(data.user.id);
      }
      return null;
    },
    [loadProfile]
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          // Read by the handle_new_user() trigger, which refuses to honour
          // role: 'admin' regardless of what is sent from here.
          data: {
            full_name: input.fullName,
            phone: input.phone,
            city: input.city ?? null,
            role: input.role,
          },
        },
      });

      if (error) return error.message;

      // With "Confirm email" enabled in Supabase there is no session yet.
      if (!data.session) return 'CONFIRM_EMAIL';

      if (data.user) await loadProfile(data.user.id);
      return null;
    },
    [loadProfile]
  );

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return error.message;
    return null;
  }, []);

  const logout = useCallback(async () => {
    // Logged while the session still exists, so the row knows who it was.
    await logAuthEvent('sign_out');
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role ?? null,
        loading,
        signIn,
        signUp,
        resetPassword,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
