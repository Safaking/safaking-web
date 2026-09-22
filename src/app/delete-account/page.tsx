'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Trash2, ShieldCheck, Archive, Loader2, CheckCircle2, AlertCircle, Phone, Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { BUSINESS, mailtoHref, telHref } from '@/lib/business';

/**
 * Account deletion — the web link Google Play asks for, and where the app's
 * More menu sends people too. A signed-in person closes their account here in
 * one step; someone who cannot sign in leaves a request that staff confirm by
 * phone. See supabase/041 and /api/account.
 */
export default function DeleteAccountPage() {
  const { user, profile, loading, logout } = useAuth();
  const isStaff = profile?.role === 'admin' || profile?.role === 'manager';
  // Held here, not in the form: signing out right after the request swaps the
  // signed-in form for the signed-out one, which took the confirmation with it.
  const [closed, setClosed] = useState(false);

  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950">
      <header className="sk-web-header sticky top-0 z-40 bg-maroon-950 text-white shadow-lg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0">
              <Image src="/logo.png" alt="SafaKing" width={40} height={40} className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest leading-none">
                Delete Account
              </h1>
              <p className="text-[10px] text-royal-200/60 uppercase tracking-widest mt-1">Your data, your call</p>
            </div>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-xs font-bold text-royal-200/70 hover:text-royal-300 uppercase tracking-wider">
            <ArrowLeft size={14} /> Home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 pb-32 sm:pb-16 space-y-8">
        <section>
          <h2 className="font-display font-black text-3xl text-maroon-950">Delete your SafaKing account</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-700 max-w-2xl">
            You can close your account whenever you like. Your sign-in stops working the moment you confirm,
            and we finish deleting your details within <strong>7 days</strong>. This cannot be undone.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white border border-amber-200/70 p-5">
            <h3 className="flex items-center gap-2 font-bold text-maroon-950">
              <Trash2 size={17} className="text-rose-700" /> What we delete
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-700 list-disc pl-5">
              <li>Your sign-in — you cannot log in with it again</li>
              <li>Your name, phone number, email, photo and city</li>
              <li>Your wishlist</li>
              <li>Messages you sent us through the website</li>
              <li>Your login history</li>
              <li>Job applications you sent us</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-white border border-amber-200/70 p-5">
            <h3 className="flex items-center gap-2 font-bold text-maroon-950">
              <Archive size={17} className="text-amber-700" /> What the law makes us keep
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-700 list-disc pl-5">
              <li>Orders, bookings, rentals, payments and invoices — kept for 6 years as GST rules require, then deleted</li>
              <li>The booking terms you accepted, as the record of that agreement</li>
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              These stay with our accounts only; your account no longer carries your name.
            </p>
          </div>
        </section>

        <p className="text-xs text-gray-600 leading-relaxed">
          <strong>SafaKing artists and suppliers:</strong> we first settle any money owed to you. Your identity
          documents and bank details are removed once that is done.
        </p>

        {closed ? (
          <AccountClosed />
        ) : loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-maroon-800" />
          </div>
        ) : user ? (
          isStaff ? (
            <div className="rounded-2xl bg-white border border-amber-200/70 p-6 text-sm text-gray-700">
              This is a staff account. Staff accounts are closed by the owner from <strong>Admin → Users &amp; Roles</strong>.
            </div>
          ) : (
            <SignedInDelete
              who={profile?.full_name || user.email || user.phone || 'your account'}
              onDeleted={async () => {
                setClosed(true);
                await logout().catch(() => {});
              }}
            />
          )
        ) : (
          <SignedOut />
        )}

        <section className="rounded-2xl bg-maroon-950 text-royal-100 p-6">
          <h3 className="font-display font-bold text-lg">Rather talk to us?</h3>
          <p className="mt-1 text-sm text-royal-200/80">We can delete your account over the phone or by email too.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={telHref} className="inline-flex items-center gap-2 rounded-full bg-royal-500 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-maroon-950">
              <Phone size={14} /> {BUSINESS.phone}
            </a>
            <a href={mailtoHref} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-xs font-bold text-white">
              <Mail size={14} /> {BUSINESS.email}
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

function AccountClosed() {
  return (
    <div className="rounded-2xl bg-white border border-green-200 p-6 text-center">
      <CheckCircle2 size={40} className="mx-auto text-green-600" />
      <h3 className="mt-3 font-display font-bold text-xl text-maroon-950">Your account is closed</h3>
      <p className="mt-2 text-sm text-gray-700">
        You have been signed out, and we will finish deleting your details within 7 days.
        Thank you for having been part of SafaKing.
      </p>
      <Link href="/" className="mt-5 inline-flex rounded-full bg-maroon-950 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-royal-100">
        Back to SafaKing
      </Link>
    </div>
  );
}

const REASONS = [
  'I no longer need it',
  'I have another account',
  'Privacy concerns',
  'Too many messages',
  'Something else',
];

function SignedInDelete({ who, onDeleted }: { who: string; onDeleted: () => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!understood || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, reason: reason || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Your request could not be sent. Please try again.');
      await onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your request could not be sent. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white border-2 border-rose-200 p-6 space-y-4">
      <p className="text-sm text-gray-700">
        Signed in as <strong className="text-maroon-950">{who}</strong>
      </p>
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Why are you leaving? (optional)</span>
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
        >
          <option value="">Prefer not to say</option>
          {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label className="flex items-start gap-3 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={understood}
          onChange={(event) => setUnderstood(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-rose-700"
        />
        I understand my account will be closed now and deleted within 7 days, and that this cannot be undone.
      </label>
      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-800">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!understood || busy}
        className="w-full rounded-xl bg-rose-700 py-3.5 text-sm font-black uppercase tracking-widest text-white disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        Delete my account
      </button>
    </div>
  );
}

function SignedOut() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Your request could not be sent. Please try again.');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your request could not be sent. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-amber-200/70 p-6">
        <h3 className="flex items-center gap-2 font-bold text-maroon-950">
          <ShieldCheck size={17} className="text-maroon-800" /> Sign in to delete your account
        </h3>
        <p className="mt-2 text-sm text-gray-700">It is the quickest way — your account closes as soon as you confirm.</p>
        <Link
          href="/?auth=login&next=%2Fdelete-account"
          className="mt-4 inline-flex rounded-full bg-maroon-950 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-royal-100"
        >
          Sign in
        </Link>
      </div>

      <div className="rounded-2xl bg-white border border-amber-200/70 p-6">
        <h3 className="font-bold text-maroon-950">Can&apos;t sign in?</h3>
        {sent ? (
          <p className="mt-2 flex items-start gap-2 text-sm text-gray-700">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-green-600" />
            Thank you. We will call you on the details you gave to confirm it is really you, then delete the
            account within 7 days.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-3">
            <p className="text-sm text-gray-700">
              Tell us the phone number or email on your account. We will call you to confirm before deleting anything.
            </p>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              required
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Mobile number on your account"
              inputMode="numeric"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email on your account (optional)"
              type="email"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Anything you'd like to tell us (optional)"
              rows={2}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
            {error && (
              <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-800">
                <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-maroon-950 py-3 text-xs font-black uppercase tracking-widest text-royal-100 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Send deletion request
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
