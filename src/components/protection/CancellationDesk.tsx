'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ShieldAlert, CheckCircle2, XCircle, Loader2, AlertCircle, Gavel, BadgeCheck,
  Send, Scale, Percent, Lock,
} from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  Cancellation, Dispute, DISPUTE_CATEGORIES, cancellationStage, STAGE_LABEL, refundAction,
  RefundAction, CancellationStage,
} from '@/lib/protection';

type Row = Cancellation & { requester_name?: string | null };
type Method = 'gateway' | 'upi' | 'bank' | 'cash';

const money = (v: number | null | undefined) => `₹${Math.round(v ?? 0).toLocaleString('en-IN')}`;
const stamp = (ts: string | null | undefined) =>
  ts ? new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
const notice = (h: number | null) =>
  h == null ? '—'
  : h < 0 ? 'after the event start'
  : h >= 48 ? `${Math.floor(h / 24)} days ${Math.round(h % 24)} h before`
  : `${h} hours before`;

const STAGE_TONE: Record<CancellationStage, string> = {
  requested: 'bg-amber-100 text-amber-800',
  verified: 'bg-blue-100 text-blue-800',
  approved: 'bg-royal-100 text-royal-800',
  refunded: 'bg-teal-100 text-teal-800',
  closed: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
  no_refund: 'bg-gray-100 text-gray-600',
};

const METHOD_LABEL: Record<Method, string> = {
  gateway: 'Online gateway', upi: 'UPI', bank: 'Bank transfer', cash: 'Cash',
};

/**
 * The refund desk: request -> verify -> approve -> send -> reconcile.
 *
 * Each gate names who passed it. A button you are not allowed to press says
 * why instead of disappearing, because "why can I not approve this?" is the
 * first question anyone asks of a maker–checker system — and the answer ("you
 * verified it") is the whole point of the design.
 */
