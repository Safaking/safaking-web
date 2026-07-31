'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, UserProfile, UserRole } from '@/lib/supabase';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  login: (email: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  setDemoRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: 'customer',
  loading: true,
  login: async () => {},
  logout: async () => {},
  setDemoRole: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>('customer');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial Supabase session
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.warn('Supabase auth warning:', err);
        setLoading(false);
      }
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setRole('customer');
        setLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        setProfile(data);
        setRole(data.role || 'customer');
      }
    } catch (err) {
      console.warn('Profile fetch warning:', err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, userRole: UserRole = 'customer') => {
    // Demo login handler for rapid frontend testing
    const demoProfile: UserProfile = {
      id: 'demo-user-123',
      full_name: email.split('@')[0].toUpperCase(),
      phone: '+91 98765 43210',
      role: userRole,
      city: 'Jaipur',
    };
    setUser({ id: 'demo-user-123', email });
    setProfile(demoProfile);
    setRole(userRole);
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore
    }
    setUser(null);
    setProfile(null);
    setRole('customer');
  };

  const setDemoRole = (newRole: UserRole) => {
    setRole(newRole);
    if (profile) {
      setProfile({ ...profile, role: newRole });
    } else {
      setProfile({
        id: 'demo-user-123',
        full_name: 'DEMO USER',
        phone: '+91 98765 43210',
        role: newRole,
        city: 'Jaipur',
      });
      setUser({ id: 'demo-user-123', email: 'demo@safaking.com' });
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, login, logout, setDemoRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
