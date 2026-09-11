'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Calendar, MapPin, Phone, CheckCircle2, XCircle, Bell,
  User, Sparkles, AlertCircle, LogOut, ArrowLeft, Loader2, ShieldAlert
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, friendlyError, DBArtistBooking } from '@/lib/supabase';
import { ArtistStanding, STANDING_LABEL, blocksWork } from '@/lib/artist-standing';
import { verifyCompletionCode } from '@/lib/client-update';
import { VerificationPanel } from '@/components/verification/VerificationPanel';
import { DigitalIdCard } from '@/components/verification/DigitalIdCard';
import { PortfolioManager } from '@/components/reviews/PortfolioManager';
import { ArtistCheckin } from '@/components/liveops/ArtistCheckin';
import { ArtistLeadBoard } from '@/components/marketplace/ArtistLeadBoard';
import { ArtistComplaints } from '@/components/complaints/ArtistComplaints';
import { ArtistQualityCard } from '@/components/quality/ArtistQualityCard';

/**
 * The one rule an artist is most tempted to break: taking a SafaKing
 * customer's next booking privately. It runs across the top of every visit
 * rather than living once in an agreement they ticked months ago.
 */
const PLATFORM_RULE =
  'SafaKing से आई बुकिंग के customer से सीधे booking लेना, या आगे की booking के लिए उनसे सीधे संपर्क करना मना है — इसे platform policy का उल्लंघन माना जाएगा। हर booking और भुगतान केवल SafaKing के ज़रिए।' +
  '   ·   Never take a booking directly from a SafaKing customer, or ask them to book you directly in future — it is a violation of platform policy.';