export function CancellationDesk() {
  const { profile } = useAuth();
  const me = profile?.id ?? null;

  const [cancellations, setCancellations] = useState<Row[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [view, setView] = useState<'cancellations' | 'disputes'>('cancellations');
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [methods, setMethods] = useState<Record<string, Method>>({});
  const [refs, setRefs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [c, d, staff] = await Promise.all([
      supabase
        .from('cancellations')
        .select('*, profiles!cancellations_requested_by_fkey(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('disputes').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email').in('role', ['admin', 'manager']),
    ]);

    const firstError = c.error ?? d.error;
    if (firstError) setError(friendlyError(firstError));

    setCancellations(
      ((c.data ?? []) as (Cancellation & { profiles?: { full_name?: string } | null })[]).map((row) => ({
        ...row,
        requester_name: row.profiles?.full_name ?? null,
      }))
    );
    setDisputes((d.data as Dispute[]) ?? []);
    setNames(Object.fromEntries(((staff.data ?? []) as { id: string; full_name: string | null; email: string | null }[])
      .map((p) => [p.id, p.full_name || p.email || 'staff'])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const who = (id: string | null) => (id ? (id === me ? 'you' : names[id] ?? 'staff') : '');

  const act = async (row: Row, action: RefundAction) => {
    let note: string | undefined;
    let exceptionPercent: number | undefined;

    if (action === 'reject' || action === 'reject_exception') {
      const text = window.prompt(action === 'reject' ? 'Why is this refund refused? The customer is told.' : 'Why is this exception refused?');
      if (text === null || !text.trim()) return;
      note = text.trim();
    } else if (action === 'propose_exception') {
      const pct = window.prompt(
        `The policy gives ${row.refund_percent}% (${money(row.refund_amount)}) of ${money(row.eligible_amount)} eligible.\n\nWhat percentage should be refunded instead? (0–100)`
      );
      if (pct === null) return;
      const reason = window.prompt('Why? A different manager or the owner reads this before approving.');
      if (reason === null || !reason.trim()) return;
      exceptionPercent = Number(pct);
      note = reason.trim();
    } else if (action !== 'process' && action !== 'approve_exception') {
      const text = window.prompt('Note for the record (optional)');
      if (text === null) return;
      note = text.trim() || undefined;
    }

    setBusyId(row.id);
    setError(null);
    try {
      await refundAction({
        cancellationId: row.id,
        action,
        note,
        exceptionPercent,
        refundMethod: action === 'process' ? methods[row.id] ?? 'gateway' : undefined,
        refundReference: action === 'process' ? refs[row.id] : undefined,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That step could not be recorded.');
    } finally {
      setBusyId(null);
    }
  };

  const resolveDispute = async (id: string, status: Dispute['status']) => {
    const resolution =
      status === 'resolved' || status === 'dismissed'
        ? window.prompt('How was this resolved? Both parties will see this.')
        : null;
    if ((status === 'resolved' || status === 'dismissed') && (resolution === null || !resolution.trim())) return;

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

  const open = cancellations.filter((c) => !['closed', 'rejected', 'no_refund'].includes(cancellationStage(c))
    || (c.exception_requested_by && !c.exception_approved_by));
  const shown = filter === 'open' ? open : cancellations;
  const openDisputes = disputes.filter((d) => d.status === 'open').length;

  const Btn = ({ onClick, blocked, tone, icon: Icon, children }: {
    onClick: () => void; blocked?: string | null; tone: string; icon: typeof Send; children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      disabled={!!blocked || busyId !== null}
      title={blocked ?? undefined}
      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${tone}`}
    >
      {blocked ? <Lock size={11} /> : <Icon size={11} />} {children}
    </button>
  );

  return (
    <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-600" /> Refunds & Disputes
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Every refund is verified and approved by two different people. Nobody sends money they approved.
          </p>
        </div>
        <div className="flex bg-amber-50 p-1 rounded-xl border border-amber-200/70">
          {([
            ['cancellations', `Refunds (${open.length})`],
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
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            {(['open', 'all'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                  filter === f ? 'bg-maroon-950 text-royal-300' : 'bg-amber-50 text-maroon-900'
                }`}>
                {f === 'open' ? 'Needs action' : 'All'}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 size={30} className="text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-600">
                {filter === 'open' ? 'Nothing waiting on anyone.' : 'No cancellations yet.'}
              </p>
            </div>
          ) : shown.map((row) => {
            const stage = cancellationStage(row);
            const exceptionWaiting = !!row.exception_requested_by && !row.exception_approved_by;

            const pipeline: { label: string; by: string | null; at: string | null; done: boolean }[] = [
              { label: 'Requested', by: row.requested_by, at: row.created_at, done: true },
              { label: 'Verified', by: row.verified_by, at: row.verified_at, done: !!row.verified_by },
              { label: 'Approved', by: row.reviewed_by, at: row.reviewed_at, done: ['approved', 'refunded'].includes(row.status) },
              { label: 'Sent', by: row.processed_by, at: row.processed_at, done: row.status === 'refunded' },
              { label: 'Reconciled', by: row.reconciled_by, at: row.reconciled_at, done: !!row.reconciled_at },
            ];

            return (
              <div key={row.id} className="rounded-2xl border border-amber-200/70 overflow-hidden">
                <div className="p-5 flex flex-wrap items-start justify-between gap-4 bg-amber-50/30">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-maroon-950">
                      {row.requester_name || 'Customer'}
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-royal-100 text-royal-800 text-[9px] font-black uppercase">
                        {row.requested_role}
                      </span>
                    </p>
                    <p className="text-[12px] text-gray-700 mt-1">{row.reason}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {notice(row.hours_before)} · event {row.event_date ?? '—'} · raised {stamp(row.created_at)}
                    </p>
                    {row.rule_label && <p className="text-[11px] text-maroon-800 font-bold mt-1">{row.rule_label}</p>}
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${STAGE_TONE[stage]}`}>
                    {STAGE_LABEL[stage]}
                  </span>
                </div>

                <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-[11px] border-t border-amber-100">
                  <div><p className="text-gray-400 font-bold uppercase text-[9px]">Paid</p><p className="font-bold tabular-nums">{money(row.paid_amount)}</p></div>
                  <div><p className="text-gray-400 font-bold uppercase text-[9px]">GST / taxes</p><p className="font-bold tabular-nums">− {money(row.tax_amount)}</p></div>
                  <div><p className="text-gray-400 font-bold uppercase text-[9px]">Non-refundable</p><p className="font-bold tabular-nums">− {money(row.non_refundable_fee)}</p></div>
                  <div><p className="text-gray-400 font-bold uppercase text-[9px]">Eligible</p><p className="font-bold tabular-nums">{money(row.eligible_amount)}</p></div>
                  <div><p className="text-gray-400 font-bold uppercase text-[9px]">Refund ({row.refund_percent}%)</p>
                    <p className="font-black text-maroon-950 text-sm tabular-nums">{money(row.refund_amount)}</p></div>
                </div>

                {row.exception_requested_by && (
                  <div className={`mx-5 mb-4 p-3 rounded-xl border text-[11px] ${
                    exceptionWaiting ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}>
                    <p className="font-black flex items-center gap-1.5">
                      <Percent size={11} /> Exception: {row.exception_percent}% instead of the policy
                      {exceptionWaiting ? ' — waiting for a second approval' : ` — approved by ${who(row.exception_approved_by)}`}
                    </p>
                    <p className="mt-1">{row.exception_reason} <span className="text-gray-500">— proposed by {who(row.exception_requested_by)}</span></p>
                  </div>
                )}

                {/* Who has signed what */}
                <div className="px-5 pb-4 flex flex-wrap gap-2">
                  {pipeline.map((step) => (
                    <div key={step.label}
                      className={`px-2.5 py-1.5 rounded-lg border text-[10px] ${
                        step.done ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-white border-gray-200 text-gray-400'
                      }`}>
                      <span className="font-black uppercase tracking-wider">{step.label}</span>
                      {step.done && step.by && <span className="block">{who(step.by)} · {stamp(step.at)}</span>}
                    </div>
                  ))}
                </div>

                {(row.refund_reference || row.razorpay_refund_id || row.admin_note || row.reconciliation_note) && (
                  <div className="px-5 pb-4 text-[11px] text-gray-600 space-y-0.5">
                    {row.refund_method && <p>Sent by <b>{METHOD_LABEL[row.refund_method]}</b> · ref {row.razorpay_refund_id ?? row.refund_reference}</p>}
                    {row.admin_note && <p>Note: {row.admin_note}</p>}
                    {row.reconciliation_note && <p>Reconciled: {row.reconciliation_note}</p>}
                  </div>
                )}

                {/* Actions for this stage */}
                <div className="px-5 py-3 border-t border-amber-100 bg-white flex flex-wrap items-center gap-2">
                  {busyId === row.id && <Loader2 size={14} className="animate-spin text-amber-500" />}

                  {exceptionWaiting && (
                    <>
                      <Btn onClick={() => act(row, 'approve_exception')} tone="bg-emerald-100 text-emerald-800 hover:bg-emerald-200" icon={BadgeCheck}
                        blocked={row.exception_requested_by === me ? 'You proposed this exception — a different manager or the owner must decide it.'
                          : row.requested_by === me ? 'You raised this cancellation, so someone else must decide the exception.' : null}>
                        Approve exception
                      </Btn>
                      <Btn onClick={() => act(row, 'reject_exception')} tone="bg-rose-100 text-rose-800 hover:bg-rose-200" icon={XCircle}
                        blocked={row.exception_requested_by === me ? 'You proposed this exception — someone else must decide it.' : null}>
                        Refuse exception
                      </Btn>
                    </>
                  )}

                  {stage === 'requested' && !exceptionWaiting && (
                    <Btn onClick={() => act(row, 'verify')} tone="bg-blue-100 text-blue-800 hover:bg-blue-200" icon={BadgeCheck}
                      blocked={row.requested_by === me ? 'You raised this cancellation, so someone else must verify it.' : null}>
                      Verify
                    </Btn>
                  )}

                  {stage === 'verified' && !exceptionWaiting && (
                    <Btn onClick={() => act(row, 'approve')} tone="bg-emerald-100 text-emerald-800 hover:bg-emerald-200" icon={CheckCircle2}
                      blocked={row.verified_by === me ? 'You verified this refund — a different manager or the owner must approve it.'
                        : row.requested_by === me ? 'You raised this cancellation, so someone else must approve it.' : null}>
                      Approve
                    </Btn>
                  )}

                  {(stage === 'requested' || stage === 'verified') && (
                    <Btn onClick={() => act(row, 'reject')} tone="bg-rose-100 text-rose-800 hover:bg-rose-200" icon={XCircle}
                      blocked={row.requested_by === me ? 'You raised this cancellation, so someone else must decide it.' : null}>
                      Refuse
                    </Btn>
                  )}

                  {(stage === 'requested' || stage === 'verified' || stage === 'no_refund')
                    && !row.exception_requested_by && row.eligible_amount > 0 && (
                    <Btn onClick={() => act(row, 'propose_exception')} tone="bg-amber-100 text-amber-900 hover:bg-amber-200" icon={Percent}>
                      Propose exception
                    </Btn>
                  )}

                  {stage === 'approved' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={methods[row.id] ?? 'gateway'}
                        onChange={(e) => setMethods((m) => ({ ...m, [row.id]: e.target.value as Method }))}
                        className="px-2 py-1.5 rounded-lg border border-amber-200/70 text-[11px] font-bold">
                        {(Object.keys(METHOD_LABEL) as Method[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                      </select>
                      {(methods[row.id] ?? 'gateway') !== 'gateway' && (
                        <input value={refs[row.id] ?? ''} onChange={(e) => setRefs((r) => ({ ...r, [row.id]: e.target.value }))}
                          placeholder="UPI / bank txn id, or who handed the cash"
                          className="px-2.5 py-1.5 rounded-lg border border-amber-200/70 text-[11px] w-64" />
                      )}
                      <Btn onClick={() => act(row, 'process')} tone="bg-teal-100 text-teal-800 hover:bg-teal-200" icon={Send}
                        blocked={row.reviewed_by === me ? 'You approved this refund, so someone else must send it.' : null}>
                        Record refund sent
                      </Btn>
                    </div>
                  )}

                  {stage === 'refunded' && (
                    <Btn onClick={() => act(row, 'reconcile')} tone="bg-emerald-100 text-emerald-800 hover:bg-emerald-200" icon={Scale}
                      blocked={row.processed_by === me ? 'You sent this refund, so someone else must reconcile it against the bank.' : null}>
                      Mark reconciled
                    </Btn>
                  )}

                  {stage === 'closed' && <span className="text-[11px] font-bold text-emerald-700">Closed — every step signed off.</span>}
                  {stage === 'rejected' && <span className="text-[11px] font-bold text-rose-700">Refused by {who(row.reviewed_by)}.</span>}
                  {stage === 'no_refund' && !row.exception_requested_by && (
                    <span className="text-[11px] text-gray-500">No refund is due under the policy.</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
                    {DISPUTE_CATEGORIES.find((c) => c.value === dispute.category)?.label ?? dispute.category}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Raised by {dispute.raised_role} · {new Date(dispute.created_at).toLocaleDateString('en-IN')}
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed mt-2 max-w-xl">{dispute.description}</p>
                  {dispute.resolution && (
                    <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 mt-2 max-w-xl">
                      <strong>Resolution:</strong> {dispute.resolution}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                    dispute.status === 'resolved' ? 'bg-emerald-100 text-emerald-800'
                    : dispute.status === 'dismissed' ? 'bg-gray-100 text-gray-600'
                    : dispute.status === 'investigating' ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800'
                  }`}>
                    {dispute.status}
                  </span>

                  {dispute.status !== 'resolved' && dispute.status !== 'dismissed' && (
                    <div className="flex gap-1.5">
                      {dispute.status === 'open' && (
                        <button onClick={() => resolveDispute(dispute.id, 'investigating')} disabled={busyId === dispute.id}
                          className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 text-[10px] font-bold uppercase">
                          Investigate
                        </button>
                      )}
                      <button onClick={() => resolveDispute(dispute.id, 'resolved')} disabled={busyId === dispute.id}
                        className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase flex items-center gap-1">
                        <Gavel size={10} /> Resolve
                      </button>
                      <button onClick={() => resolveDispute(dispute.id, 'dismissed')} disabled={busyId === dispute.id}
                        className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] font-bold uppercase">
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
