'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, UserPlus, CheckCircle2, Mail, Plus, X } from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  INCIDENT_LABEL, IncidentKind, STANDING_LABEL, STANDING_TONE, ArtistStanding,
} from '@/lib/artist-standing';

interface Candidate {
  id: string;
  display_name: string;
  base_city: string | null;
  rating: number | null;
  match_rank: number;
}

interface Incident {
  id: string;
  artist_id: string;
  booking_id: string | null;
  rental_id: string | null;
  kind: IncidentKind;
  reason: string;
  points: number;
  reported_role: string | null;
  backup_candidates: Candidate[] | null;
  ops_notified_at: string | null;
  customer_notified_at: string | null;
  created_at: string;
}

interface Recommendation {
  points: number;
  incidents: number;
  recommended: ArtistStanding;
}

interface OpenJob {
  id: string;
  customer_name: string;
  event_date: string;
  artist_id: string;
  artist_name: string | null;
}

/**
 * Artist incidents that still need someone to act.
 *
 * Each shows what happened, who was told, the backups found at the moment it
 * was recorded, and — one tap — reassigning to one of them through the same
 * replacement route Live Ops already uses, so KYC, standing and availability
 * are all re-checked on the way.
 */
export function ArtistIncidentsPanel() {
  const { profile } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [names, setNames] = useState<Record<string, { name: string; standing: ArtistStanding }>>({});
  const [bookings, setBookings] = useState<Record<string, { customer: string; date: string }>>({});
  const [recs, setRecs] = useState<Record<string, Recommendation>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [jobs, setJobs] = useState<OpenJob[]>([]);
  const [jobId, setJobId] = useState('');
  const [kind, setKind] = useState<IncidentKind>('no_show');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('artist_incidents')
      .select('*')
      .is('resolved_at', null)
      .order('created_at', { ascending: false });

    if (err) {
      // The table arrives with supabase/036; until then this panel stays quiet.
      if (err.code !== 'PGRST205' && err.code !== '42P01') setError(friendlyError(err));
      setIncidents([]);
      setLoading(false);
      return;
    }

    const list = (data as Incident[]) ?? [];
    setIncidents(list);

    const artistIds = [...new Set(list.map((i) => i.artist_id))];
    const bookingIds = list.map((i) => i.booking_id).filter(Boolean) as string[];
    const rentalIds = list.map((i) => i.rental_id).filter(Boolean) as string[];

    const [a, b, r] = await Promise.all([
      artistIds.length
        ? supabase.from('artist_profiles').select('id, display_name, standing').in('id', artistIds)
        : Promise.resolve({ data: [] }),
      bookingIds.length
        ? supabase.from('artist_bookings').select('id, customer_name, event_date').in('id', bookingIds)
        : Promise.resolve({ data: [] }),
      rentalIds.length
        ? supabase.from('rental_bookings').select('id, customer_name, start_date').in('id', rentalIds)
        : Promise.resolve({ data: [] }),
    ]);

    setNames(Object.fromEntries(((a.data ?? []) as { id: string; display_name: string; standing: ArtistStanding }[])
      .map((x) => [x.id, { name: x.display_name, standing: x.standing ?? 'good' }])));
    setBookings({
      ...Object.fromEntries(((b.data ?? []) as { id: string; customer_name: string; event_date: string }[])
        .map((x) => [x.id, { customer: x.customer_name, date: x.event_date }])),
      ...Object.fromEntries(((r.data ?? []) as { id: string; customer_name: string; start_date: string }[])
        .map((x) => [x.id, { customer: x.customer_name, date: x.start_date }])),
    });

    const recEntries = await Promise.all(artistIds.map(async (id) => {
      const { data: rec } = await supabase.rpc('artist_standing_recommendation', { p_artist_id: id });
      return [id, rec as Recommendation] as const;
    }));
    setRecs(Object.fromEntries(recEntries.filter(([, rec]) => rec)));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openRecorder = async () => {
    setRecording(true);
    const since = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA');
    const { data } = await supabase
      .from('artist_bookings')
      .select('id, customer_name, event_date, artist_id, artist_name')
      .not('artist_id', 'is', null)
      .in('status', ['assigned', 'offered'])
      .gte('event_date', since)
      .order('event_date', { ascending: true })
      .limit(50);
    setJobs((data as OpenJob[]) ?? []);
  };

  const record = async () => {
    if (!jobId || reason.trim().length < 10) {
      setError('Pick the booking and describe what happened (at least 10 characters).');
      return;
    }
    setBusy('record');
    setError(null);
    try {
      const res = await fetch('/api/artist/incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: jobId, kind, reason: reason.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Could not record the incident.');
      setNotice(body.warning ?? body.message);
      setRecording(false);
      setJobId('');
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the incident.');
    } finally {
      setBusy(null);
    }
  };

  const assign = async (incident: Incident, candidate: Candidate) => {
    setBusy(incident.id);
    setError(null);
    try {
      const res = await fetch('/api/ops/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: incident.booking_id ?? undefined,
          rentalId: incident.rental_id ?? undefined,
          replacementArtistId: candidate.id,
          reason: `Replacing after "${INCIDENT_LABEL[incident.kind]}": ${incident.reason}`,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Could not assign that artist.');

      await supabase.from('artist_incidents').update({
        replacement_artist_id: candidate.id,
        resolved_at: new Date().toISOString(),
        resolved_by: profile?.id ?? null,
        resolution_note: `Replaced by ${candidate.display_name}`,
      }).eq('id', incident.id);

      setNotice(`${candidate.display_name} is now on the booking. The assignment still needs the owner's approval.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign that artist.');
    } finally {
      setBusy(null);
    }
  };

  const close = async (incident: Incident) => {
    const note = window.prompt('How was this settled without a replacement?');
    if (note === null || !note.trim()) return;
    setBusy(incident.id);
    const { error: err } = await supabase.from('artist_incidents').update({
      resolved_at: new Date().toISOString(),
      resolved_by: profile?.id ?? null,
      resolution_note: note.trim(),
    }).eq('id', incident.id);
    if (err) setError(friendlyError(err));
    else await load();
    setBusy(null);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-amber-200/70 p-8 text-center">
        <Loader2 size={20} className="animate-spin mx-auto mb-2 text-amber-500" />
        <p className="text-xs font-bold text-gray-600">Checking artist incidents…</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-3xl border shadow-sm overflow-hidden ${incidents.length ? 'border-rose-300' : 'border-amber-200/70'}`}>
      <div className={`px-6 py-5 border-b flex flex-wrap items-center justify-between gap-3 ${
        incidents.length ? 'bg-rose-50 border-rose-200' : 'border-amber-100'
      }`}>
        <div>
          <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
            <AlertTriangle size={18} className={incidents.length ? 'text-rose-600' : 'text-amber-500'} />
            Artist incidents {incidents.length > 0 && `(${incidents.length} open)`}
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Pulled out, no-show or late — with the backups found and who was told.
          </p>
        </div>
        <button onClick={() => (recording ? setRecording(false) : openRecorder())}
          className="px-3 py-2 rounded-xl bg-maroon-950 hover:bg-maroon-900 text-royal-300 text-[11px] font-bold flex items-center gap-1.5">
          {recording ? <><X size={13} /> Close</> : <><Plus size={13} /> Record an incident</>}
        </button>
      </div>

      <div className="p-6 space-y-4">
        {error && <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
        {notice && <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">{notice}</p>}

        {recording && (
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <select value={jobId} onChange={(e) => setJobId(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-amber-200/80 text-xs font-bold bg-white">
                <option value="">Which booking?</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.event_date} · {j.customer_name} · {j.artist_name ?? 'artist'}</option>
                ))}
              </select>
              <select value={kind} onChange={(e) => setKind(e.target.value as IncidentKind)}
                className="px-3 py-2.5 rounded-xl border border-amber-200/80 text-xs font-bold bg-white">
                {(['no_show', 'late_arrival', 'withdrew_after_accept'] as IncidentKind[]).map((k) => (
                  <option key={k} value={k}>{INCIDENT_LABEL[k]}</option>
                ))}
              </select>
            </div>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="What happened? This goes on the artist's record."
              className="w-full px-3 py-2.5 rounded-xl border border-amber-200/80 text-xs resize-none bg-white" />
            <p className="text-[10px] text-gray-500">
              A no-show or a pull-out frees the booking, searches for backups and emails the customer. A late arrival is only recorded.
            </p>
            <button onClick={record} disabled={busy === 'record'}
              className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-60 text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              {busy === 'record' ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />} Record incident
            </button>
          </div>
        )}

        {incidents.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">No open incidents.</p>
        ) : incidents.map((incident) => {
          const artist = names[incident.artist_id];
          const job = bookings[incident.booking_id ?? incident.rental_id ?? ''];
          const rec = recs[incident.artist_id];
          const candidates = incident.backup_candidates ?? [];
          return (
            <div key={incident.id} className="rounded-2xl border border-rose-200 overflow-hidden">
              <div className="p-4 bg-rose-50/40 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-maroon-950">
                    {artist?.name ?? 'Artist'} — {INCIDENT_LABEL[incident.kind]}
                    <span className="ml-2 text-[10px] font-black text-rose-700">+{incident.points} pts</span>
                  </p>
                  <p className="text-[12px] text-gray-700 mt-1">{incident.reason}</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {job ? `${job.customer} · ${job.date}` : 'Booking'} · reported by {incident.reported_role ?? 'staff'} ·{' '}
                    {new Date(incident.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1 ${
                      incident.ops_notified_at ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                      <Mail size={9} /> Ops {incident.ops_notified_at ? 'emailed' : 'not emailed'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1 ${
                      incident.customer_notified_at ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                      <Mail size={9} /> Customer {incident.customer_notified_at ? 'emailed' : 'not emailed'}
                    </span>
                  </div>
                </div>
                {rec && (
                  <div className="text-right shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${STANDING_TONE[artist?.standing ?? 'good']}`}>
                      Now: {STANDING_LABEL[artist?.standing ?? 'good']}
                    </span>
                    {rec.recommended !== (artist?.standing ?? 'good') && (
                      <p className="text-[10px] font-bold text-rose-700 mt-1">
                        Suggested: {STANDING_LABEL[rec.recommended]} ({rec.points} pts in 90 days)
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-rose-100 space-y-2">
                {incident.kind === 'withdrew_after_accept' || incident.kind === 'no_show' ? (
                  candidates.length === 0 ? (
                    <p className="text-[11px] text-gray-500">
                      No backup artist was free at the time. Assign someone from Artist Bookings.
                    </p>
                  ) : (
                    <>
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Backups found</p>
                      <div className="flex flex-wrap gap-2">
                        {candidates.map((c) => (
                          <button key={c.id} onClick={() => assign(incident, c)} disabled={busy === incident.id}
                            className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-[11px] text-emerald-900 text-left disabled:opacity-50">
                            <span className="font-bold flex items-center gap-1"><UserPlus size={11} /> {c.display_name}</span>
                            <span className="block text-[10px] opacity-70">
                              {c.base_city ?? '—'}{c.rating != null ? ` · ${Number(c.rating).toFixed(1)} ★` : ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )
                ) : null}
                <button onClick={() => close(incident)} disabled={busy === incident.id}
                  className="text-[11px] font-bold text-gray-500 hover:text-maroon-900 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Close without a replacement
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