export default function ArtistPortalPage() {
  const { profile, user, logout } = useAuth();
  const [bookings, setBookings] = useState<DBArtistBooking[]>([]);
  const [filter, setFilter] = useState<'all' | 'assigned' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // KYC is a hard gate on receiving work, so the portal has to say so loudly
  // rather than leaving an approved artist waiting for offers that the
  // dispatch board will never let an admin send them.
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [standing, setStanding] = useState<{ level: ArtistStanding; until: string | null; note: string | null }>({
    level: 'good', until: null, note: null,
  });

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    // RLS already limits an artist to their own rows; the explicit filter keeps
    // an admin previewing this page from seeing the whole dispatch board.
    const { data, error: fetchErr } = await supabase
      .from('artist_bookings')
      .select('*')
      .eq('artist_id', user.id)
      .order('event_date', { ascending: true });

    if (fetchErr) {
      setError(friendlyError(fetchErr));
      setBookings([]);
    } else {
      setBookings((data as DBArtistBooking[]) ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('artist_profiles')
      .select('verification_status, standing, restricted_until, standing_note')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setKycStatus((data?.verification_status as string) ?? 'unverified');
        setStanding({
          level: (data?.standing as ArtistStanding) ?? 'good',
          until: (data?.restricted_until as string) ?? null,
          note: (data?.standing_note as string) ?? null,
        });
      });
  }, [user]);

  // Completion goes through the customer's completion code, never a bare
  // status update: verify_completion_code() is what flips the job to
  // 'completed' AND sets payment_release_status='ready_for_review', which is
  // the only way it reaches the admin's Payment Release queue. The old
  // direct update skipped that, so a self-completed job could never be paid.
  const markCompleted = async (id: string) => {
    const code = window.prompt(
      'Ask the customer for their 6-digit Completion Code (shown in their My Bookings) and enter it here:'
    );
    if (!code?.trim()) return;

    setError(null);
    try {
      const ok = await verifyCompletionCode('booking', id, code);
      if (!ok) {
        setError('That completion code did not match. Please check it with the customer and try again.');
        return;
      }
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: 'completed' } : b))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : friendlyError(err));
    }
  };

  // Accept keeps artist_id as-is (passes RLS's `artist_id = auth.uid()` check
  // both before and after). Decline deliberately leaves artist_id in place
  // too, rather than nulling it — an artist can only update rows where
  // artist_id already equals their own id, so clearing it would fail RLS;
  // it also preserves who declined for the admin to see before re-offering.
  const respondToOffer = async (id: string, accept: boolean) => {
    const previous = bookings;
    const nextStatus = accept ? 'assigned' : 'declined';
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: nextStatus } : b)));

    const { error: updateErr } = await supabase
      .from('artist_bookings')
      .update({ status: nextStatus })
      .eq('id', id);

    if (updateErr) {
      setBookings(previous);
      setError(friendlyError(updateErr));
    }
  };

  /**
   * Pulling out of a booking already accepted. It used to be a phone call that
   * left no trace; now the reason is recorded, operations and the customer are
   * told, backups are searched for, and it counts toward the artist's standing
   * — which is why it asks for a reason and says so plainly first.
   */
  const withdraw = async (b: DBArtistBooking) => {
    const reason = window.prompt(
      `You accepted ${b.customer_name}'s booking on ${b.event_date}.\n\n` +
      'Pulling out now is recorded against your standing, and SafaKing will arrange another artist for the customer.\n\n' +
      "Why can't you make it?"
    );
    if (reason === null) return;
    if (reason.trim().length < 10) {
      setError('Please explain in a little more detail (at least 10 characters).');
      return;
    }
    setError(null);
    setNotice(null);
    const res = await fetch('/api/artist/incident', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: b.id, kind: 'withdrew_after_accept', reason: reason.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body?.error ?? 'Could not record that. Please call SafaKing.');
      return;
    }
    setNotice(body.message);
    await fetchBookings();
  };

  const pendingOffers = bookings.filter((b) => b.status === 'offered');

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'assigned') return b.status === 'assigned' || b.status === 'offered' || b.status === 'pending';
    if (filter === 'completed') return b.status === 'completed';
    return true;
  });

  const totalEarned = bookings
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + (b.artist_payout_amount ?? b.amount), 0);

  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-maroon-950 text-white shadow-lg border-b border-royal-400/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4">
              <Link href="/" className="w-10 h-10 shrink-0">
                <Image src="/logo.png" alt="SafaKing" width={40} height={40} className="w-full h-full object-contain" />
              </Link>
              <div>
                <h1 className="font-display font-black text-xl text-royal-100 uppercase tracking-widest leading-none">
                  Safa Artist Portal
                </h1>
                <p className="text-[10px] text-royal-200/60 uppercase tracking-widest mt-1">
                  Welcome, {profile?.full_name || 'Master Safa Artist'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="hidden sm:flex items-center gap-1.5 text-xs text-royal-200/70 hover:text-royal-300 font-bold uppercase tracking-wider"
              >
                <ArrowLeft size={14} /> Back to Site
              </Link>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-royal-100 font-bold uppercase tracking-wider transition-colors"
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        <div
          role="note"
          aria-label={PLATFORM_RULE}
          className="sk-ticker mb-6 flex items-center gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 py-2.5 pl-3 pr-2 overflow-hidden"
        >
          <span className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest">
            नियम
          </span>
          <div className="sk-ticker-track min-w-0 flex-1">
            <p className="sk-ticker-text text-[13px] font-bold text-rose-900">{PLATFORM_RULE}</p>
            <p className="sk-ticker-text text-[13px] font-bold text-rose-900" aria-hidden="true">{PLATFORM_RULE}</p>
          </div>
        </div>

        {/* A lapsed restriction is simply good standing again. */}
        {standing.level !== 'good' && !(standing.level === 'restricted' && !blocksWork(standing.level, standing.until)) && (
          <div
            className={`flex items-start gap-3 p-5 mb-8 rounded-3xl border-2 shadow-sm ${
              blocksWork(standing.level, standing.until)
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            <ShieldAlert size={22} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-black text-base">
                {STANDING_LABEL[standing.level]}
                {standing.level === 'restricted' && standing.until
                  ? ` until ${new Date(standing.until).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}`
                  : ''}
              </p>
              <p className="text-xs leading-relaxed mt-1">
                {blocksWork(standing.level, standing.until)
                  ? 'You cannot be given new bookings or send quotes right now.'
                  : 'This is a formal warning. Another pull-out, no-show or late arrival can lead to a restriction.'}
                {standing.note ? <> Reason: <span className="font-bold">{standing.note}</span>.</> : null}{' '}
                Call SafaKing if you think this is wrong.
              </p>
            </div>
          </div>
        )}

        {kycStatus && kycStatus !== 'verified' && (
          <div className="flex items-start gap-3 p-5 mb-8 rounded-3xl bg-amber-50 border-2 border-amber-300 text-amber-900 shadow-sm">
            <ShieldAlert size={22} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-black text-base">
                {kycStatus === 'pending'
                  ? 'Your documents are being reviewed'
                  : kycStatus === 'rejected'
                    ? 'Your documents were rejected — please re-upload'
                    : 'One step left: upload your KYC documents'}
              </p>
              <p className="text-xs leading-relaxed mt-1">
                You cannot be given bookings or send quotes until your KYC is approved. Scroll down
                to <span className="font-black">Verification &amp; Documents</span> to
                {kycStatus === 'pending' ? ' check the status.' : ' upload them.'}
              </p>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          <motion.div
            whileHover={{ y: -4 }}
            className="p-6 rounded-3xl bg-white border border-amber-200/60 shadow-sm flex items-center gap-5"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Calendar size={26} />
            </div>
            <div>
              <p className="text-[10px] font-black text-amber-800/60 uppercase tracking-widest">Assigned Events</p>
              <p className="text-3xl font-display font-black text-maroon-950 mt-0.5">
                {bookings.filter((b) => b.status === 'assigned' || b.status === 'pending').length}
              </p>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -4 }}
            className="p-6 rounded-3xl bg-white border border-amber-200/60 shadow-sm flex items-center gap-5"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 size={26} />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest">Completed Weddings</p>
              <p className="text-3xl font-display font-black text-maroon-950 mt-0.5">
                {bookings.filter((b) => b.status === 'completed').length}
              </p>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -4 }}
            className="p-6 rounded-3xl bg-white border border-amber-200/60 shadow-sm flex items-center gap-5"
          >
            <div className="w-14 h-14 rounded-2xl bg-royal-100 text-royal-800 flex items-center justify-center">
              <Sparkles size={26} />
            </div>
            <div>
              <p className="text-[10px] font-black text-royal-800/60 uppercase tracking-widest">Total Payout</p>
              <p className="text-3xl font-display font-black text-maroon-950 mt-0.5">
                ₹{totalEarned}
              </p>
            </div>
          </motion.div>
        </div>

        {user && <ArtistQualityCard artistId={user.id} />}

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="font-display font-black text-2xl text-maroon-900">
            Assigned Bookings Schedule
          </h2>

          <div className="flex bg-white p-1 rounded-2xl border border-amber-200/60 shadow-sm">
            {(['all', 'assigned', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                  filter === tab
                    ? 'bg-maroon-950 text-royal-300 shadow-md'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {user && (
          <div className="mb-8 space-y-6">
            <ArtistComplaints artistId={user.id} artistName={profile?.full_name || 'Artist'} />
            <ArtistCheckin artistId={user.id} />
            <ArtistLeadBoard artistId={user.id} />
            <VerificationPanel ownerId={user.id} subjectType="artist" />
            <DigitalIdCard artistId={user.id} />
            <PortfolioManager artistId={user.id} />
          </div>
        )}

        {pendingOffers.length > 0 && (
          <div className="flex items-center gap-3 p-4 mb-6 rounded-2xl bg-amber-100 border-2 border-amber-400 text-amber-900 shadow-md">
            <Bell size={20} className="shrink-0 animate-pulse" />
            <p className="text-sm font-bold">
              You have {pendingOffers.length} new booking {pendingOffers.length === 1 ? 'offer' : 'offers'} waiting — accept or decline below.
            </p>
          </div>
        )}

        {notice && (
          <div className="flex items-start gap-2 p-4 mb-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{notice}</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-4 mb-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        )}

        {/* Bookings List */}
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-amber-200/60">
              <Loader2 size={30} className="text-amber-500 mx-auto mb-3 animate-spin" />
              <p className="font-bold text-gray-700 text-sm">Loading your bookings…</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-amber-200/60">
              <AlertCircle size={36} className="text-gray-400 mx-auto mb-3" />
              <p className="font-bold text-gray-700">No bookings found in this view.</p>
              <p className="text-xs text-gray-500 mt-1.5">
                An admin assigns weddings to you from the Admin Panel — they appear here straight away.
              </p>
            </div>
          ) : (
            filteredBookings.map((b) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-3xl p-6 border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:shadow-md transition-shadow ${
                  b.status === 'offered' ? 'border-amber-400 border-2' : 'border-amber-200/60'
                }`}
              >
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-3 py-1 bg-royal-100 text-royal-800 text-xs font-black uppercase tracking-wider rounded-full">
                      {b.safa_style} Style
                    </span>
                    <span
                      className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full ${
                        b.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : b.status === 'offered'
                          ? 'bg-amber-200 text-amber-900'
                          : b.status === 'declined'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {b.status === 'completed'
                        ? 'Completed ✓'
                        : b.status === 'offered'
                        ? 'New Offer — Respond'
                        : b.status === 'declined'
                        ? 'Declined'
                        : 'Upcoming Event'}
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-xl text-maroon-950 flex items-center gap-2">
                    <User size={18} className="text-maroon-700" /> Client: {b.customer_name}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-maroon-900/70">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-amber-600" />
                      <span>Date: <strong>{b.event_date}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-amber-600" />
                      <span>Venue: <strong>{b.city_venue}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-amber-600" />
                      <span>Phone: <a href={`tel:${b.customer_phone}`} className="font-bold underline text-maroon-900">{b.customer_phone}</a></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-amber-600" />
                      <span>
                        Your Payout:{' '}
                        <strong className="text-gradient-gold">
                          ₹{(b.artist_payout_amount ?? b.amount).toLocaleString()}
                        </strong>
                        {b.artist_payout_amount != null && b.artist_payout_amount !== b.amount && (
                          <span className="text-[11px] text-gray-500">
                            {' '}(customer pays ₹{b.amount.toLocaleString()} — our charge is on top,
                            nothing is cut from you)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {b.status === 'offered' ? (
                  <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <button
                      onClick={() => respondToOffer(b.id, true)}
                      className="w-full md:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <CheckCircle2 size={16} /> Accept
                    </button>
                    <button
                      onClick={() => respondToOffer(b.id, false)}
                      className="w-full md:w-auto px-6 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <XCircle size={16} /> Decline
                    </button>
                  </div>
                ) : b.status !== 'completed' && b.status !== 'declined' ? (
                  <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <button
                    onClick={() => markCompleted(b.id)}
                    className="w-full md:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <CheckCircle2 size={16} /> Mark Completed
                  </button>
                    {b.status === 'assigned' && (
                      <button
                        onClick={() => withdraw(b)}
                        className="w-full md:w-auto px-5 py-3.5 bg-white border-2 border-rose-300 hover:bg-rose-50 text-rose-700 font-bold text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-colors"
                      >
                        <XCircle size={16} /> Can&apos;t make it
                      </button>
                    )}
                  </div>
                ) : null}
              </motion.div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
