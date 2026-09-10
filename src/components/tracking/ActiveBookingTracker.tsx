'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Sparkles, MapPin, ShieldCheck, Loader2, AlertCircle, CalendarX2, X, CheckCircle2, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getLatestArtistLocation, LatestLocation } from '@/lib/client-update';
import { supabase as db } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import { quoteCancellation, cancelBooking, CancellationQuote } from '@/lib/protection';
import { CANCEL_REASON_LABEL, reasonsFor, CancelReasonCode } from '@/lib/cancellation-reasons';
import { BUSINESS } from '@/lib/business';

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

  // Self-service cancellation. The figure shown comes from the same database
  // function the server records, so the customer is never shown one number
  // and charged another.
  const [cancelFor, setCancelFor] = useState<ActiveBooking | null>(null);
  const [quote, setQuote] = useState<CancellationQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState<CancelReasonCode | ''>('');
  const [reasonNote, setReasonNote] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

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

  const openCancel = async (b: ActiveBooking) => {
    setCancelFor(b);
    setQuote(null);
    setQuoteError(null);
    setReasonCode('');
    setReasonNote('');
    setCancelError(null);
    try {
      setQuote(await quoteCancellation(b.kind, b.id));
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Could not work out the refund.');
    }
  };

  const confirmCancel = async () => {
    if (!cancelFor || !reasonCode) {
      setCancelError('Please choose why you are cancelling.');
      return;
    }
    if (reasonCode === 'other' && reasonNote.trim().length < 5) {
      setCancelError('Please tell us briefly why you are cancelling.');
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      const result = await cancelBooking({
        ...(cancelFor.kind === 'rental' ? { rentalId: cancelFor.id } : { bookingId: cancelFor.id }),
        reasonCode,
        reason: reasonNote.trim() || undefined,
      });
      setOutcome(result.message);
      setCancelFor(null);
      await load();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Could not cancel this booking.');
    } finally {
      setCancelling(false);
    }
  };

  // Only before anything has happened on the day: once the artist has set off
  // or checked in, this is a complaint, not a cancellation.
  const cancellable = (b: ActiveBooking) =>
    !b.otpVerifiedAt && !b.stage &&
    (b.kind === 'booking'
      ? ['pending', 'offered', 'assigned'].includes(b.status)
      : ['pending', 'confirmed'].includes(b.status));

  const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

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

  if (bookings.length === 0 && !outcome) return null;

  return (
    <div className="space-y-4">
      <h2 className="font-display font-black text-xl text-maroon-900">Your Bookings</h2>

      {outcome && (
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed flex-1">{outcome}</p>
          <button onClick={() => setOutcome(null)} aria-label="Dismiss" className="text-emerald-700 hover:text-emerald-900">
            <X size={14} />
          </button>
        </div>
      )}
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

            {cancellable(b) && (
              <button
                onClick={() => openCancel(b)}
                className="text-[11px] font-bold text-rose-700 hover:text-rose-800 flex items-center gap-1.5"
              >
                <CalendarX2 size={13} /> Cancel this booking
              </button>
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

      {cancelFor && (
        <div className="fixed inset-0 z-[60] bg-maroon-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-title"
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-amber-100 flex items-start justify-between gap-3">
              <div>
                <h3 id="cancel-title" className="font-display font-black text-lg text-maroon-950">Cancel this booking?</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {cancelFor.kind === 'rental' ? 'Safa Rental' : 'Safa Artist Booking'} · {cancelFor.eventDate}
                </p>
              </div>
              <button onClick={() => setCancelFor(null)} aria-label="Close"
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 shrink-0">
                <X size={15} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {!quote && !quoteError && (
                <div className="py-6 text-center">
                  <Loader2 size={20} className="animate-spin mx-auto mb-2 text-amber-500" />
                  <p className="text-xs font-bold text-gray-600">Working out your refund…</p>
                </div>
              )}

              {quoteError && (
                <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3">{quoteError}</p>
              )}

              {quote && (
                <>
                  <div className="rounded-2xl bg-royal-50 border border-royal-200 p-4 space-y-1.5">
                    <p className="text-[11px] text-gray-600">
                      {quote.hours_before >= 48
                        ? `${Math.floor(quote.hours_before / 24)} days before your event`
                        : quote.hours_before > 0 ? `${quote.hours_before} hours before your event`
                        : 'Your event has already started'}
                    </p>
                    <p className="text-[13px] font-bold text-maroon-950">{quote.rule_label}</p>
                  </div>

                  {quote.paid ? (
                    <div className="rounded-2xl border border-amber-200/70 overflow-hidden text-[12px]">
                      <div className="flex justify-between px-4 py-2"><span className="text-gray-600">You paid</span><span className="font-bold tabular-nums">{inr(quote.paid_amount)}</span></div>
                      {quote.tax_amount > 0 && (
                        <div className="flex justify-between px-4 py-2 border-t border-amber-100"><span className="text-gray-600">GST / taxes (not refundable)</span><span className="font-bold tabular-nums">− {inr(quote.tax_amount)}</span></div>
                      )}
                      {quote.non_refundable_fee > 0 && (
                        <div className="flex justify-between px-4 py-2 border-t border-amber-100"><span className="text-gray-600">Non-refundable charges</span><span className="font-bold tabular-nums">− {inr(quote.non_refundable_fee)}</span></div>
                      )}
                      <div className="flex justify-between px-4 py-2 border-t border-amber-100"><span className="text-gray-600">Eligible amount</span><span className="font-bold tabular-nums">{inr(quote.eligible_amount)}</span></div>
                      <div className="flex justify-between px-4 py-3 border-t-2 border-amber-200 bg-amber-50/60">
                        <span className="font-black text-maroon-950">You get back ({quote.refund_percent}%)</span>
                        <span className="font-black text-maroon-950 text-base tabular-nums">{inr(quote.refund_amount)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-700 bg-gray-50 rounded-xl p-3">
                      Nothing has been paid on this booking, so cancelling costs you nothing.
                    </p>
                  )}

                  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-[11px] text-amber-900 leading-relaxed">
                    <p className="font-black">Only need a different date?</p>
                    <p className="mt-0.5">
                      Changing the date is often free and keeps your booking —{' '}
                      <a href="/policies#reschedule" target="_blank" rel="noopener noreferrer" className="font-bold underline">see the reschedule policy</a>{' '}
                      or call us first.
                    </p>
                    <a href={`tel:${BUSINESS.phoneDigits}`} className="mt-2 inline-flex items-center gap-1.5 font-black text-maroon-900">
                      <Phone size={12} /> {BUSINESS.phone}
                    </a>
                  </div>

                  <label className="block">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Why are you cancelling?</span>
                    <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value as CancelReasonCode)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-maroon-800/20">
                      <option value="">Choose a reason</option>
                      {reasonsFor('customer').map((code) => (
                        <option key={code} value={code}>{CANCEL_REASON_LABEL[code]}</option>
                      ))}
                    </select>
                  </label>

                  <textarea rows={2} value={reasonNote} onChange={(e) => setReasonNote(e.target.value)}
                    placeholder={reasonCode === 'other' ? 'Please tell us what happened' : 'Anything else we should know? (optional)'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm resize-none outline-none focus:ring-2 focus:ring-maroon-800/20" />

                  {cancelError && (
                    <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3">{cancelError}</p>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => setCancelFor(null)}
                      className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-bold uppercase tracking-wider">
                      Keep my booking
                    </button>
                    <button onClick={confirmCancel} disabled={cancelling || !reasonCode}
                      className="flex-1 py-3 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                      {cancelling ? <><Loader2 size={13} className="animate-spin" /> Cancelling…</> : 'Cancel booking'}
                    </button>
                  </div>

                  {quote.paid && quote.refund_amount > 0 && (
                    <p className="text-[10px] text-gray-500 text-center leading-relaxed">
                      Two members of our team check and approve every refund before it is sent to your
                      original payment method.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
