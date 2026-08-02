'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Crown, Calendar, MapPin, Users, Minus, Plus, CheckCircle2,
  AlertCircle, Loader2, ArrowRight, Sparkles, ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { checkArtistPincode, PincodeCheckResult } from '@/lib/pincodes';
import {
  quoteRental, createRental, loadRazorpayScript, payAndVerify, payableFromRental,
  RentalQuote,
} from '@/lib/checkout';

interface RentableSafa {
  id: string;
  name: string;
  image: string | null;
  fabric: string | null;
  color: string | null;
  rent_price_per_day: number;
  rent_deposit: number | null;
  available: number;
}

/** YYYY-MM-DD for an offset from today, in the user's local calendar. */
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function RentPage() {
  const { user, profile } = useAuth();

  const [startDate, setStartDate] = useState(dateOffset(7));
  const [endDate, setEndDate] = useState(dateOffset(8));

  const [safas, setSafas] = useState<RentableSafa[]>([]);
  const [loadingSafas, setLoadingSafas] = useState(true);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [needsArtist, setNeedsArtist] = useState(true);

  const [quote, setQuote] = useState<RentalQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [venue, setVenue] = useState('');
  const [pincode, setPincode] = useState('302001');
  const [pincodeResult, setPincodeResult] = useState<PincodeCheckResult | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookedRef, setBookedRef] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.full_name) setName((prev) => prev || profile.full_name);
    if (profile?.phone) setPhone((prev) => prev || profile.phone!);
  }, [profile]);

  // ---- Availability for the chosen window --------------------------------
  useEffect(() => {
    let active = true;
    setLoadingSafas(true);
    setCatalogueError(null);

    supabase
      .rpc('available_rentals', { p_start: startDate, p_end: endDate })
      .then(({ data, error: rpcErr }) => {
        if (!active) return;
        if (rpcErr) {
          setCatalogueError(
            rpcErr.message.includes('available_rentals')
              ? 'Rentals are not set up yet — run supabase/004_rentals.sql.'
              : rpcErr.message
          );
          setSafas([]);
        } else {
          setSafas((data as RentableSafa[]) ?? []);
        }
        setLoadingSafas(false);
      });

    return () => {
      active = false;
    };
  }, [startDate, endDate]);

  const selection = useMemo(
    () =>
      Object.entries(counts)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
    [counts]
  );

  const totalSafas = selection.reduce((sum, l) => sum + l.quantity, 0);

  // ---- Live server quote, debounced --------------------------------------
  useEffect(() => {
    if (selection.length === 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    let active = true;
    setQuoting(true);
    const timer = setTimeout(() => {
      quoteRental({ startDate, endDate, items: selection, needsArtist })
        .then((result) => {
          if (!active) return;
          setQuote(result);
          setQuoteError(null);
        })
        .catch((err: Error) => {
          if (!active) return;
          setQuote(null);
          setQuoteError(err.message);
        })
        .finally(() => active && setQuoting(false));
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [startDate, endDate, selection, needsArtist]);

  const handlePincode = useCallback(async (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 6);
    setPincode(clean);
    setPincodeResult(clean.length === 6 ? await checkArtistPincode(clean) : null);
  }, []);

  const setCount = (id: string, next: number, max: number) => {
    setCounts((prev) => ({ ...prev, [id]: Math.max(0, Math.min(next, max)) }));
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!quote) {
      setError('Choose at least one safa and valid dates first.');
      return;
    }
    if (pincodeResult && !pincodeResult.deliverable) {
      setError('We do not serve that pincode yet. Contact us to arrange travel.');
      return;
    }

    setSubmitting(true);
    const customer = { name: name.trim(), phone: phone.trim(), venueAddress: venue.trim(), pincode };

    try {
      // The server re-prices and re-checks availability before taking money.
      const created = await createRental(
        { startDate, endDate, items: selection, needsArtist },
        customer
      );

      const ready = await loadRazorpayScript();
      if (!ready) throw new Error('Could not reach the payment provider. Check your connection.');

      const outcome = await payAndVerify(payableFromRental(created), customer);
      setBookedRef(outcome.rentalId ?? created.rentalId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Confirmation ------------------------------------------------------
  if (bookedRef) {
    return (
      <div className="min-h-screen bg-[#FDF6EC] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-amber-200/60 shadow-xl p-10 max-w-md text-center space-y-4"
        >
          <CheckCircle2 size={64} className="text-emerald-500 mx-auto" />
          <h1 className="font-display font-black text-2xl text-maroon-900">Rental Confirmed!</h1>
          <p className="text-xs font-bold text-maroon-800 tracking-wider">
            Reference:{' '}
            <span className="text-gradient-gold">{bookedRef.slice(0, 8).toUpperCase()}</span>
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Your advance has been received. Our team will confirm the safas and, if you asked for
            one, assign a Master Safa Artist for {startDate}.
          </p>
          <Link
            href="/"
            className="inline-block mt-2 px-6 py-3 bg-maroon-950 hover:bg-maroon-900 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest transition-colors"
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-royal-gradient flex items-center justify-center">
              <Crown size={20} className="text-maroon-950" />
            </div>
            <div>
              <h1 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest leading-none">
                Rent Royal Safas
              </h1>
              <p className="text-[10px] text-royal-200/60 uppercase tracking-widest mt-1">
                For your wedding, baraat or event
              </p>
            </div>
          </Link>
          <Link href="/shop" className="text-xs font-bold text-royal-200/70 hover:text-royal-300 uppercase tracking-wider">
            Buy instead →
          </Link>
        </div>
      </header>

      <form onSubmit={handleBook} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid lg:grid-cols-3 gap-8">
        {/* ---------- Left: selection ---------- */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dates */}
          <section className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6">
            <h2 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-amber-600" /> Rental Dates
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  From
                </label>
                <input
                  required
                  type="date"
                  value={startDate}
                  min={dateOffset(0)}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (e.target.value > endDate) setEndDate(e.target.value);
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-maroon-800/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Return by
                </label>
                <input
                  required
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-maroon-800/20 outline-none"
                />
              </div>
            </div>
            {quote && (
              <p className="text-xs text-gray-500 mt-3">
                {quote.days} day{quote.days === 1 ? '' : 's'} · availability below is for these exact dates
              </p>
            )}
          </section>

          {/* Safas */}
          <section className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6">
            <h2 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2 mb-4">
              <Sparkles size={18} className="text-amber-600" /> Choose Safas
            </h2>

            {catalogueError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 mb-4">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <p className="text-xs">{catalogueError}</p>
              </div>
            )}

            {loadingSafas ? (
              <div className="py-10 text-center text-gray-500">
                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-amber-500" />
                <p className="text-xs font-bold">Checking availability…</p>
              </div>
            ) : safas.length === 0 && !catalogueError ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No safas are marked rentable yet. An admin can enable rental on a product in the
                Admin Panel.
              </p>
            ) : (
              <div className="space-y-3">
                {safas.map((safa) => {
                  const chosen = counts[safa.id] ?? 0;
                  const soldOut = safa.available === 0;
                  return (
                    <div
                      key={safa.id}
                      className={`flex items-center gap-4 p-3 rounded-2xl border transition-colors ${
                        soldOut ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-amber-50/40 border-amber-200/70'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={safa.image ?? '/product-maroon-brocade.jpg'}
                        alt={safa.name}
                        className="w-16 h-16 rounded-xl object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-maroon-950 leading-snug">{safa.name}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {safa.fabric}
                          {safa.color ? ` · ${safa.color}` : ''}
                        </p>
                        <p className="text-xs font-black text-gradient-gold mt-1">
                          ₹{safa.rent_price_per_day.toLocaleString()}/day
                          {safa.rent_deposit ? (
                            <span className="text-[10px] font-bold text-gray-400 ml-2">
                              + ₹{safa.rent_deposit.toLocaleString()} refundable deposit
                            </span>
                          ) : null}
                        </p>
                        <p className={`text-[10px] font-bold mt-0.5 ${soldOut ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {soldOut ? 'Fully booked for these dates' : `${safa.available} available`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={soldOut || chosen === 0}
                          onClick={() => setCount(safa.id, chosen - 1, safa.available)}
                          className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-maroon-900 disabled:opacity-40 hover:bg-white"
                          aria-label={`Fewer ${safa.name}`}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-black">{chosen}</span>
                        <button
                          type="button"
                          disabled={soldOut || chosen >= safa.available}
                          onClick={() => setCount(safa.id, chosen + 1, safa.available)}
                          className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-maroon-900 disabled:opacity-40 hover:bg-white"
                          aria-label={`More ${safa.name}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Artist */}
          <section className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={needsArtist}
                onChange={(e) => setNeedsArtist(e.target.checked)}
                className="mt-1 accent-maroon-900 w-4 h-4"
              />
              <span>
                <span className="font-display font-bold text-base text-maroon-950 flex items-center gap-2">
                  <Users size={16} className="text-amber-600" /> Send a Master Safa Artist to tie them
                </span>
                <span className="block text-xs text-gray-500 mt-1 leading-relaxed">
                  Our artist travels to your venue and ties every safa on the day.
                  {quote ? ` ₹${quote.artistPerSafaRate}/safa.` : ''}
                </span>
              </span>
            </label>
          </section>

          {/* Venue + contact */}
          <section className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6 space-y-4">
            <h2 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
              <MapPin size={18} className="text-amber-600" /> Venue & Contact
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <input
                required
                type="text"
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

            <div>
              <input
                required
                type="text"
                inputMode="numeric"
                placeholder="Venue pincode"
                value={pincode}
                onChange={(e) => handlePincode(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-maroon-800/20 outline-none"
              />
              {pincodeResult && (
                <p
                  className={`text-[11px] font-bold mt-1.5 ${
                    pincodeResult.deliverable ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {pincodeResult.message}
                </p>
              )}
            </div>
          </section>
        </div>

        {/* ---------- Right: live quote ---------- */}
        <aside className="lg:col-span-1">
          <div className="sticky top-28 bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6 space-y-4">
            <h2 className="font-display font-bold text-lg text-maroon-950">Your Rental</h2>

            {quoting && (
              <p className="text-xs text-gray-400 flex items-center gap-2">
                <Loader2 size={13} className="animate-spin" /> Pricing…
              </p>
            )}

            {quoteError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">{quoteError}</p>
              </div>
            )}

            {!quote && !quoteError && (
              <p className="text-xs text-gray-500 py-6 text-center">
                Pick your dates and safas to see the price.
              </p>
            )}

            {quote && (
              <>
                <div className="space-y-2 text-xs">
                  {quote.lines.map((line) => (
                    <div key={line.productId} className="flex justify-between gap-3 text-gray-700">
                      <span className="min-w-0">
                        {line.name}
                        <span className="block text-[10px] text-gray-400">
                          {line.quantity} × ₹{line.unitRentPerDay}/day × {quote.days}d
                        </span>
                      </span>
                      <span className="font-bold text-maroon-950 shrink-0">
                        ₹{line.lineRent.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-amber-100 pt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-700">
                    <span>Rent ({quote.safaCount} safa{quote.safaCount === 1 ? '' : 's'})</span>
                    <span className="font-bold">₹{quote.rentAmount.toLocaleString()}</span>
                  </div>
                  {quote.artistAmount > 0 && (
                    <div className="flex justify-between text-gray-700">
                      <span>Artist tying</span>
                      <span className="font-bold">₹{quote.artistAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-700">
                    <span>
                      Refundable deposit
                      <span className="block text-[10px] text-gray-400">Returned after the safas come back</span>
                    </span>
                    <span className="font-bold">₹{quote.depositAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-maroon-950 pt-2 border-t border-amber-100">
                    <span>Total</span>
                    <span className="text-gradient-gold">₹{quote.totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    <span>Pay now (advance)</span>
                    <span>₹{quote.advanceAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <span>On delivery</span>
                    <span>₹{quote.balanceAmount.toLocaleString()}</span>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !quote || totalSafas === 0}
              className="w-full py-4 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 disabled:cursor-not-allowed text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Opening secure payment…
                </>
              ) : (
                <>
                  Pay Advance {quote ? `(₹${quote.advanceAmount.toLocaleString()})` : ''}
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <p className="flex items-start gap-1.5 text-[10px] text-gray-400 leading-relaxed">
              <ShieldCheck size={12} className="shrink-0 mt-0.5" />
              Prices and availability are confirmed by our servers at payment time.
              {!user && ' Sign in to see this rental in your account later.'}
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}
