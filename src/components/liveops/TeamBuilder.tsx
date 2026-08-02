'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Users, Crown, ShieldCheck, Loader2, AlertCircle, CheckCircle2, X,
} from 'lucide-react';

interface Suggested {
  id: string;
  display_name: string;
  base_city: string | null;
  phone: string | null;
  safas_per_day: number;
  per_safa_rate: number;
  rating: number | null;
  total_events: number;
  verified: boolean;
  match_rank: number;
  suggested_leader: boolean;
  safas_assigned: number;
  running_capacity: number;
}

interface Props {
  rentalId: string;
  onClose: () => void;
  onAssigned: () => void;
}

/**
 * Builds a crew for a large wedding.
 *
 * The suggestion covers the safa count using the normal match ranking; the
 * admin can then drop anyone, change the split, and move the leader badge.
 */
export function TeamBuilder({ rentalId, onClose, onAssigned }: Props) {
  const [suggested, setSuggested] = useState<Suggested[]>([]);
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ safaCount: number; shortfall: number; capacity: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ops/team?rentalId=${rentalId}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? 'Could not build a team.');

      const crew = (body.suggested ?? []) as Suggested[];
      setSuggested(crew);
      setMeta({
        safaCount: body.booking.safaCount,
        shortfall: body.shortfall,
        capacity: body.capacity,
      });

      const initial: Record<string, number> = {};
      for (const member of crew) initial[member.id] = member.safas_assigned;
      setChosen(initial);
      setLeaderId(crew.find((m) => m.suggested_leader)?.id ?? crew[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build a team.');
    } finally {
      setLoading(false);
    }
  }, [rentalId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (member: Suggested) => {
    setChosen((prev) => {
      const next = { ...prev };
      if (next[member.id] != null) {
        delete next[member.id];
        if (leaderId === member.id) {
          // The leader must always be someone still on the crew.
          const remaining = Object.keys(next)[0] ?? null;
          setLeaderId(remaining);
        }
      } else {
        next[member.id] = member.safas_assigned || member.safas_per_day;
        if (!leaderId) setLeaderId(member.id);
      }
      return next;
    });
  };

  const assignedTotal = Object.values(chosen).reduce((sum, n) => sum + (n || 0), 0);
  const crewSize = Object.keys(chosen).length;

  const save = async () => {
    if (crewSize === 0) {
      setError('Choose at least one artist.');
      return;
    }
    if (!leaderId || chosen[leaderId] == null) {
      setError('Mark one of the chosen artists as team leader.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const members = Object.entries(chosen).map(([artistId, safas]) => {
        const source = suggested.find((m) => m.id === artistId);
        return {
          artistId,
          safasAssigned: safas || 0,
          perSafaRate: source?.per_safa_rate ?? 0,
          isLeader: artistId === leaderId,
        };
      });

      const response = await fetch('/api/ops/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rentalId, members }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? 'Could not assign the team.');

      onAssigned();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign the team.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-maroon-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl max-h-[92vh] overflow-y-auto custom-scrollbar">
        <div className="sticky top-0 bg-maroon-950 px-7 py-5 flex items-center justify-between">
          <div>
            <h3 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest">
              Build Team
            </h3>
            {meta && (
              <p className="text-[11px] text-royal-200/70 mt-0.5">
                {meta.safaCount} safas · {crewSize} artist{crewSize === 1 ? '' : 's'} chosen ·{' '}
                {assignedTotal} assigned
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-7 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">{error}</p>
            </div>
          )}

          {meta && meta.shortfall > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                Every free artist combined can tie {meta.capacity} safas — {meta.shortfall} short of
                the {meta.safaCount} this event needs. Book what you can and arrange the rest, or
                move the date.
              </p>
            </div>
          )}

          {loading ? (
            <div className="py-10 text-center text-gray-500">
              <Loader2 size={22} className="animate-spin mx-auto mb-2 text-amber-500" />
              <p className="text-xs font-bold">Finding available artists…</p>
            </div>
          ) : suggested.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              No artists are free for this date and area.
            </p>
          ) : (
            <div className="space-y-2">
              {suggested.map((member) => {
                const picked = chosen[member.id] != null;
                const isLeader = leaderId === member.id;

                return (
                  <div
                    key={member.id}
                    className={`flex flex-wrap items-center gap-3 p-3 rounded-2xl border transition-colors ${
                      picked ? 'bg-amber-50/60 border-amber-300' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={picked}
                      onChange={() => toggle(member)}
                      className="accent-maroon-900 w-4 h-4 shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-maroon-950 flex items-center gap-1.5">
                        {member.display_name}
                        {member.verified && <ShieldCheck size={11} className="text-emerald-600" />}
                        {isLeader && picked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-maroon-950 text-royal-300 text-[9px] font-black uppercase">
                            <Crown size={9} /> Leader
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {member.base_city ?? 'Nationwide'} · ties {member.safas_per_day}/day · ₹
                        {member.per_safa_rate}/safa ·{' '}
                        {member.match_rank === 1
                          ? 'same pincode'
                          : member.match_rank === 2
                          ? 'same city'
                          : 'further away'}
                      </p>
                    </div>

                    {picked && (
                      <>
                        <label className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">Safas</span>
                          <input
                            type="number"
                            min={0}
                            max={member.safas_per_day}
                            value={chosen[member.id]}
                            onChange={(e) =>
                              setChosen((prev) => ({
                                ...prev,
                                [member.id]: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="w-16 px-2 py-1.5 rounded-lg border border-gray-300 text-[11px] font-bold"
                          />
                        </label>

                        {!isLeader && (
                          <button
                            onClick={() => setLeaderId(member.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-royal-100 text-royal-800 text-[10px] font-bold uppercase"
                          >
                            Make leader
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {meta && assignedTotal !== meta.safaCount && crewSize > 0 && (
            <p className="text-[11px] text-amber-800">
              {assignedTotal} safas split across the crew, but the booking is for {meta.safaCount}.
              Adjust the numbers so the whole job is covered.
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 border-2 border-amber-200 text-maroon-700 text-xs font-bold uppercase tracking-wider py-3.5 rounded-xl hover:bg-amber-50"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || crewSize === 0}
              className="flex-1 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 text-xs font-bold uppercase tracking-wider py-3.5 rounded-xl flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Assigning…
                </>
              ) : (
                <>
                  <Users size={14} /> Assign crew of {crewSize}
                </>
              )}
            </button>
          </div>

          <p className="text-[10px] text-gray-400 leading-relaxed flex items-start gap-1.5">
            <CheckCircle2 size={11} className="shrink-0 mt-0.5" />
            Availability is re-checked for every artist at the moment you assign. The team leader
            becomes the booking&apos;s point of contact.
          </p>
        </div>
      </div>
    </div>
  );
}
