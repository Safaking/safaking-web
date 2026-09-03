'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Calendar, MapPin, Phone, CheckCircle2, XCircle, Bell,
  User, Sparkles, AlertCircle, LogOut, ArrowLeft, Loader2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, friendlyError, DBArtistBooking } from '@/lib/supabase';
import { VerificationPanel } from '@/components/verification/VerificationPanel';
import { DigitalIdCard } from '@/components/verification/DigitalIdCard';
import { PortfolioManager } from '@/components/reviews/PortfolioManager';
import { ArtistCheckin } from '@/components/liveops/ArtistCheckin';
import { ArtistLeadBoard } from '@/components/marketplace/ArtistLeadBoard';

export default function ArtistPortalPage() {
  const { profile, user, logout } = useAuth();
  const [bookings, setBookings] = useState<DBArtistBooking[]>([]);
  const [filter, setFilter] = useState<'all' | 'assigned' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const markCompleted = async (id: string) => {
    const previous = bookings;
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'completed' } : b)));

    const { error: updateErr } = await supabase
      .from('artist_bookings')
      .update({ status: 'completed' })
      .eq('id', id);

    if (updateErr) {
      setBookings(previous); // Roll the optimistic update back.
      setError(friendlyError(updateErr));
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

  const pendingOffers = bookings.filter((b) => b.status === 'offered');

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'assigned') return b.status === 'assigned' || b.status === 'offered' || b.status === 'pending';
    if (filter === 'completed') return b.status === 'completed';
    return true;
  });

  const totalEarned = bookings
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + b.amount, 0);

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
                      <span>Tying Fee: <strong className="text-gradient-gold">₹{b.amount}</strong></span>
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
                  <button
                    onClick={() => markCompleted(b.id)}
                    className="w-full md:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <CheckCircle2 size={16} /> Mark Completed
                  </button>
                ) : null}
              </motion.div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
