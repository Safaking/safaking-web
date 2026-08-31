'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * Where the emailed reset link lands (see resetPassword() in AuthContext.tsx).
 * Supabase's browser client auto-detects the recovery token in the URL and
 * establishes a session before this page ever renders its content — from
 * here it's just "set a new password for whoever that session belongs to".
 */
export default function ResetPasswordPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push('/'), 2500);
  };

  return (
    <div className="min-h-screen bg-royal-gradient flex items-center justify-center p-4">
      <div className="relative w-full max-w-md overflow-hidden bg-white rounded-3xl shadow-2xl border border-royal-200">
        <div className="relative bg-maroon-950 text-white p-8 text-center overflow-hidden">
          <div className="absolute inset-0 pattern-diamond opacity-20" />
          <Image
            src="/logo.png"
            alt="SafaKing"
            width={48}
            height={48}
            className="mx-auto mb-3 relative z-10"
          />
          <h1 className="font-display font-black text-2xl text-royal-100 tracking-wider uppercase relative z-10">
            Set New Password
          </h1>
        </div>

        <div className="p-7">
          {!ready ? (
            <div className="py-10 flex justify-center">
              <Loader2 size={24} className="animate-spin text-maroon-800" />
            </div>
          ) : done ? (
            <div className="py-6 text-center space-y-3">
              <CheckCircle2 size={48} className="text-emerald-500 mx-auto" />
              <p className="font-bold text-maroon-950">Password updated!</p>
              <p className="text-xs text-gray-500">Taking you back to SafaKing…</p>
            </div>
          ) : !hasSession ? (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                This reset link is invalid or has expired. Please request a new one from the sign-in
                form.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">{error}</p>
                </div>
              )}

              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  required
                  minLength={6}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="New Password (min. 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  required
                  minLength={6}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Confirm New Password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3.5 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                {busy ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
