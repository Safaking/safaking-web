'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Sparkles, MapPin, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getLatestArtistLocation, LatestLocation } from '@/lib/client-update';
import { supabase as db } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import type { MapPoint } from '@/components/liveops/LiveMap';

// Leaflet reaches for `window` on import, so the map only ever loads in the
// browser — and only for customers who actually have a live job on screen.
const LiveMap = dynamic(
  () => import('@/components/liveops/LiveMap').then((m) => m.LiveMap),
  { ssr: false, loading: () => <div className="h-[220px] rounded-2xl bg-royal-50 animate-pulse" /> }
);

interface ActiveBooking {
  id: string;
  kind: 'rental' | 'booking';
  status: string;
  approvedAt: string | null;
  eventDate: string;
  venue: string;
  arrivalOtp: string | null;
  completionCode: string | null;
  otpVerifiedAt: string | null;
  happyCodeVerifiedAt: string | null;
  paymentReleaseStatus: string;
  /** Latest check-in the artist posted, if any. */
  stage: string | null;
  venueLat: number | null;
  venueLng: number | null;
}

/**
 * "ग्राहक Track कर सके" — a customer's upcoming/active bookings, their
 * arrival + completion codes (to relay to the artist verbally), and the
 * artist's last known location once tracking has started.
 *
 * Only bookings with an assigned artist and a live status are shown; a
 * finished or cancelled booking has nothing left to track.
 */
