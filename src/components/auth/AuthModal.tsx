'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, Mail, Lock, User, Phone, MapPin, X, ShieldCheck,
  CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Path to send the user to after a successful sign-in. */
  redirectTo?: string | null;
}

/**
 * Every self-signup becomes a plain customer account. Artist access is never
 * self-selected here — it's granted only when an admin approves a submitted
 * artist application (see admin/page.tsx), which flips this same account's
 * role from 'customer' to 'artist'. Signing up and picking "I'm an artist"
 * used to grant /artist-portal access immediately, with zero connection to
 * the actual application review.
 */
const SIGNUP_ROLE: Exclude<UserRole, 'admin'> = 'customer';

/** Where each role lands after signing in, when no explicit redirect was given. */
const HOME_FOR_ROLE: Record<UserRole, string> = {
  admin: '/admin',
  artist: '/artist-portal',
  customer: '/',
};

export function AuthModal({ isOpen, onClose, redirectTo }: AuthModalProps) {
  const { signIn, signUp, role: sessionRole } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Clear transient state whenever the modal is reopened or the tab flips.
  useEffect(() => {
    setError(null);
    setNotice(null);
  }, [tab, isOpen]);

  if (!isOpen) return null;

  const closeAndReset = () => {
    setPassword('');
    setError(null);
    setNotice(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    const message =
      tab === 'login'
        ? await signIn(email.trim(), password)
        : await signUp({
            email: email.trim(),
            password,
            fullName: fullName.trim(),
            phone: phone.trim(),
            city: city.trim() || undefined,
            role: SIGNUP_ROLE,
          });

    setBusy(false);

    if (message === 'CONFIRM_EMAIL') {
      setNotice(
        'Account created. Check your inbox and confirm your email address, then sign in.'
      );
      setTab('login');
      setPassword('');
      return;
    }

    if (message) {
      setError(message);
      return;
    }

    // signIn/signUp resolve only after the profile is loaded, so `role` is current.
    setNotice('Signed in successfully.');
    setTimeout(() => {
      closeAndReset();
      router.refresh();
      const destination = redirectTo ?? (sessionRole ? HOME_FOR_ROLE[sessionRole] : '/');
      if (destination && destination !== '/') router.push(destination);
    }, 700);
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-maroon-950/80 backdrop-blur-md"
        onClick={closeAndReset}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md overflow-hidden bg-white rounded-3xl shadow-2xl border border-royal-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
        >
          <button
            onClick={closeAndReset}
            className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors border border-white/20"
            title="Close"
          >
            <X size={18} />
          </button>

          {/* Modal Header */}
          <div className="relative bg-maroon-950 text-white p-8 text-center overflow-hidden">
            <div className="absolute inset-0 pattern-diamond opacity-20" />
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="w-12 h-12 rounded-full bg-royal-gradient mx-auto flex items-center justify-center mb-3 shadow-lg shadow-royal-500/20 relative z-10"
            >
              <Crown size={24} className="text-maroon-950" />
            </motion.div>
            <h3 className="font-display font-black text-2xl text-royal-100 tracking-wider uppercase relative z-10">
              SafaKing Account
            </h3>
            <p className="text-xs text-royal-200/60 mt-1 relative z-10">
              {tab === 'login'
                ? 'Sign in to access your royal portal'
                : "Join India's premier safa network"}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50/50 p-1">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all rounded-xl ${
                tab === 'login' ? 'bg-white text-maroon-950 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => setTab('signup')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all rounded-xl ${
                tab === 'signup' ? 'bg-white text-maroon-950 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Content */}
          <div className="p-7">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">{error}</p>
                </div>
              )}
              {notice && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">{notice}</p>
                </div>
              )}

              {tab === 'signup' && (
                <>
                  <p className="flex items-start gap-1.5 text-[10px] text-gray-400 leading-relaxed p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                    <ShieldCheck size={12} className="shrink-0 mt-0.5" />
                    Every account starts as a customer. Artist and admin access is granted
                    separately — for artists, by applying and being approved.
                  </p>

                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      required
                      type="text"
                      placeholder="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      required
                      type="tel"
                      placeholder="Phone Number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="City (optional)"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />
                  </div>
                </>
              )}

              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                />
              </div>

              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  required
                  minLength={6}
                  type="password"
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  placeholder={tab === 'login' ? 'Password' : 'Password (min. 6 characters)'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                />
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={closeAndReset}
                  className="w-1/3 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-2/3 py-3.5 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 disabled:cursor-not-allowed text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  {busy
                    ? tab === 'login'
                      ? 'Signing In…'
                      : 'Creating Account…'
                    : tab === 'login'
                    ? 'Sign In'
                    : 'Create Account'}
                </button>
              </div>

              <p className="text-[10px] text-center text-gray-400 leading-relaxed pt-1">
                {tab === 'login' ? (
                  <>
                    New to SafaKing?{' '}
                    <button
                      type="button"
                      onClick={() => setTab('signup')}
                      className="font-bold text-maroon-800 hover:underline"
                    >
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => setTab('login')}
                      className="font-bold text-maroon-800 hover:underline"
                    >
                      Sign in instead
                    </button>
                  </>
                )}
              </p>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
