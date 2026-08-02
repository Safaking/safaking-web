'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Siren, Loader2, AlertCircle, CheckCircle2, ShieldCheck, Phone, MapPin, RefreshCw,
} from 'lucide-react';
import {
  listAtRisk, findReplacements, assignReplacement,
  AtRiskBooking, ReplacementCandidate,
} from '@/lib/liveops';
import { getWhatsAppClickLink } from '@/lib/whatsapp';

const STAGE_LABEL: Record<string, string> = {
  no_checkin: 'No check-in',
  en_route: 'Says on the way',
  no_show: 'Marked no-show',
};

/**
 * Admin live-ops board.
 *
 * Lists today's events where the artist has not confirmed arrival, and offers
 * one-click replacement from artists who are genuinely free right now.
 */
export function LiveOpsBoard() {
  const [rows, setRows] = useState<AtRiskBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [openFor, setOpenFor] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ReplacementCandidate[]>([]);
  const [finding, setFinding] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  const keyOf = (row: AtRiskBooking) => row.rental_id ?? row.booking_id ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listAtRisk());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load live operations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // An artist who arrives late should drop off the board without a manual
    // refresh — on event day this screen is watched, not polled by hand.
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const openReplacements = async (row: AtRiskBooking) => {
    const key = keyOf(row);
    if (openFor === key) {
      setOpenFor(null);
      return;
    }

    setOpenFor(key);
    setCandidates([]);
    setFinding(true);
    setError(null);

    try {
      const result = await findReplacements({
        rentalId: row.rental_id,
        bookingId: row.booking_id,
      });
      setCandidates(result.candidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not find replacements.');
    } finally {
      setFinding(false);
    }
  };

  const assign = async (row: AtRiskBooking, candidate: ReplacementCandidate) => {
    const reason = window.prompt(
      `Replacing ${row.artist_name ?? 'the assigned artist'} with ${candidate.display_name}. Why?`,
      'Original artist did not arrive'
    );
    if (reason === null || !reason.trim()) return;

    setAssigning(candidate.id);
    setError(null);
    setNotice(null);

    try {
      const result = await assignReplacement({
        rentalId: row.rental_id,
        bookingId: row.booking_id,
        replacementArtistId: candidate.id,
        reason,
      });
      setNotice(
        result.warning ??
          `${result.replacementArtistName} is now assigned. Call them to confirm they are moving.`
      );
      setOpenFor(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign a replacement.');
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
            <Siren size={18} className={rows.length > 0 ? 'text-rose-600' : 'text-emerald-600'} />
            Live Operations
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Events today whose artist has not confirmed arrival. Refreshes every minute.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold uppercase tracking-wider text-maroon-900"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 m-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 p-4 m-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
          <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{notice}</p>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 size={26} className="animate-spin mx-auto mb-3 text-amber-500" />
          <p className="text-sm font-bold text-gray-600">Checking today&apos;s events…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="p-12 text-center">
          <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-600">All artists on track.</p>
          <p className="text-xs text-gray-500 mt-1">
            Nothing today is past its expected arrival time without a check-in.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-amber-100">
          {rows.map((row) => {
            const key = keyOf(row);
            const isOpen = openFor === key;

            return (
              <div key={key} className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider">
                        {STAGE_LABEL[row.stage] ?? row.stage}
                      </span>
                      <span className="text-[11px] text-gray-500">{row.event_date}</span>
                    </div>

                    <p className="font-bold text-sm text-maroon-950 mt-2">
                      {row.customer_name}
                      {row.safa_count ? ` · ${row.safa_count} safas` : ''}
                    </p>
                    <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                      <MapPin size={10} /> {row.venue_address ?? '—'}
                      {row.pincode ? ` (${row.pincode})` : ''}
                    </p>
                    <p className="text-[11px] text-gray-600 mt-1">
                      Assigned: <strong>{row.artist_name ?? 'Unassigned'}</strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <a
                      href={getWhatsAppClickLink(
                        row.customer_phone,
                        `Namaste ${row.customer_name}, this is SafaKing calling about your event today.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wider"
                    >
                      <Phone size={12} /> Customer
                    </a>
                    <button
                      onClick={() => openReplacements(row)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-maroon-950 hover:bg-maroon-900 text-royal-300 text-[11px] font-bold uppercase tracking-wider"
                    >
                      <Siren size={12} /> {isOpen ? 'Close' : 'Find replacement'}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-amber-100">
                    {finding ? (
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <Loader2 size={13} className="animate-spin" /> Finding artists free right
                        now…
                      </p>
                    ) : candidates.length === 0 ? (
                      <p className="text-xs text-rose-700">
                        No other artist is free for this date and area. Call the customer and agree
                        an alternative.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                          Available now — nearest first
                        </p>
                        {candidates.slice(0, 6).map((candidate) => (
                          <div
                            key={candidate.id}
                            className="flex items-center gap-3 p-3 rounded-2xl bg-amber-50/50 border border-amber-200/70"
                          >
                            <div className="w-9 h-9 rounded-full bg-maroon-950 text-royal-300 flex items-center justify-center font-black text-sm shrink-0">
                              {candidate.display_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-xs text-maroon-950 flex items-center gap-1.5">
                                {candidate.display_name}
                                {candidate.verified && (
                                  <ShieldCheck size={11} className="text-emerald-600" />
                                )}
                                <span className="text-[9px] font-black uppercase text-gray-400">
                                  {candidate.match_rank === 1
                                    ? 'same pincode'
                                    : candidate.match_rank === 2
                                    ? 'same city'
                                    : 'further away'}
                                </span>
                              </p>
                              <p className="text-[10px] text-gray-500">
                                {candidate.base_city ?? 'Nationwide'} · ties{' '}
                                {candidate.safas_per_day}/day · {candidate.total_events} events
                              </p>
                            </div>

                            {candidate.phone && (
                              <a
                                href={getWhatsAppClickLink(
                                  candidate.phone,
                                  `Urgent SafaKing job today at ${row.venue_address ?? row.pincode}. Are you available?`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg bg-emerald-100 text-emerald-700"
                                title="WhatsApp this artist"
                              >
                                <Phone size={12} />
                              </a>
                            )}

                            <button
                              onClick={() => assign(row, candidate)}
                              disabled={assigning === candidate.id}
                              className="px-3 py-1.5 rounded-lg bg-maroon-950 hover:bg-maroon-900 disabled:opacity-50 text-royal-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                            >
                              {assigning === candidate.id ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : null}
                              Assign
                            </button>
                          </div>
                        ))}
                        <p className="text-[10px] text-gray-400 leading-relaxed pt-1">
                          &ldquo;Nearest&rdquo; means matching pincode, then city — SafaKing does not
                          track artist GPS, so this is service-area proximity rather than distance.
                          Always call before assigning.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
