'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, Loader2, AlertCircle, CheckCircle2, Store, Clock, ShieldAlert, XCircle } from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { PayoutStatus, loadSupplierRates, rupees } from '@/lib/supplier';

interface PayoutRow {
  id: string;
  supplier_id: string;
  status: PayoutStatus;
  amount: number;
  shipment_count: number;
  prepared_by: string | null;
  prepared_at: string;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  cancel_reason: string | null;
  supplier_profiles: {
    business_name: string;
    phone: string;
    upi_id: string | null;
    bank_holder_name: string | null;
    bank_ifsc: string | null;
    bank_account_last4: string | null;
    verification_status: string;
  } | null;
}

interface DeliveredRow {
  id: string;
  supplier_id: string;
  payout_amount: number;
  delivered_at: string | null;
  payout_hold: boolean;
}

const STATUS_CHIP: Record<PayoutStatus, string> = {
  prepared: 'bg-amber-100 text-amber-800',
  approved: 'bg-royal-100 text-royal-800',
  paid: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-200 text-gray-600',
};

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/**
 * Supplier payouts: Finance prepares the week's batch, a second person
 * approves each payout, then Finance sends the money and records the bank
 * reference. The database refuses the same person preparing and approving.
 */
export function SupplierPayoutsPanel({ currentUserId }: { currentUserId: string | null }) {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [delivered, setDelivered] = useState<DeliveredRow[]>([]);
  const [holdDays, setHoldDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [references, setReferences] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [payoutRes, deliveredRes, rates] = await Promise.all([
      supabase
        .from('supplier_payouts')
        .select(
          'id, supplier_id, status, amount, shipment_count, prepared_by, prepared_at, approved_by, approved_at, paid_at, ' +
            'payment_reference, cancel_reason, ' +
            'supplier_profiles(business_name, phone, upi_id, bank_holder_name, bank_ifsc, bank_account_last4, verification_status)'
        )
        .order('prepared_at', { ascending: false })
        .limit(100),
      supabase
        .from('order_shipments')
        .select('id, supplier_id, payout_amount, delivered_at, payout_hold')
        .eq('status', 'delivered')
        .is('payout_id', null),
      loadSupplierRates(),
    ]);
    const firstError = payoutRes.error ?? deliveredRes.error;
    setError(firstError ? friendlyError(firstError) : null);
    setPayouts((payoutRes.data as unknown as PayoutRow[]) ?? []);
    setDelivered((deliveredRes.data as DeliveredRow[]) ?? []);
    setHoldDays(rates.holdDays);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const queue = useMemo(() => {
    const cutoff = Date.now() - holdDays * 86_400_000;
    const held = delivered.filter((d) => d.payout_hold);
    const due = delivered.filter((d) => !d.payout_hold && d.delivered_at && new Date(d.delivered_at).getTime() <= cutoff);
    const waiting = delivered.filter((d) => !d.payout_hold && !due.includes(d));
    const sum = (rows: DeliveredRow[]) => rows.reduce((total, r) => total + Number(r.payout_amount), 0);
    return { held, due, waiting, heldTotal: sum(held), dueTotal: sum(due), waitingTotal: sum(waiting) };
  }, [delivered, holdDays]);

  const call = async (key: string, task: () => PromiseLike<{ data?: unknown; error: unknown }>, onSuccess: (data: unknown) => string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    const { data, error: taskErr } = await task();
    setBusy(null);
    if (taskErr) {
      setError(friendlyError(taskErr));
      return;
    }
    setNotice(onSuccess(data));
    await load();
  };

  const prepare = () =>
    call('prepare', () => supabase.rpc('prepare_supplier_payouts'), (data) => {
      const rows = (data as { amount: number }[] | null) ?? [];
      if (rows.length === 0) return 'Nothing is due yet. Only delivered orders past the waiting period, from suppliers with approved documents, are paid.';
      const amount = rows.reduce((total, r) => total + Number(r.amount), 0);
      return `Prepared ${rows.length} ${rows.length === 1 ? 'payout' : 'payouts'} for ${rupees(amount)}. A second person now approves ${rows.length === 1 ? 'it' : 'each one'}.`;
    });

  const approve = (row: PayoutRow) =>
    call(row.id, () => supabase.rpc('approve_supplier_payout', { p_payout_id: row.id }), () =>
      `Approved. Send ${rupees(Number(row.amount))} to ${row.supplier_profiles?.business_name ?? 'the supplier'}, then record the bank reference.`
    );

  const markPaid = (row: PayoutRow) =>
    call(
      row.id,
      () => supabase.rpc('mark_supplier_payout_paid', { p_payout_id: row.id, p_reference: references[row.id] ?? '' }),
      () => `Recorded as paid. ${row.supplier_profiles?.business_name ?? 'The supplier'} sees it in their portal.`
    );

  const cancel = (row: PayoutRow) => {
    const reason = window.prompt('Why is this payout cancelled? Its orders go back into the queue.');
    if (reason === null) return;
    return call(row.id, () => supabase.rpc('cancel_supplier_payout', { p_payout_id: row.id, p_reason: reason }), () =>
      'Payout cancelled. Its orders will be in the next batch.'
    );
  };

  return (
    <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
            <Store size={18} className="text-amber-600" /> Supplier Payouts
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Delivered orders are paid {holdDays} days after delivery. One person prepares, a different person approves.
          </p>
        </div>
        <button
          onClick={prepare}
          disabled={busy === 'prepare'}
          className="px-5 py-2.5 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5"
        >
          {busy === 'prepare' ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />} Prepare this week&apos;s payouts
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 p-6 pb-0">
        <QueueFigure icon={CheckCircle2} tone="text-emerald-700" label="Due now" value={rupees(queue.dueTotal)} hint={`${queue.due.length} delivered orders`} />
        <QueueFigure icon={Clock} tone="text-amber-700" label="In the waiting period" value={rupees(queue.waitingTotal)} hint={`${queue.waiting.length} orders`} />
        <QueueFigure icon={ShieldAlert} tone="text-rose-700" label="On hold" value={rupees(queue.heldTotal)} hint={`${queue.held.length} orders with a problem`} />
      </div>

      {notice && (
        <div className="flex items-start gap-2 p-4 mx-6 mt-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
          <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{notice}</p>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 p-4 mx-6 mt-5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 size={24} className="animate-spin mx-auto mb-2 text-amber-500" />
        </div>
      ) : payouts.length === 0 ? (
        <p className="p-10 text-center text-sm font-bold text-gray-500">No supplier payouts yet.</p>
      ) : (
        <ul className="divide-y divide-amber-100 mt-5">
          {payouts.map((row) => {
            const supplier = row.supplier_profiles;
            const mine = row.prepared_by === currentUserId;
            return (
              <li key={row.id} className="p-6 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-maroon-950">{supplier?.business_name ?? 'Supplier'}</p>
                    <p className="text-[11px] text-gray-500">
                      {row.shipment_count} {row.shipment_count === 1 ? 'order' : 'orders'} · prepared {day(row.prepared_at)}
                      {mine ? ' by you' : ''}
                      {row.approved_at ? ` · approved ${day(row.approved_at)}` : ''}
                      {row.paid_at ? ` · paid ${day(row.paid_at)}` : ''}
                    </p>
                    <p className="text-[11px] text-gray-700 mt-1">
                      {supplier?.upi_id ? `UPI ${supplier.upi_id}` : ''}
                      {supplier?.bank_holder_name || supplier?.bank_ifsc
                        ? `${supplier?.upi_id ? ' · ' : ''}${[supplier?.bank_holder_name, supplier?.bank_ifsc].filter(Boolean).join(' · ')}`
                        : ''}
                      {supplier?.bank_account_last4 ? ` · A/c ending ${supplier.bank_account_last4}` : ''}
                      {supplier?.phone ? ` · ${supplier.phone}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-black text-xl text-maroon-950">{rupees(Number(row.amount))}</p>
                    <span className={`inline-block mt-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_CHIP[row.status]}`}>
                      {row.status}
                    </span>
                  </div>
                </div>

                {row.status === 'paid' && row.payment_reference && (
                  <p className="text-[11px] text-emerald-800">Bank reference (UTR): {row.payment_reference}</p>
                )}
                {row.status === 'cancelled' && row.cancel_reason && (
                  <p className="text-[11px] text-gray-500">Cancelled: {row.cancel_reason}</p>
                )}

                {row.status === 'prepared' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => approve(row)}
                      disabled={busy === row.id || mine}
                      title={mine ? 'You prepared this payout, so someone else approves it.' : undefined}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5"
                    >
                      {busy === row.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Approve
                    </button>
                    {mine && <span className="text-[11px] text-gray-500">You prepared this. A second person approves it.</span>}
                    <button
                      onClick={() => cancel(row)}
                      disabled={busy === row.id}
                      className="px-3 py-2 text-rose-700 hover:bg-rose-50 text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center gap-1"
                    >
                      <XCircle size={12} /> Cancel
                    </button>
                  </div>
                )}

                {row.status === 'approved' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={references[row.id] ?? ''}
                      onChange={(e) => setReferences((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      placeholder="Bank / UPI reference (UTR)"
                      className="px-3 py-2 rounded-xl border border-gray-200 text-xs w-56 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                    <button
                      onClick={() => markPaid(row)}
                      disabled={busy === row.id}
                      className="px-4 py-2 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5"
                    >
                      {busy === row.id ? <Loader2 size={12} className="animate-spin" /> : <Wallet size={12} />} Mark paid
                    </button>
                    <button
                      onClick={() => cancel(row)}
                      disabled={busy === row.id}
                      className="px-3 py-2 text-rose-700 hover:bg-rose-50 text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center gap-1"
                    >
                      <XCircle size={12} /> Cancel
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function QueueFigure({
  icon: Icon, tone, label, value, hint,
}: {
  icon: typeof Wallet;
  tone: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-200/60 bg-amber-50/30 p-4">
      <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${tone}`}>
        <Icon size={12} /> {label}
      </p>
      <p className="font-display font-black text-xl text-maroon-950 mt-1">{value}</p>
      <p className="text-[10px] text-gray-500">{hint}</p>
    </div>
  );
}
