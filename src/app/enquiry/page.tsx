'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Crown, Loader2, AlertCircle, CheckCircle2, ArrowLeft, MessageSquare,
  Calendar, MapPin, Users, ShieldCheck, IndianRupee,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  postLead, listMyLeads, listQuotes, acceptQuote, Lead, Quote,
} from '@/lib/marketplace';
import { Stars } from '@/components/reviews/Stars';

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Lead Marketplace, customer side.
 *
 * Post an enquiry, artists in the area quote, the customer picks. Quotes are
 * sorted cheapest first but the artist's rating and verified badge sit right
 * beside the number — the cheapest quote is not automatically the right one.
 */
export default function EnquiryPage() {
  const { user, profile, loading: authLoading } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [quotesByLead, setQuotesByLead] = useState<Record<string, Quote[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', pincode: '302001',
    venueAddress: '', eventDate: dateOffset(21),
    guestCount: '100', safaCount: '100', safaStyle: '', description: '', budgetHint: '',
  });

  useEffect(() => {
    if (profile?.full_name) setForm((f) => ({ ...f, customerName: f.customerName || profile.full_name }));
    if (profile?.phone) setForm((f) => ({ ...f, customerPhone: f.customerPhone || profile.phone! }));
  }, [profile]);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const mine = await listMyLeads(user.id);
      setLeads(mine);

      const pairs = await Promise.all(
        mine.map(async (lead) => [lead.id, await listQuotes(lead.id)] as const)
      );
      setQuotesByLead(Object.fromEntries(pairs));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your enquiries.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('post');
    setError(null);

    try {
      await postLead({
        customerId: user?.id ?? null,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        pincode: form.pincode,
        venueAddress: form.venueAddress,
        eventDate: form.eventDate,
        guestCount: form.guestCount ? Number(form.guestCount) : null,
        safaCount: Number(form.safaCount),
        safaStyle: form.safaStyle,
        description: form.description,
        budgetHint: form.budgetHint ? Number(form.budgetHint) : null,
      });

      setNotice(
        'Enquiry posted. Artists in your area can now send you quotes — you will see them here.'
      );
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post your enquiry.');
    } finally {
      setBusy(null);
    }
  };

  const accept = async (quote: Quote) => {
    if (
      !confirm(
        `Accept ${quote.artist_name}'s quote of ₹${quote.total_amount.toLocaleString()}? This books them and declines the other quotes.`
      )
    )
      return;

    setBusy(quote.id);
    setError(null);

    try {
      await acceptQuote(quote.id);
      setNotice(
        `${quote.artist_name} is booked. You will see the booking under My Bookings, and we will contact you about the advance.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept that quote.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950">
      <header className="sticky top-0 z-40 bg-maroon-950 text-white shadow-lg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-2 text-royal-200/70 hover:text-royal-300">
            <ArrowLeft size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Home</span>
          </Link>
          <div className="text-right">
            <h1 className="flex items-center justify-end gap-2 font-display font-black text-lg text-royal-100 uppercase tracking-widest leading-none">
              Get Quotes
              <span className="w-6 h-6 shrink-0">
                <Image src="/logo.png" alt="" width={24} height={24} className="w-full h-full object-contain" />
              </span>
            </h1>
            <p className="text-[10px] text-royal-200/60 uppercase tracking-widest mt-1">
              Artists bid for your event
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-5">
        {error && (
          <div className="flex items-start gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        )}
        {notice && (
          <div className="flex items-start gap-2 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{notice}</p>
          </div>
        )}

        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full py-4 bg-maroon-950 hover:bg-maroon-900 text-royal-300 font-bold rounded-2xl text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2"
        >
          <MessageSquare size={15} /> {showForm ? 'Cancel' : 'Post a new enquiry'}
        </button>

        {showForm && (
          <motion.form
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={submit}
            className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6 space-y-4"
          >
            <p className="text-xs text-gray-500">
              Tell us what you need. Artists who serve your area and are free that day will send you
              a price.
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              <input
                required placeholder="Your name" value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                className="px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-maroon-800/20"
              />
              <input
                required type="tel" placeholder="Phone / WhatsApp" value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                className="px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-maroon-800/20"
              />
              <input
                required inputMode="numeric" placeholder="Venue pincode" value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                className="px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-maroon-800/20"
              />
              <input
                required type="date" min={dateOffset(0)} value={form.eventDate}
                onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                className="px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-maroon-800/20"
              />
              <input
                type="number" min={1} placeholder="Guests" value={form.guestCount}
                onChange={(e) => setForm({ ...form, guestCount: e.target.value })}
                className="px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-maroon-800/20"
              />
              <input
                required type="number" min={1} placeholder="Safas needed" value={form.safaCount}
                onChange={(e) => setForm({ ...form, safaCount: e.target.value })}
                className="px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-maroon-800/20"
              />
            </div>

            <input
              placeholder="Venue address (optional)" value={form.venueAddress}
              onChange={(e) => setForm({ ...form, venueAddress: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-maroon-800/20"
            />
            <textarea
              rows={2} placeholder="Anything else the artist should know?" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none outline-none focus:ring-2 focus:ring-maroon-800/20"
            />

            <button
              type="submit" disabled={busy === 'post'}
              className="w-full py-3.5 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {busy === 'post' ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Posting…
                </>
              ) : (
                'Post enquiry'
              )}
            </button>
          </motion.form>
        )}

        {!user && !authLoading && (
          <p className="text-xs text-gray-500 text-center leading-relaxed">
            You can post as a guest, but{' '}
            <Link href="/?auth=login&next=%2Fenquiry" className="font-bold text-maroon-800 hover:underline">
              sign in
            </Link>{' '}
            to see the quotes that come back.
          </p>
        )}

        {loading || authLoading ? (
          <div className="py-16 text-center text-gray-500">
            <Loader2 size={26} className="animate-spin mx-auto mb-3 text-amber-500" />
            <p className="text-sm font-bold">Loading…</p>
          </div>
        ) : (
          user &&
          leads.map((lead) => {
            const quotes = quotesByLead[lead.id] ?? [];
            const awarded = lead.status === 'awarded';

            return (
              <section
                key={lead.id}
                className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden"
              >
                <div className="p-6 border-b border-amber-100">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display font-bold text-base text-maroon-950">
                        {lead.safa_count} safas
                      </p>
                      <p className="text-[11px] text-gray-500 flex flex-wrap items-center gap-3 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar size={10} /> {lead.event_date}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={10} /> {lead.pincode}
                        </span>
                        {lead.guest_count && (
                          <span className="flex items-center gap-1">
                            <Users size={10} /> {lead.guest_count} guests
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        awarded
                          ? 'bg-emerald-100 text-emerald-800'
                          : quotes.length > 0
                          ? 'bg-royal-100 text-royal-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {awarded ? 'Booked' : `${quotes.length} quote${quotes.length === 1 ? '' : 's'}`}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  {quotes.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No quotes yet. Artists in your area are being shown this enquiry.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {quotes.map((quote) => (
                        <div
                          key={quote.id}
                          className={`p-4 rounded-2xl border ${
                            quote.status === 'accepted'
                              ? 'bg-emerald-50 border-emerald-300'
                              : quote.status === 'rejected'
                              ? 'bg-gray-50 border-gray-200 opacity-60'
                              : 'bg-amber-50/40 border-amber-200/70'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-maroon-950 flex items-center gap-1.5">
                                {quote.artist_name ?? 'Artist'}
                                {quote.artist_verified && (
                                  <ShieldCheck size={12} className="text-emerald-600" />
                                )}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {(quote.artist_events ?? 0) > 0 ? (
                                  <>
                                    <Stars value={quote.artist_rating ?? 0} size={11} />
                                    <span className="text-[10px] text-gray-500">
                                      {quote.artist_events} events
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-gray-400 font-bold">
                                    New artist
                                  </span>
                                )}
                              </div>
                              {quote.message && (
                                <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed">
                                  {quote.message}
                                </p>
                              )}
                              {quote.can_bring_team && (
                                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-royal-100 text-royal-800 text-[9px] font-black uppercase">
                                  Can bring a team
                                </span>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <p className="font-display font-black text-lg text-gradient-gold">
                                ₹{quote.total_amount.toLocaleString()}
                              </p>
                              <p className="text-[10px] text-gray-500">
                                ₹{quote.per_safa_rate}/safa
                              </p>

                              {!awarded && quote.status === 'submitted' && (
                                <button
                                  onClick={() => accept(quote)}
                                  disabled={busy === quote.id}
                                  className="mt-2 px-4 py-2 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 text-[10px] font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5"
                                >
                                  {busy === quote.id ? (
                                    <Loader2 size={11} className="animate-spin" />
                                  ) : (
                                    <IndianRupee size={11} />
                                  )}
                                  Accept
                                </button>
                              )}
                              {quote.status === 'accepted' && (
                                <span className="inline-block mt-2 text-[10px] font-black uppercase text-emerald-700">
                                  Booked ✓
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {!awarded && quotes.length > 1 && (
                        <p className="text-[10px] text-gray-400 leading-relaxed pt-1">
                          Sorted cheapest first — but check the rating and event count too. The
                          lowest quote is not always the right one for a wedding.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>
            );
          })
        )}

        {user && !loading && leads.length === 0 && !showForm && (
          <div className="bg-white rounded-3xl border border-amber-200/60 p-12 text-center">
            <Crown size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-700">No enquiries yet.</p>
            <p className="text-xs text-gray-500 mt-1">
              Post one and let artists compete for your event.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
