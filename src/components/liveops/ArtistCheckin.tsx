'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, CheckCircle2, Loader2, AlertCircle, Navigation } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { checkIn, CheckinStage, STAGE_FLOW } from '@/lib/liveops';

interface TodayJob {
  rentalId: string | null;
  bookingId: string | null;
  customerName: string;
  venue: string;
  date: string;
  safaCount: number | null;
  stage: CheckinStage | null;
}

/**
 * Artist check-in for today's jobs.
 *
 * Only shows work happening today or tomorrow — a check-in button next to an
 * event three weeks away invites a mistaken tap that would clear the at-risk
 * flag for the wrong day.
 */
export function ArtistCheckin({ artistId }: { artistId: string }) {
  const [jobs, setJobs] = useState<TodayJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareLocation, setShareLocation] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    const [rentals, bookings, checkins] = await Promise.all([
      supabase
        .from('rental_bookings')
        .select('id, customer_name, venue_address, start_date, safa_count')
        .eq('artist_id', artistId)
        .in('status', ['confirmed', 'dispatched', 'active'])
        .gte('start_date', today)
        .lte('start_date', tomorrow),
      supabase
        .from('artist_bookings')
        .select('id, customer_name, city_venue, event_date')
        .eq('artist_id', artistId)
        .eq('status', 'assigned')
        .gte('event_date', today)
        .lte('event_date', tomorrow),
      supabase
        .from('booking_checkins')
        .select('rental_id, booking_id, stage, created_at')
        .eq('artist_id', artistId)
        .order('created_at', { ascending: false }),
    ]);

    if (rentals.error || bookings.error) {
      setError(
        (rentals.error ?? bookings.error)?.message ??
          'Could not load your jobs for today.'
      );
      setLoading(false);
      return;
    }

    const latest = new Map<string, CheckinStage>();
    for (const row of checkins.data ?? []) {
      const key = (row.rental_id ?? row.booking_id) as string;
      if (key && !latest.has(key)) latest.set(key, row.stage as CheckinStage);
    }

    const list: TodayJob[] = [
      ...(rentals.data ?? []).map((r) => ({
        rentalId: r.id,
        bookingId: null,
        customerName: r.customer_name,
        venue: r.venue_address,
        date: r.start_date,
        safaCount: r.safa_count,
        stage: latest.get(r.id) ?? null,
      })),
      ...(bookings.data ?? []).map((b) => ({
        rentalId: null,
        bookingId: b.id,
        customerName: b.customer_name,
        venue: b.city_venue,
        date: b.event_date,
        safaCount: null,
        stage: latest.get(b.id) ?? null,
      })),
    ];

    setJobs(list);
    setLoading(false);
  }, [artistId]);

  useEffect(() => {
    load();
  }, [load]);

  const mark = async (job: TodayJob, stage: CheckinStage) => {
    const key = job.rentalId ?? job.bookingId ?? '';
    setBusy(key);
    setError(null);

    try {
      await checkIn({
        artistId,
        rentalId: job.rentalId,
        bookingId: job.bookingId,
        stage,
        withLocation: shareLocation,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <section className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-8 text-center">
        <Loader2 size={22} className="animate-spin mx-auto mb-2 text-amber-500" />
        <p className="text-xs font-bold text-gray-600">Loading today&apos;s jobs…</p>
      </section>
    );
  }

  if (jobs.length === 0) return null;

  return (
    <section className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-amber-100">
        <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
          <Navigation size={18} className="text-amber-600" /> Today&apos;s Check-in
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Keep the customer informed. If you do not mark arrival in time, our team is alerted.
        </p>
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={shareLocation}
            onChange={(e) => setShareLocation(e.target.checked)}
            className="accent-maroon-900"
          />
          <span className="text-xs text-gray-600">
            Share my location with this check-in (optional — check-in works without it)
          </span>
        </label>

        {jobs.map((job) => {
          const key = job.rentalId ?? job.bookingId ?? '';
          const currentIndex = STAGE_FLOW.findIndex((s) => s.stage === job.stage);
          const next = STAGE_FLOW[currentIndex + 1] ?? (job.stage ? null : STAGE_FLOW[0]);

          return (
            <div key={key} className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/70">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-maroon-950">
                    {job.customerName}
                    {job.safaCount ? ` · ${job.safaCount} safas` : ''}
                  </p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin size={10} /> {job.venue}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{job.date}</p>
                </div>

                {job.stage && (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                    {STAGE_FLOW.find((s) => s.stage === job.stage)?.label ?? job.stage}
                  </span>
                )}
              </div>

              {next ? (
                <button
                  onClick={() => mark(job, next.stage)}
                  disabled={busy === key}
                  className="w-full mt-3 py-3 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {busy === key ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} /> {next.label}
                    </>
                  )}
                </button>
              ) : (
                <p className="mt-3 text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Job complete. Thank you.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
