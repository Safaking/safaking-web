'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Crown, MapPin, Calendar, Users, Sparkles, CheckCircle2, AlertCircle,
  Loader2, ArrowRight, ShieldCheck, Star,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createRental, loadRazorpayScript, payAndVerify, payableFromRental } from '@/lib/checkout';

interface MatchedArtist {
  id: string; displayName: string; baseCity: string | null;
  safasPerDay: number; perSafaRate: number; teamSize: number;
  rating: number | null; totalEvents: number; verified: boolean; matchRank: number;
}
interface MatchedSafa {
  productId: string; name: string; image: string | null; quantity: number;
  rentPerDay: number; deposit: number; lineRent: number; lineDeposit: number; available: number;
}
interface MatchQuote {
  city: string; pincode: string; eventDate: string;
  guestCount: number; safaCount: number;
  artistsNeeded: number; artistsAvailable: number;
  artistShortfall: boolean; safaShortfall: number;
  artists: MatchedArtist[]; safas: MatchedSafa[];
  rentAmount: number; depositAmount: number; artistAmount: number;
  totalAmount: number; advanceAmount: number; balanceAmount: number;
  advanceRate: number; guestToSafaRatio: number; safasPerArtist: number; artistPerSafaRate: number;
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** One step of the जयपुर → मेहमान → साफा → आर्टिस्ट → कीमत funnel. */
function FunnelStep({
  label, value, sub, icon: Icon, tone = 'amber',
}: {
  label: string; value: string; sub?: string;
  icon: typeof Users; tone?: 'amber' | 'emerald' | 'rose';
}) {
  const tones = {
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    rose: 'bg-rose-100 text-rose-800 border-rose-200',
  };
  return (
    <div className={`flex-1 min-w-[8rem] rounded-2xl border p-4 text-center ${tones[tone]}`}>
      <Icon size={20} className="mx-auto mb-1.5" />
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
      <p className="text-2xl font-display font-black mt-0.5">{value}</p>
      {sub && <p className="text-[10px] font-bold opacity-70 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function PlanEventPage() {
  const { profile } = useAuth();

  const [pincode, setPincode] = useState('302001');
  const [eventDate, setEventDate] = useState(dateOffset(21));
  const [guests, setGuests] = useState('100');

  const [quote, setQuote] = useState<MatchQuote | null>(null);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [venue, setVenue] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookedRef, setBookedRef] = useState<string | null>(null);

  const runMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setQuote(null);
    setMatching(true);

    try {
      const response = await fetch('/api/match/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pincode, eventDate, guestCount: Number(guests) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? 'Could not build a quotation.');

      setQuote(body as MatchQuote);
      if (profile?.full_name) setName((prev) => prev || profile.full_name);
      if (profile?.phone) setPhone((prev) => prev || profile.phone!);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Matching failed.');
    } finally {
      setMatching(false);
    }
  };

  const confirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote) return;
    setError(null);
    setBooking(true);

    const customer = { name: name.trim(), phone: phone.trim(), venueAddress: venue.trim(), pincode };

    try {
      // The matched plan becomes a normal rental booking with artist tying, so
      // it flows through the same server-side pricing and payment path.
      const created = await createRental(
        {
          startDate: quote.eventDate,
          endDate: quote.eventDate,
          items: quote.safas.map((s) => ({ productId: s.productId, quantity: s.quantity })),
          needsArtist: true,
        },
        customer
      );

      const ready = await loadRazorpayScript();
      if (!ready) throw new Error('Could not reach the payment provider.');

      const outcome = await payAndVerify(payableFromRental(created), customer);
      setBookedRef(outcome.rentalId ?? created.rentalId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed.');
    } finally {
      setBooking(false);
    }
  };

  if (bookedRef) {
    return (
      <div className="min-h-screen bg-[#FDF6EC] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-amber-200/60 shadow-xl p-10 max-w-md text-center space-y-4"
        >
          <CheckCircle2 size={64} className="text-emerald-500 mx-auto" />
          <h1 className="font-display font-black text-2xl text-maroon-900">Event Booked!</h1>
          <p className="text-xs font-bold text-maroon-800 tracking-wider">
            Reference: <span className="text-gradient-gold">{bookedRef.slice(0, 8).toUpperCase()}</span>
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Your advance is received. Our team will confirm the safas and assign your Master Safa
            Artists for {quote?.eventDate}.
          </p>
          <Link
            href="/"
            className="inline-block mt-2 px-6 py-3 bg-maroon-950 hover:bg-maroon-900 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest"
          >
            Back to Home
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950">
      <header className="sticky top-0 z-40 bg-maroon-950 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-royal-gradient flex items-center justify-center">
              <Crown size={20} className="text-maroon-950" />
            </div>
            <div>
              <h1 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest leading-none">
                Plan My Event
              </h1>
              <p className="text-[10px] text-royal-200/60 uppercase tracking-widest mt-1">
                Safas + artists, matched and priced instantly
              </p>
            </div>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {/* ---- Inputs ---- */}
        <form onSubmit={runMatch} className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6">
          <h2 className="font-display font-bold text-lg text-maroon-950 mb-1">
            Tell us about your wedding
          </h2>
          <p className="text-xs text-gray-500 mb-5">
            We work out how many safas you need, how many artists it takes, and what it costs.
          </p>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                <MapPin size={11} className="inline mr-1" /> Venue Pincode
              </label>
              <input
                required
                inputMode="numeric"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-maroon-800/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                <Calendar size={11} className="inline mr-1" /> Event Date
              </label>
              <input
                required
                type="date"
                min={dateOffset(0)}
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-maroon-800/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                <Users size={11} className="inline mr-1" /> Number of Guests
              </label>
              <input
                required
                type="number"
                min={1}
                max={5000}
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-maroon-800/20 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={matching}
            className="w-full mt-5 py-4 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2"
          >
            {matching ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Matching artists & safas…
              </>
            ) : (
              <>
                <Sparkles size={16} /> Show My Quotation
              </>
            )}
          </button>

          {error && !quote && (
            <div className="flex items-start gap-2 p-3 mt-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">{error}</p>
            </div>
          )}
        </form>

        {/* ---- Result ---- */}
        {quote && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* The funnel, exactly as specced */}
            <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6">
              <h3 className="font-display font-bold text-base text-maroon-950 mb-4">
                {quote.city}
              </h3>
              <div className="flex flex-wrap gap-3">
                <FunnelStep label="Guests" value={String(quote.guestCount)} icon={Users} />
                <FunnelStep
                  label="Safas needed"
                  value={String(quote.safaCount)}
                  sub={`${quote.guestToSafaRatio}× guests`}
                  icon={Crown}
                />
                <FunnelStep
                  label="Artists needed"
                  value={String(quote.artistsNeeded)}
                  sub={`${quote.safasPerArtist} safas each`}
                  icon={Sparkles}
                  tone={quote.artistShortfall ? 'rose' : 'emerald'}
                />
                <FunnelStep
                  label="Total"
                  value={`₹${quote.totalAmount.toLocaleString()}`}
                  sub={`pay ₹${quote.advanceAmount.toLocaleString()} now`}
                  icon={CheckCircle2}
                  tone="emerald"
                />
              </div>

              {(quote.artistShortfall || quote.safaShortfall > 0) && (
                <div className="flex items-start gap-2 p-3 mt-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">
                    {quote.artistShortfall &&
                      `Only ${quote.artistsAvailable} artist(s) are free on ${quote.eventDate} — fewer than the ${quote.artistsNeeded} this event needs. `}
                    {quote.safaShortfall > 0 &&
                      `We can supply ${quote.safaCount - quote.safaShortfall} of ${quote.safaCount} safas for that date. `}
                    You can still book what is available and our team will arrange the rest.
                  </p>
                </div>
              )}
            </div>

            {/* Matched artists */}
            <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6">
              <h3 className="font-display font-bold text-base text-maroon-950 mb-4">
                Your Matched Artists
              </h3>
              {quote.artists.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No artists are free on this date. Try another date, or book the safas alone.
                </p>
              ) : (
                <div className="space-y-2">
                  {quote.artists.map((artist) => (
                    <div
                      key={artist.id}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-amber-50/40 border border-amber-200/70"
                    >
                      <div className="w-10 h-10 rounded-full bg-maroon-950 text-royal-300 flex items-center justify-center font-black shrink-0">
                        {artist.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-maroon-950 flex items-center gap-1.5">
                          {artist.displayName}
                          {artist.verified && (
                            <ShieldCheck size={13} className="text-emerald-600" aria-label="Verified" />
                          )}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {artist.baseCity ?? 'Travels nationwide'} · ties {artist.safasPerDay}/day
                          {artist.teamSize > 1 ? ` · team of ${artist.teamSize}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-amber-700 flex items-center gap-1 justify-end">
                          <Star size={11} className="fill-amber-500 text-amber-500" />
                          {artist.rating ?? '—'}
                        </p>
                        <p className="text-[10px] text-gray-400">{artist.totalEvents} events</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Combined quotation */}
            <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6">
              <h3 className="font-display font-bold text-base text-maroon-950 mb-4">
                Combined Quotation
              </h3>

              <div className="space-y-2 text-xs mb-4">
                {quote.safas.map((safa) => (
                  <div key={safa.productId} className="flex justify-between gap-3 text-gray-700">
                    <span className="min-w-0">
                      {safa.name}
                      <span className="block text-[10px] text-gray-400">
                        {safa.quantity} × ₹{safa.rentPerDay}/day
                      </span>
                    </span>
                    <span className="font-bold text-maroon-950 shrink-0">
                      ₹{safa.lineRent.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 text-xs border-t border-amber-100 pt-3">
                <div className="flex justify-between text-gray-700">
                  <span>Safa rental</span>
                  <span className="font-bold">₹{quote.rentAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Artist tying (₹{quote.artistPerSafaRate}/safa)</span>
                  <span className="font-bold">₹{quote.artistAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>
                    Refundable deposit
                    <span className="block text-[10px] text-gray-400">Returned after the event</span>
                  </span>
                  <span className="font-bold">₹{quote.depositAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-black text-maroon-950 pt-2 border-t border-amber-100">
                  <span>Total</span>
                  <span className="text-gradient-gold">₹{quote.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 mt-2">
                  <span>Pay now ({Math.round(quote.advanceRate * 100)}% advance)</span>
                  <span>₹{quote.advanceAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  <span>Balance at event</span>
                  <span>₹{quote.balanceAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Confirm */}
            <form
              onSubmit={confirmBooking}
              className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6 space-y-4"
            >
              <h3 className="font-display font-bold text-base text-maroon-950">Confirm & Book</h3>

              <div className="grid sm:grid-cols-2 gap-4">
                <input
                  required
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-maroon-800/20 outline-none"
                />
                <input
                  required
                  type="tel"
                  placeholder="Phone / WhatsApp"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-maroon-800/20 outline-none"
                />
              </div>
              <textarea
                required
                rows={2}
                placeholder="Venue address"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:ring-2 focus:ring-maroon-800/20 outline-none"
              />

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={booking || quote.safas.length === 0}
                className="w-full py-4 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2"
              >
                {booking ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Opening secure payment…
                  </>
                ) : (
                  <>
                    Pay ₹{quote.advanceAmount.toLocaleString()} & Lock My Date
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <p className="text-[10px] text-gray-400 leading-relaxed">
                Prices and availability are re-checked by our servers at payment time. If a safa or
                artist is taken in the meantime, you will be told before any money moves.
              </p>
            </form>
          </motion.div>
        )}
      </main>
    </div>
  );
}
