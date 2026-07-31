'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, Calendar, MapPin, Phone, CheckCircle2, Clock,
  User, Sparkles, Filter, ChevronRight, AlertCircle, LogOut, ArrowLeft
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, DBArtistBooking } from '@/lib/supabase';

// Mock initial bookings for testing before DB insertion
const INITIAL_ARTIST_BOOKINGS: DBArtistBooking[] = [
  {
    id: 'b-01',
    customer_name: 'Rajesh Sharma',
    customer_phone: '+91 98290 12345',
    city_venue: 'Rambagh Palace, Jaipur',
    event_date: '2026-08-15',
    safa_style: 'Jodhpuri',
    amount: 50,
    status: 'assigned',
    created_at: '2026-07-29',
  },
  {
    id: 'b-02',
    customer_name: 'Amitabh Verma',
    customer_phone: '+91 98100 54321',
    city_venue: 'Hotel Taj Mahal, Delhi',
    event_date: '2026-08-20',
    safa_style: 'Rounded',
    amount: 50,
    status: 'assigned',
    created_at: '2026-07-30',
  },
  {
    id: 'b-03',
    customer_name: 'Vikramaditya Singh',
    customer_phone: '+91 97722 88990',
    city_venue: 'The Leela Palace, Udaipur',
    event_date: '2026-07-10',
    safa_style: 'Barati Safa',
    amount: 50,
    status: 'completed',
    created_at: '2026-07-05',
  },
];

export default function ArtistPortalPage() {
  const { profile, logout } = useAuth();
  const [bookings, setBookings] = useState<DBArtistBooking[]>(INITIAL_ARTIST_BOOKINGS);
  const [filter, setFilter] = useState<'all' | 'assigned' | 'completed'>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('artist_bookings').select('*');
      if (data && data.length > 0) {
        setBookings(data);
      }
    } catch (err) {
      console.warn('Supabase fetch error, using local bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const markCompleted = async (id: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: 'completed' } : b))
    );

    try {
      await supabase
        .from('artist_bookings')
        .update({ status: 'completed' })
        .eq('id', id);
    } catch (err) {
      console.warn('Update error:', err);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'assigned') return b.status === 'assigned' || b.status === 'pending';
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
              <Link href="/" className="w-10 h-10 rounded-full bg-royal-gradient flex items-center justify-center shadow-md">
                <Crown size={20} className="text-maroon-950" />
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

        {/* Bookings List */}
        <div className="space-y-4">
          {filteredBookings.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-amber-200/60">
              <AlertCircle size={36} className="text-gray-400 mx-auto mb-3" />
              <p className="font-bold text-gray-700">No bookings found in this view.</p>
            </div>
          ) : (
            filteredBookings.map((b) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 border border-amber-200/60 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:shadow-md transition-shadow"
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
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {b.status === 'completed' ? 'Completed ✓' : 'Upcoming Event'}
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

                {b.status !== 'completed' && (
                  <button
                    onClick={() => markCompleted(b.id)}
                    className="w-full md:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <CheckCircle2 size={16} /> Mark Completed
                  </button>
                )}
              </motion.div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
