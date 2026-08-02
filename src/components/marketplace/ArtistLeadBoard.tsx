'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Megaphone, Calendar, MapPin, Users, Loader2, AlertCircle, CheckCircle2, Send,
} from 'lucide-react';
import { listLeadsForArtist, submitQuote, ArtistLead } from '@/lib/marketplace';

/**
 * Open enquiries an artist can quote on.
 *
 * Rival quote AMOUNTS are never fetched — only the count — because the sealed
 * bid is the point. Seeing the numbers would turn this into a race to the
 * bottom rather than a fair market.
 */
export function ArtistLeadBoard({ artistId }: { artistId: string }) {
  const [leads, setLeads] = useState<ArtistLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [openFor, setOpenFor] = useState<string | null>(null);
  const [rate, setRate] = useState('50');
  const [message, setMessage] = useState('');
  const [withTeam, setWithTeam] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLeads(await listLeadsForArtist(artistId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load enquiries.');
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (lead: ArtistLead) => {
    const perSafa = Number(rate);
    if (!Number.isFinite(perSafa) || perSafa <= 0) {
      setError('Enter your rate per safa.');
      return;
    }

    setBusy(lead.id);
    setError(null);
    setNotice(null);

    try {
      await submitQuote({
        leadId: lead.id,
        artistId,
        perSafaRate: perSafa,
        safaCount: lead.safa_count,
        message,
        canBringTeam: withTeam,
      });
      setNotice('Quote sent. The customer will see it alongside any others.');
      setOpenFor(null);
      setMessage('');
      setWithTeam(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your quote.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <section className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-8 text-center">
        <Loader2 size={22} className="animate-spin mx-auto mb-2 text-amber-500" />
        <p className="text-xs font-bold text-gray-600">Looking for enquiries near you…</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-amber-100">
        <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
          <Megaphone size={18} className="text-amber-600" /> Enquiries Near You
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {leads.length === 0
            ? 'Nothing open in your area right now.'
            : `${leads.length} customer${leads.length === 1 ? '' : 's'} looking for an artist on a date you are free.`}
        </p>
      </div>

      <div className="p-6 space-y-3">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        )}
        {notice && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{notice}</p>
          </div>
        )}

        {leads.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            When a customer near you posts an enquiry for a date you are free, it appears here.
          </p>
        ) : (
          leads.map((lead) => {
            const isOpen = openFor === lead.id;
            const estimate = Number(rate) * lead.safa_count;

            return (
              <div
                key={lead.id}
                className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/70"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-maroon-950">
                      {lead.safa_count} safas
                      {lead.safa_style ? ` · ${lead.safa_style}` : ''}
                    </p>
                    <p className="text-[11px] text-gray-500 flex flex-wrap items-center gap-3 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar size={10} /> {lead.event_date}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={10} /> {lead.city ?? lead.pincode}
                      </span>
                      {lead.guest_count && (
                        <span className="flex items-center gap-1">
                          <Users size={10} /> {lead.guest_count} guests
                        </span>
                      )}
                    </p>
                    {lead.description && (
                      <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed">
                        {lead.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          lead.match_rank === 1
                            ? 'bg-emerald-100 text-emerald-800'
                            : lead.match_rank === 2
                            ? 'bg-royal-100 text-royal-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {lead.match_rank === 1
                          ? 'Your pincode'
                          : lead.match_rank === 2
                          ? 'Your city'
                          : 'Further away'}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {lead.quote_count} artist{lead.quote_count === 1 ? '' : 's'} have quoted
                      </span>
                    </div>
                  </div>

                  {lead.already_quoted ? (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider shrink-0">
                      Quote sent
                    </span>
                  ) : (
                    <button
                      onClick={() => setOpenFor(isOpen ? null : lead.id)}
                      className="px-4 py-2 rounded-xl bg-maroon-950 hover:bg-maroon-900 text-royal-300 text-[10px] font-bold uppercase tracking-wider shrink-0"
                    >
                      {isOpen ? 'Cancel' : 'Send quote'}
                    </button>
                  )}
                </div>

                {isOpen && !lead.already_quoted && (
                  <div className="mt-4 pt-4 border-t border-amber-200/70 space-y-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex-1 min-w-[10rem]">
                        <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                          Your rate per safa (₹)
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={rate}
                          onChange={(e) => setRate(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:ring-2 focus:ring-maroon-800/20"
                        />
                      </label>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                          Your total
                        </p>
                        <p className="font-display font-black text-lg text-gradient-gold">
                          ₹{Number.isFinite(estimate) ? estimate.toLocaleString() : '—'}
                        </p>
                      </div>
                    </div>

                    <textarea
                      rows={2}
                      placeholder="A line about why they should pick you (optional)"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs resize-none outline-none focus:ring-2 focus:ring-maroon-800/20"
                    />

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={withTeam}
                        onChange={(e) => setWithTeam(e.target.checked)}
                        className="accent-maroon-900"
                      />
                      <span className="text-[11px] text-gray-600">
                        I can bring a team for this size
                      </span>
                    </label>

                    <button
                      onClick={() => send(lead)}
                      disabled={busy === lead.id}
                      className="w-full py-3 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      {busy === lead.id ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Sending…
                        </>
                      ) : (
                        <>
                          <Send size={14} /> Send quote
                        </>
                      )}
                    </button>

                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      Quote carefully — you cannot reprice a submitted quote, only withdraw it. You
                      cannot see what other artists have quoted, and they cannot see yours.
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
