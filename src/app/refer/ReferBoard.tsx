'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';
import { Gift, Copy, Check, MessageCircle, Loader2, AlertCircle, Users, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BUSINESS } from '@/lib/business';
import { useTermsLanguage } from '@/lib/terms-language';

/**
 * Share a code, both of you get credit (supabase/045).
 *
 * A code arriving in a link is remembered here until the person has an
 * account to attach it to — somebody taps a friend's WhatsApp message, lands
 * on the site, installs the app and signs up twenty minutes later, and the
 * code has to survive all of that.
 */

const PENDING_CODE = 'sk-referral-code';

export function ReferBoard() {
  const { user, loading } = useAuth();
  const [language] = useTermsLanguage();
  const hi = language === 'hi';

  const [code, setCode] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [joined, setJoined] = useState(0);
  const [entry, setEntry] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A code in the link is kept until there is an account to put it on.
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get('code');
    if (fromLink) {
      try {
        localStorage.setItem(PENDING_CODE, fromLink.toUpperCase());
      } catch {
        // Private browsing; the field below still works.
      }
    }
    try {
      setEntry((localStorage.getItem(PENDING_CODE) ?? fromLink ?? '').toUpperCase());
    } catch {
      setEntry((fromLink ?? '').toUpperCase());
    }
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    const [mine, bal, people] = await Promise.all([
      supabase.rpc('my_referral_code'),
      supabase.rpc('credit_balance', { p_user: user.id }),
      supabase.from('referrals').select('id', { count: 'exact', head: true }),
    ]);
    // A failure here used to leave "…" sitting in place of the code for ever,
    // with the share buttons dead and nothing on screen saying why.
    if (mine.data) setCode(mine.data as string);
    else if (mine.error) setError(mine.error.message);
    if (bal.data !== null && bal.data !== undefined) setBalance(Number(bal.data));
    setJoined(people.count ?? 0);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // The QR and the WhatsApp message both point at /r/<code>, which saves the
  // code and then sends the person on to the app or the site. A bare
  // /refer?code= link only worked for somebody who already had the app.
  const link = code ? `https://www.safaking.in/r/${code}` : '';
  const qrRef = useRef<HTMLDivElement | null>(null);

  /**
   * Hand the QR over as a file the customer can keep — print it, put it on a
   * card, send it in a group. Drawn at 4x and scaled down so it survives
   * being printed rather than blurring.
   */
  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas || !code) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `safaking-${code}.png`;
    a.click();
  };
  const invitation = hi
    ? `नमस्ते! SafaKing से शाही साफे ऑनलाइन मँगवाइए। मेरा कोड ${code} इस्तेमाल कीजिए, आपको छूट मिलेगी: ${link}`
    : `Namaste! Order a royal safa from SafaKing. Use my code ${code} and you get credit off your first order: ${link}`;

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(hi ? 'कॉपी नहीं हो पाया — कोड हाथ से लिख लीजिए।' : 'Could not copy — write the code down instead.');
    }
  };

  const claim = useCallback(async (silent = false) => {
    const wanted = entry.trim().toUpperCase();
    if (!wanted || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { data, error: rpcError } = await supabase.rpc('claim_referral_code', { p_code: wanted });
    setBusy(false);

    const result = data as { ok?: boolean; error?: string; credit?: number } | null;
    if (rpcError || !result?.ok) {
      // A code applied on the person's behalf failing is not their mistake
      // and not worth an error across their screen — they never asked for it
      // to happen just then. The field stays filled so they can try it.
      if (!silent) {
        setError(result?.error ?? rpcError?.message ?? (hi ? 'कोड नहीं लग पाया।' : 'That code could not be used.'));
      }
      return;
    }
    try {
      localStorage.removeItem(PENDING_CODE);
    } catch {
      // Nothing to tidy.
    }
    setNotice(
      hi
        ? `बधाई हो! ₹${result.credit} का क्रेडिट आपके खाते में जुड़ गया — अगले ऑर्डर पर अपने आप लगेगा।`
        : `Done — ₹${result.credit} credit is on your account, and comes off your next order automatically.`
    );
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, busy, hi, load]);

  /**
   * A code that arrived by QR or link applies itself the moment there is an
   * account to put it on — which is the whole point of the QR. Asking the
   * customer to press a button for something they already agreed to by
   * scanning loses most of them at exactly the wrong moment.
   *
   * Runs once per sign-in, and only while the code is still pending: claim()
   * clears it, so a second pass has nothing to do.
   */
  const autoClaimed = useRef(false);
  useEffect(() => {
    if (!user || autoClaimed.current || !entry.trim()) return;
    let pending = '';
    try {
      pending = localStorage.getItem(PENDING_CODE) ?? '';
    } catch {
      return;
    }
    if (!pending) return;
    autoClaimed.current = true;
    void claim(true);
  }, [user, entry, claim]);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-royal-200/70">
        <Loader2 size={15} className="animate-spin" /> {hi ? 'एक पल…' : 'One moment…'}
      </p>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-royal-400/20 bg-white/5 p-6">
        <p className="text-sm leading-relaxed text-royal-100/80">
          {hi
            ? 'अपना कोड पाने और क्रेडिट जोड़ने के लिए पहले साइन इन कीजिए।'
            : 'Sign in to get your code and to collect credit.'}
        </p>
        <Link
          href="/?auth=login"
          className="mt-4 inline-block rounded-full bg-royal-400 px-6 py-3 text-xs font-bold uppercase tracking-widest text-maroon-950"
        >
          {hi ? 'साइन इन' : 'Sign in'}
        </Link>
        {entry && (
          <p className="mt-4 text-xs text-royal-200/60">
            {hi ? 'आपका कोड सुरक्षित है: ' : 'Your code is saved: '}
            <span className="font-mono font-bold text-royal-300">{entry}</span>
            {hi ? ' — साइन इन के बाद अपने आप लग जाएगा।' : ' — apply it right after you sign in.'}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-royal-400/25 bg-white/5 p-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-royal-200/60">
          {hi ? 'आपका कोड' : 'Your code'}
        </p>
        <p className="mt-2 font-mono text-3xl font-black tracking-widest text-royal-300">
          {code ?? '…'}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            disabled={!code}
            className="inline-flex items-center gap-2 rounded-full bg-royal-400 px-5 py-3 text-xs font-bold uppercase tracking-widest text-maroon-950 disabled:opacity-50"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? (hi ? 'कॉपी हो गया' : 'Copied') : hi ? 'कोड कॉपी करें' : 'Copy the code'}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(invitation)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-royal-400/40 px-5 py-3 text-xs font-bold uppercase tracking-widest text-royal-200"
          >
            <MessageCircle size={14} /> {hi ? 'WhatsApp पर भेजें' : 'Send on WhatsApp'}
          </a>
        </div>
      </div>

      {/* The same code as something that can be held up, printed or stuck on
          a card. Scanning it installs the app with the code already attached,
          so nobody has to read five characters out over a counter. */}
      {code && (
        <div className="rounded-2xl border border-royal-400/25 bg-white/5 p-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-royal-200/60">
            {hi ? 'आपका QR' : 'Your QR'}
          </p>
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <div ref={qrRef} className="rounded-xl bg-white p-3">
              <QRCodeCanvas
                value={link}
                size={640}
                // Higher correction so a printed card still scans with a
                // thumbprint or a crease across it.
                level="Q"
                // The four-module quiet zone is part of the symbol, not
                // decoration: without it the downloaded PNG scans poorly off
                // paper, where there is no white page around it to help.
                marginSize={4}
                // Drawn large and shown small: a QR scaled up from a small
                // canvas prints as mush.
                style={{ width: 148, height: 148 }}
              />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-sm leading-relaxed text-royal-100/80">
                {hi
                  ? 'इसे स्कैन करने पर ऐप खुलेगा और आपका कोड अपने आप लग जाएगा।'
                  : 'Scanning this opens the app with your code already applied.'}
              </p>
              <button
                type="button"
                onClick={downloadQr}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-royal-400/40 px-5 py-3 text-xs font-bold uppercase tracking-widest text-royal-200"
              >
                <Download size={14} /> {hi ? 'QR डाउनलोड करें' : 'Download the QR'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-royal-400/20 bg-white/5 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-royal-200/60">
            {hi ? 'आपका क्रेडिट' : 'Your credit'}
          </p>
          <p className="mt-1 text-2xl font-black text-royal-100">
            ₹{balance === null ? '—' : balance.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-[11px] text-royal-200/50">
            {hi ? 'ऑर्डर पर अपने आप लगता है' : 'Comes off your order automatically'}
          </p>
        </div>
        <div className="rounded-2xl border border-royal-400/20 bg-white/5 p-5">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-royal-200/60">
            <Users size={11} /> {hi ? 'आपसे जुड़े' : 'Joined with your code'}
          </p>
          <p className="mt-1 text-2xl font-black text-royal-100">{joined}</p>
        </div>
      </div>

      {/* Only of use before a first order; the database refuses it afterwards. */}
      <div className="rounded-2xl border border-royal-400/20 bg-white/5 p-5">
        <p className="text-xs font-bold text-royal-100">
          {hi ? 'किसी का कोड मिला है?' : 'Got somebody else’s code?'}
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={entry}
            onChange={(e) => setEntry(e.target.value.toUpperCase())}
            placeholder={hi ? 'कोड लिखिए' : 'Enter the code'}
            maxLength={16}
            className="flex-1 rounded-xl border border-royal-400/25 bg-white/5 px-4 py-3 font-mono text-sm uppercase tracking-widest text-royal-100 placeholder:font-sans placeholder:tracking-normal placeholder:text-royal-200/40 outline-none focus:border-royal-400/60"
          />
          <button
            type="button"
            onClick={() => void claim()}
            disabled={busy || !entry.trim()}
            className="rounded-xl bg-royal-400 px-5 py-3 text-xs font-bold uppercase tracking-widest text-maroon-950 disabled:opacity-40"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : hi ? 'लगाएँ' : 'Apply'}
          </button>
        </div>
      </div>

      {notice && (
        <p className="flex items-start gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs leading-relaxed text-emerald-200">
          <Gift size={14} className="mt-0.5 shrink-0" /> {notice}
        </p>
      )}
      {error && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs leading-relaxed text-amber-200">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-royal-200/50">
        {hi
          ? `क्रेडिट सिर्फ़ SafaKing के ऑर्डर पर लगता है, नकद नहीं मिलता। किसी सवाल के लिए ${BUSINESS.phone}।`
          : `Credit is spent on SafaKing orders and is not paid out in cash. Questions: ${BUSINESS.phone}.`}
      </p>
    </div>
  );
}
