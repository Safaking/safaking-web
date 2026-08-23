'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Sparkles, MapPin, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getLatestArtistLocation, LatestLocation } from '@/lib/client-update';

interface ActiveBooking {
  id: string;
  kind: 'rental' | 'booking';
  artistName: string | null;
  eventDate: string;
  venue: string;
  arrivalOtp: string | null;
  completionCode: string | null;
  otpVerifiedAt: string | null;
  happyCodeVerifiedAt: string | null;
  paymentReleaseStatus: string;
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
      supabase
        .from('rental_bookings')
        .select(
          'id, artist_name, start_date, venue_address, arrival_otp, completion_code, otp_verified_at, happy_code_verified_at, payment_release_status'
        )
        .eq('customer_id', userId)
        .in('status', ['confirmed', 'dispatched', 'active'])
        .not('artist_id', 'is', null),
      supabase
        .from('artist_bookings')
        .select(
          'id, artist_name, event_date, city_venue, arrival_otp, completion_code, otp_verified_at, happy_code_verified_at, payment_release_status'
        )
        .eq('customer_id', userId)
        .eq('status', 'assigned'),
    ]);

    if (rentals.error || bookingsRes.error) {
      setError((rentals.error ?? bookingsRes.error)?.message ?? 'Could not load your bookings.');
      setLoading(false);
      return;
    }

    const list: ActiveBooking[] = [
      ...(rentals.data ?? []).map((r) => ({
        id: r.id, kind: 'rental' as const, artistName: r.artist_name, eventDate: r.start_date,
        venue: r.venue_address, arrivalOtp: r.arrival_otp, completionCode: r.completion_code,
        otpVerifiedAt: r.otp_verified_at, happyCodeVerifiedAt: r.happy_code_verified_at,
        paymentReleaseStatus: r.payment_release_status,
      })),
      ...(bookingsRes.data ?? []).map((b) => ({
        id: b.id, kind: 'booking' as const, artistName: b.artist_name, eventDate: b.event_date,
        venue: b.city_venue, arrivalOtp: b.arrival_otp, completionCode: b.completion_code,
        otpVerifiedAt: b.otp_verified_at, happyCodeVerifiedAt: b.happy_code_verified_at,
        paymentReleaseStatus: b.payment_release_status,
      })),
    ];

    setBookings(list);

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
      <h2 className="font-display font-black text-xl text-maroon-900">Upcoming Bookings</h2>
      {bookings.map((b) => {
        const loc = locations[b.id];
        return (
          <div key={`${b.kind}-${b.id}`} className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-sm text-maroon-950">
                  {b.artistName || 'Artist to be assigned'}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">{b.eventDate} · {b.venue}</p>
              </div>
              {b.paymentReleaseStatus === 'released' && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck size={11} /> Completed & paid
                </span>
              )}
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

            {b.happyCodeVerifiedAt && b.paymentReleaseStatus !== 'released' && (
              <p className="text-xs text-gray-600 bg-gray-50 rounded-xl p-3">
                Job marked complete. Our team will call you to confirm, then release payment to
                your artist.
              </p>
            )}

            {/* Live location */}
            {loc && (
              <div className="flex items-center gap-2 text-xs text-gray-600 bg-royal-50 rounded-xl p-3">
                <MapPin size={14} className="text-royal-700 shrink-0" />
                <span>
                  Last seen {new Date(loc.recorded_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                  {loc.eta_minutes != null ? ` · about ${loc.eta_minutes} min away` : ''}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
