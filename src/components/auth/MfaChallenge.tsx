'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { logAuthEvent } from '@/lib/auth-events';

/**
 * Asks for the authenticator code after a password sign-in, for anyone who
 * has turned two-step verification on.
 *
 * Mounted once in the root layout, so every way in — the customer modal, the
 * artist login, a page reload with a half-finished sign-in — ends up here
 * rather than each login screen having to remember to ask.
 */
export function MfaChallenge() {
  const { user, logout } = useAuth();
  const [pending, setPending] = useState<{ userId: string; factorId: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled || !level) return;
      if (level.nextLevel !== 'aal2' || level.currentLevel === 'aal2') {
        setPending(null);
        return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (!cancelled && totp) setPending({ userId: user.id, factorId: totp.id });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || !pending || pending.userId !== user.id) return null;

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
      factorId: pending.factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyErr) {
      void logAuthEvent('failed_mfa');
      setError('That code did not match. Use the newest code in your authenticator app.');
      return;
    }
    void logAuthEvent('mfa_verified');
    setCode('');
    setPending(null);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-maroon-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={verify}
        className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
        aria-labelledby="mfa-title"
      >
        <div className="bg-maroon-950 px-7 py-5 text-center">
          <ShieldCheck size={28} className="mx-auto text-royal-300 mb-2" />
          <h2 id="mfa-title" className="font-display font-black text-base text-royal-100 uppercase tracking-widest">
            Enter your code
          </h2>
          <p className="text-[11px] text-royal-200/70 mt-1">Open your authenticator app and type the 6-digit code.</p>
        </div>
        <div className="p-7 space-y-4">
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            aria-label="Authenticator code"
            className="w-full px-4 py-3.5 rounded-2xl border border-amber-200 text-center font-mono text-2xl tracking-[0.4em] text-maroon-950 outline-none focus:ring-2 focus:ring-maroon-800/20"
          />
          {error && <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="w-full py-3 rounded-2xl bg-maroon-950 hover:bg-maroon-900 disabled:opacity-50 text-royal-300 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Verify
          </button>
          <button
            type="button"
            onClick={() => logout()}
            className="w-full text-[11px] font-bold text-gray-500 hover:text-maroon-900 flex items-center justify-center gap-1.5"
          >
            <LogOut size={12} /> Sign out instead
          </button>
        </div>
      </form>
    </div>
  );
}