export function ActiveBookingTracker({ userId }: { userId: string }) {
  const [bookings, setBookings] = useState<ActiveBooking[]>([]);
  const [locations, setLocations] = useState<Record<string, LatestLocation | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [rentals, bookingsRes] = await Promise.all([
      // Every live booking, not just ones already assigned: a customer whose
      // request is still 'pending' (no artist yet) or whose job just finished
      // used to see nothing at all here and assume the booking was lost.
      supabase
        .from('rental_bookings')
        .select(
          'id, status, start_date, venue_address, arrival_otp, completion_code, otp_verified_at, happy_code_verified_at, payment_release_status, assignment_approved_at, customer_lat, customer_lng'
        )
        .eq('customer_id', userId)
        .in('status', ['pending', 'confirmed', 'dispatched', 'active', 'returned', 'completed'])
        .order('start_date', { ascending: true }),
      supabase
        .from('artist_bookings')
        .select(
          'id, status, event_date, city_venue, arrival_otp, completion_code, otp_verified_at, happy_code_verified_at, payment_release_status, assignment_approved_at, customer_lat, customer_lng'
        )
        .eq('customer_id', userId)
        .in('status', ['pending', 'offered', 'assigned', 'completed'])
        .order('event_date', { ascending: true }),
    ]);

    if (rentals.error || bookingsRes.error) {
      setError((rentals.error ?? bookingsRes.error)?.message ?? 'Could not load your bookings.');
      setLoading(false);
      return;
    }

    const list: ActiveBooking[] = [
      ...(rentals.data ?? []).map((r) => ({
        id: r.id, kind: 'rental' as const, status: r.status, approvedAt: r.assignment_approved_at, eventDate: r.start_date,
        venue: r.venue_address, arrivalOtp: r.arrival_otp, completionCode: r.completion_code,
        otpVerifiedAt: r.otp_verified_at, happyCodeVerifiedAt: r.happy_code_verified_at,
        paymentReleaseStatus: r.payment_release_status, stage: null,
        venueLat: r.customer_lat, venueLng: r.customer_lng,
      })),
      ...(bookingsRes.data ?? []).map((b) => ({
        id: b.id, kind: 'booking' as const, status: b.status, approvedAt: b.assignment_approved_at, eventDate: b.event_date,
        venue: b.city_venue, arrivalOtp: b.arrival_otp, completionCode: b.completion_code,
        otpVerifiedAt: b.otp_verified_at, happyCodeVerifiedAt: b.happy_code_verified_at,
        paymentReleaseStatus: b.payment_release_status, stage: null,
        venueLat: b.customer_lat, venueLng: b.customer_lng,
      })),
    ];

    // The artist's own check-ins are what tell the customer whether someone
    // has actually set off — a status of 'assigned' says nothing about today.
    const ids = list.map((x) => x.id);
    const stages = new Map<string, string>();
    if (ids.length > 0) {
      const { data: checkins } = await db
        .from('booking_checkins')
        .select('rental_id, booking_id, stage, created_at')
        .or(`rental_id.in.(${ids.join(',')}),booking_id.in.(${ids.join(',')})`)
        .order('created_at', { ascending: false });

      for (const row of checkins ?? []) {
        const key = (row.rental_id ?? row.booking_id) as string;
        if (key && !stages.has(key)) stages.set(key, row.stage as string);
      }
    }

    setBookings(list.map((x) => ({ ...x, stage: stages.get(x.id) ?? null })));

    const locs = await Promise.all(
      list.map((b) => getLatestArtistLocation(b.kind, b.id).then((loc) => [b.id, loc] as const))
    );
    setLocations(Object.fromEntries(locs));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
    // The artist may check in or ping location at any moment; a light poll
    // keeps this screen current without the customer having to refresh.
    const timer = setInterval(load, 45_000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-amber-200/60 p-8 text-center">
        <Loader2 size={22} className="animate-spin mx-auto mb-2 text-amber-500" />
        <p className="text-xs font-bold text-gray-600">Checking your bookings…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
        <AlertCircle size={16} className="shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed">{error}</p>
      </div>
    );
  }

  if (bookings.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="font-display font-black text-xl text-maroon-900">Your Bookings</h2>
      {bookings.map((b) => {
        const loc = locations[b.id];
        // Which artist is coming is deliberately not shown: an artist
        // accepting is not the final word — SafaKing signs off on it and may
        // still swap them, so naming one here would only mislead.
        const liveStage =
          b.stage === 'en_route' ? 'Artist is on the way'
          : b.stage === 'arrived' ? 'Artist has arrived'
          : b.stage === 'started' ? 'Tying in progress'
          : b.stage === 'no_show' ? 'We are arranging a replacement'
          : null;

        const stageLabel =
          b.paymentReleaseStatus === 'released' ? null
          : liveStage && b.stage !== 'completed' ? liveStage
          : b.status === 'completed' || b.status === 'returned' ? 'Completed'
          : b.status === 'pending' ? 'Request received — artist being arranged'
          : b.status === 'offered' ? 'Artist being arranged'
          : (b.status === 'assigned' || b.status === 'confirmed') && !b.approvedAt ? 'Artist being confirmed'
          : b.status === 'assigned' || b.status === 'confirmed' ? 'Confirmed — artist booked'
          : b.status === 'dispatched' || b.status === 'active' ? 'In progress'
          : b.status;
        return (
          <div key={`${b.kind}-${b.id}`} className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-sm text-maroon-950">
                  {b.kind === 'rental' ? 'Safa Rental' : 'Safa Artist Booking'}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">{b.eventDate} · {b.venue}</p>
              </div>
              {b.paymentReleaseStatus === 'released' ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck size={11} /> Completed & paid
                </span>
              ) : stageLabel ? (
                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider">
                  {stageLabel}
                </span>
              ) : null}
            </div>

            {/* Codes — only while still relevant */}
            {!b.otpVerifiedAt && b.arrivalOtp && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3">
                <KeyRound size={18} className="text-amber-700 shrink-0" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                    Arrival Code — tell this to your artist when they arrive
                  </p>
                  <p className="text-2xl font-display font-black text-maroon-950 tracking-widest mt-0.5">
                    {b.arrivalOtp}
                  </p>
                </div>
              </div>
            )}

            {b.otpVerifiedAt && !b.happyCodeVerifiedAt && b.completionCode && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                <Sparkles size={18} className="text-emerald-700 shrink-0" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                    Completion Code — tell this to your artist once the safa is tied
                  </p>
                  <p className="text-2xl font-display font-black text-maroon-950 tracking-widest mt-0.5">
                    {b.completionCode}
                  </p>
                </div>
              </div>
            )}

            {liveStage && (
              <div className="flex items-center gap-2">
                {['en_route', 'arrived', 'started'].map((st, i) => {
                  const order = ['en_route', 'arrived', 'started'];
                  const done = order.indexOf(b.stage ?? '') >= i;
                  return (
                    <div key={st} className="flex-1">
                      <div className={`h-1.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                      <p className={`text-[9px] font-black uppercase tracking-wider mt-1 ${done ? 'text-emerald-700' : 'text-gray-400'}`}>
                        {st === 'en_route' ? 'On the way' : st === 'arrived' ? 'Arrived' : 'Tying'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {b.approvedAt && !b.happyCodeVerifiedAt && (
              <p className="text-[11px] text-gray-600 bg-royal-50 rounded-xl p-3 leading-relaxed">
                Your artist is booked and confirmed by SafaKing. They will call you before the
                event — share your arrival code with them when they reach you.
              </p>
            )}

            {b.happyCodeVerifiedAt && b.paymentReleaseStatus !== 'released' && (
              <p className="text-xs text-gray-600 bg-gray-50 rounded-xl p-3">
                Job marked complete. Our team will call you to confirm, then release payment to
                your artist.
              </p>
            )}

            {/* Live location */}
            {loc && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-600 bg-royal-50 rounded-xl p-3">
                  <MapPin size={14} className="text-royal-700 shrink-0" />
                  <span>
                    Last seen {new Date(loc.recorded_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                    {loc.eta_minutes != null ? (
                      <> · <b className="text-maroon-900">about {loc.eta_minutes} min away</b></>
                    ) : ''}
                  </span>
                </div>

                {loc.latitude != null && loc.longitude != null && b.stage !== 'completed' && (
                  <LiveMap
                    height={220}
                    points={[
                      { lat: loc.latitude, lng: loc.longitude, kind: 'artist', label: 'Your artist', sub: 'Last known position' },
                      ...(b.venueLat != null && b.venueLng != null
                        ? [{ lat: b.venueLat, lng: b.venueLng, kind: 'venue' as const, label: 'Your venue' }]
                        : []),
                    ]}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
