'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, friendlyError, UserProfile, UserRole } from '@/lib/supabase';

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
  logout: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

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

    const applySession = async (session: Session | null) => {
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      if (mounted.current) setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => applySession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      mounted.current = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return error.message;
      if (data.user) await loadProfile(data.user.id);
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

  const logout = useCallback(async () => {
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
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
