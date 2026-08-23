'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet, Loader2, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { releaseBookingPayment } from '@/lib/client-update';

interface ReadyJob {
  id: string;
  kind: 'rental' | 'booking';
  customerName: string;
  customerPhone: string;
  artistName: string | null;
  amount: number;
  happyCodeVerifiedAt: string | null;
}

/**
 * "प्रोग्राम कम्प्लीट होने के और हैप्पी कोड शेयर करने के सेम डे पेमेंट मिल जायेगा"
 *
 * The document is explicit that the company calls the customer to confirm
 * BEFORE releasing payment — so this is a deliberate, separate admin action
 * rather than something that fires automatically the moment the happy code
 * is entered. release_booking_payment() only accepts jobs already in
 * 'ready_for_review', so a job cannot be paid out twice.
 */
export function PaymentReleaseQueue() {
  const [jobs, setJobs] = useState<ReadyJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [rentals, bookings] = await Promise.all([
      supabase
        .from('rental_bookings')
        .select('id, customer_name, customer_phone, artist_name, total_amount, happy_code_verified_at')
        .eq('payment_release_status', 'ready_for_review'),
      supabase
        .from('artist_bookings')
        .select('id, customer_name, customer_phone, artist_name, amount, happy_code_verified_at')
        .eq('payment_release_status', 'ready_for_review'),
    ]);

    const firstError = rentals.error ?? bookings.error;
    if (firstError) {
      setError(friendlyError(firstError));
      setJobs([]);
      setLoading(false);
      return;
    }

    setJobs([
      ...(rentals.data ?? []).map((r) => ({
        id: r.id, kind: 'rental' as const, customerName: r.customer_name, customerPhone: r.customer_phone,
        artistName: r.artist_name, amount: r.total_amount, happyCodeVerifiedAt: r.happy_code_verified_at,
      })),
      ...(bookings.data ?? []).map((b) => ({
        id: b.id, kind: 'booking' as const, customerName: b.customer_name, customerPhone: b.customer_phone,
        artistName: b.artist_name, amount: b.amount, happyCodeVerifiedAt: b.happy_code_verified_at,
      })),
    ]);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const release = async (job: ReadyJob) => {
    if (!confirm(`Confirm you have called ${job.customerName} and release payment to ${job.artistName ?? 'the artist'}?`)) {
      return;
    }
    setBusy(job.id);
    setError(null);
    try {
      await releaseBookingPayment(job.kind, job.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not release payment.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-amber-100">
        <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
          <Wallet size={18} className="text-amber-600" /> Payment Release
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Happy code confirmed by the artist. Call the customer to confirm, then release.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 m-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 size={26} className="animate-spin mx-auto mb-3 text-amber-500" />
          <p className="text-sm font-bold text-gray-600">Loading…</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="p-12 text-center">
          <CheckCircle2 size={30} className="text-emerald-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-600">Nothing waiting for payment release.</p>
        </div>
      ) : (
        <div className="divide-y divide-amber-100">
          {jobs.map((job) => (
            <div key={`${job.kind}-${job.id}`} className="p-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-sm text-maroon-950 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-emerald-600" /> {job.artistName ?? 'Artist'}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  For {job.customerName} · {job.customerPhone} · ₹{job.amount.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => release(job)}
                disabled={busy === job.id}
                className="px-4 py-2.5 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5"
              >
                {busy === job.id ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />}
                Release Payment
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
