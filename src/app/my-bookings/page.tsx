'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Crown, Loader2, AlertCircle, CheckCircle2, MessageSquare, ArrowLeft, LogOut,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  listReviewableBookings, submitReview, ReviewableBooking,
} from '@/lib/reviews';
import { Stars } from '@/components/reviews/Stars';
import { ActiveBookingTracker } from '@/components/tracking/ActiveBookingTracker';

/**
 * Post-event review prompt.
 *
 * Only lists bookings the database would actually accept a review for, so a
 * customer is never invited to write one and then rejected by RLS.
 */
export default function MyBookingsPage() {
  const { user, loading: authLoading, logout } = useAuth();

  const [pending, setPending] = useState<ReviewableBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);

  const [openFor, setOpenFor] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const keyOf = (b: ReviewableBooking) => b.rentalId ?? b.bookingId ?? '';

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setPending(await listReviewableBookings(user.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your bookings.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  const send = async (booking: ReviewableBooking) => {
    if (!user) return;
    setSaving(true);
    setError(null);

    try {
      await submitReview({
        reviewerId: user.id,
        subjectType: 'artist',
        subjectId: booking.artistId,
        rentalId: booking.rentalId,
        bookingId: booking.bookingId,
        rating,
        comment,
      });
      setDone((prev) => [...prev, keyOf(booking)]);
      setOpenFor(null);
      setComment('');
      setRating(5);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your review.');
    } finally {
      setSaving(false);
    }
  };

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-[#FDF6EC] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-amber-200/60 p-10 max-w-md text-center">
          <Crown size={34} className="text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-700">Sign in to see your bookings.</p>
          <Link
            href="/?auth=login&next=%2Fmy-bookings"
            className="inline-block mt-4 px-5 py-2.5 bg-maroon-950 text-royal-300 text-xs font-bold uppercase tracking-wider rounded-xl"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950">
      <header className="sticky top-0 z-40 bg-maroon-950 text-white shadow-lg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-2 text-royal-200/70 hover:text-royal-300">
            <ArrowLeft size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Home</span>
          </Link>
          <h1 className="flex items-center gap-2 font-display font-black text-lg text-royal-100 uppercase tracking-widest">
            <span className="w-6 h-6 shrink-0">
              <Image src="/logo.png" alt="" width={24} height={24} className="w-full h-full object-contain" />
            </span>
            My Bookings
          </h1>
          {user && (
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-royal-200/70 hover:text-royal-300"
              title="Sign out"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Logout</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {user && <ActiveBookingTracker userId={user.id} />}

        {error && (
          <div className="flex items-start gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        )}

        {loading || authLoading ? (
          <div className="py-20 text-center text-gray-500">
            <Loader2 size={28} className="animate-spin mx-auto mb-3 text-amber-500" />
            <p className="text-sm font-bold">Loading…</p>
          </div>
        ) : pending.length === 0 ? (
          <div className="bg-white rounded-3xl border border-amber-200/60 p-12 text-center">
            <CheckCircle2 size={34} className="text-emerald-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-700">Nothing waiting for a review.</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Once an event is completed, it appears here so you can rate your artist.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              These events are finished. Your rating helps other couples choose.
            </p>

            {pending.map((booking) => {
              const key = keyOf(booking);
              const isOpen = openFor === key;
              const isDone = done.includes(key);

              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-maroon-950">
                        {booking.artistName || 'Your Safa Artist'}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {booking.label} · {booking.when}
                      </p>
                    </div>

                    {isDone ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider">
                        <CheckCircle2 size={13} /> Thank you
                      </span>
                    ) : (
                      <button
                        onClick={() => setOpenFor(isOpen ? null : key)}
                        className="px-4 py-2 bg-maroon-950 hover:bg-maroon-900 text-royal-300 text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5"
                      >
                        <MessageSquare size={13} /> {isOpen ? 'Cancel' : 'Rate artist'}
                      </button>
                    )}
                  </div>

                  {isOpen && !isDone && (
                    <div className="mt-4 pt-4 border-t border-amber-100 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-600">Your rating</span>
                        <Stars value={rating} size={22} onChange={setRating} />
                      </div>
                      <textarea
                        rows={3}
                        placeholder="How was the tying, punctuality and behaviour? (optional)"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:ring-2 focus:ring-maroon-800/20 outline-none"
                      />
                      <button
                        onClick={() => send(booking)}
                        disabled={saving}
                        className="w-full py-3 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        {saving ? (
                          <>
                            <Loader2 size={14} className="animate-spin" /> Saving…
                          </>
                        ) : (
                          'Submit Review'
                        )}
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
