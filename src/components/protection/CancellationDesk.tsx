'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ShieldAlert, CheckCircle2, XCircle, Loader2, AlertCircle, IndianRupee, Gavel,
} from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { Cancellation, Dispute, DISPUTE_CATEGORIES } from '@/lib/protection';

type Row = Cancellation & { requester_name?: string | null };

/**
 * Admin desk for cancellations and disputes.
 *
 * The refund amount shown was frozen when the customer cancelled — the admin
 * approves or rejects that figure, they do not recompute it, so the policy in
 * force at cancellation time is what gets honoured.
 */
export function CancellationDesk() {
  const [cancellations, setCancellations] = useState<Row[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [view, setView] = useState<'cancellations' | 'disputes'>('cancellations');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [c, d] = await Promise.all([
      supabase
        .from('cancellations')
        .select('*, profiles!cancellations_requested_by_fkey(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('disputes').select('*').order('created_at', { ascending: false }),
    ]);

    const firstError = c.error ?? d.error;
    if (firstError) setError(friendlyError(firstError));

    setCancellations(
      ((c.data ?? []) as (Cancellation & { profiles?: { full_name?: string } | null })[]).map(
        (row) => ({ ...row, requester_name: row.profiles?.full_name ?? null })
      )
    );
    setDisputes((d.data as Dispute[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, approve: boolean) => {
    const note = window.prompt(
      approve ? 'Note for the record (optional)' : 'Why is this refund being refused?'
    );
    if (!approve && (note === null || !note.trim())) return;

    setBusyId(id);
    setError(null);

    try {
      const response = await fetch('/api/bookings/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancellationId: id, approve, adminNote: note ?? undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? 'Could not process that refund.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund failed.');
    } finally {
      setBusyId(null);
    }
  };

  const resolveDispute = async (id: string, status: Dispute['status']) => {
    const resolution =
      status === 'resolved' || status === 'dismissed'
        ? window.prompt('How was this resolved? Both parties will see this.')
        : null;

    if ((status === 'resolved' || status === 'dismissed') && (resolution === null || !resolution.trim()))
      return;

    setBusyId(id);
    const { error: updateErr } = await supabase
      .from('disputes')
      .update({
        status,
        resolution: resolution?.trim() ?? null,
        resolved_at: resolution ? new Date().toISOString() : null,
      })
      .eq('id', id);

    if (updateErr) setError(friendlyError(updateErr));
    else await load();
    setBusyId(null);
  };

  const openCancellations = cancellations.filter((c) => c.status === 'requested').length;
  const openDisputes = disputes.filter((d) => d.status === 'open').length;

  return (
    <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
          <ShieldAlert size={18} className="text-amber-600" /> Booking Protection
        </h3>
        <div className="flex bg-amber-50 p-1 rounded-xl border border-amber-200/70">
          {([
            ['cancellations', `Cancellations (${openCancellations})`],
            ['disputes', `Disputes (${openDisputes})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                view === key ? 'bg-maroon-950 text-royal-300 shadow-sm' : 'text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 m-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 size={26} className="animate-spin mx-auto mb-3 text-amber-500" />
          <p className="text-sm font-bold text-gray-600">Loading…</p>
        </div>
      ) : view === 'cancellations' ? (
        cancellations.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 size={30} className="text-emerald-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-600">No cancellations.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-amber-50/50 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-amber-100">
                <tr>
                  <th className="p-4">Requested by</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Timing</th>
                  <th className="p-4">Refund owed</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 text-xs">
                {cancellations.map((row) => (
                  <tr key={row.id} className="hover:bg-amber-50/30 align-top">
                    <td className="p-4 font-bold text-maroon-950">
                      {row.requester_name || '—'}
                      <span
                        className={`block mt-1 w-fit px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          row.requested_role === 'artist'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-royal-100 text-royal-800'
                        }`}
                      >
                        {row.requested_role}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600 max-w-[14rem]">{row.reason}</td>
                    <td className="p-4 text-gray-700">
                      {row.days_before} days before
                      <span className="block text-[10px] text-gray-400">{row.event_date}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-black text-maroon-950">
                        ₹{row.refund_amount.toLocaleString()}
                      </span>
                      <span className="block text-[10px] text-gray-500">
                        {row.refund_percent}% of ₹{row.advance_amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          row.status === 'refunded'
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : row.status === 'no_refund'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row.status.replace('_', ' ')}
                      </span>
                      {row.admin_note && (
                        <span className="block text-[10px] text-gray-500 mt-1 max-w-[12rem]">
                          {row.admin_note}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {row.status === 'requested' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => decide(row.id, true)}
                            disabled={busyId === row.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-[10px] font-bold uppercase flex items-center gap-1 disabled:opacity-50"
                          >
                            {busyId === row.id ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <IndianRupee size={11} />
                            )}
                            Refund
                          </button>
                          <button
                            onClick={() => decide(row.id, false)}
                            disabled={busyId === row.id}
                            className="p-1.5 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-50"
                            title="Refuse"
                          >
                            <XCircle size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">
                          {row.razorpay_refund_id ? row.razorpay_refund_id : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : disputes.length === 0 ? (
        <div className="p-12 text-center">
          <CheckCircle2 size={30} className="text-emerald-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-600">No disputes raised.</p>
        </div>
      ) : (
        <div className="divide-y divide-amber-100">
          {disputes.map((dispute) => (
            <div key={dispute.id} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-maroon-950">
                    {DISPUTE_CATEGORIES.find((c) => c.value === dispute.category)?.label ??
                      dispute.category}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Raised by {dispute.raised_role} ·{' '}
                    {new Date(dispute.created_at).toLocaleDateString('en-IN')}
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed mt-2 max-w-xl">
                    {dispute.description}
                  </p>
                  {dispute.resolution && (
                    <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 mt-2 max-w-xl">
                      <strong>Resolution:</strong> {dispute.resolution}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                      dispute.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : dispute.status === 'dismissed'
                        ? 'bg-gray-100 text-gray-600'
                        : dispute.status === 'investigating'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {dispute.status}
                  </span>

                  {dispute.status !== 'resolved' && dispute.status !== 'dismissed' && (
                    <div className="flex gap-1.5">
                      {dispute.status === 'open' && (
                        <button
                          onClick={() => resolveDispute(dispute.id, 'investigating')}
                          disabled={busyId === dispute.id}
                          className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 text-[10px] font-bold uppercase"
                        >
                          Investigate
                        </button>
                      )}
                      <button
                        onClick={() => resolveDispute(dispute.id, 'resolved')}
                        disabled={busyId === dispute.id}
                        className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase flex items-center gap-1"
                      >
                        <Gavel size={10} /> Resolve
                      </button>
                      <button
                        onClick={() => resolveDispute(dispute.id, 'dismissed')}
                        disabled={busyId === dispute.id}
                        className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] font-bold uppercase"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
