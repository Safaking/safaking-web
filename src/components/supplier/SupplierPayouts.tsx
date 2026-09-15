'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, Loader2, AlertCircle, CheckCircle2, Clock, Landmark, ShieldAlert, Info } from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import {
  PayoutStatus, SupplierOrder, SupplierPayout, SupplierProfile, SupplierRates, rupees, splitSupplierPrice,
} from '@/lib/supplier';

const PAYOUT_CHIP: Record<PayoutStatus, string> = {
  prepared: 'bg-amber-100 text-amber-800',
  approved: 'bg-royal-100 text-royal-800',
  paid: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-200 text-gray-600',
};

const PAYOUT_LABEL: Record<PayoutStatus, string> = {
  prepared: 'Being checked',
  approved: 'Approved, being sent',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const total = (orders: SupplierOrder[]) => orders.reduce((sum, o) => sum + Number(o.payout_amount), 0);

export function SupplierPayouts({
  supplier, orders, rates,
}: {
  supplier: SupplierProfile;
  orders: SupplierOrder[];
  rates: SupplierRates;
}) {
  const [payouts, setPayouts] = useState<SupplierPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: loadErr } = await supabase
      .from('supplier_payouts')
      .select('id, supplier_id, status, amount, shipment_count, prepared_at, approved_at, paid_at, payment_reference, cancel_reason')
      .eq('supplier_id', supplier.id)
      .order('prepared_at', { ascending: false });
    if (loadErr) setError(friendlyError(loadErr));
    else setPayouts((data as SupplierPayout[]) ?? []);
    setLoading(false);
  }, [supplier.id]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const delivered = orders.filter((o) => o.status === 'delivered');
    const waiting = delivered.filter((o) => !o.payout_status);
    const held = waiting.filter((o) => o.payout_hold);
    const upcoming = waiting.filter((o) => !o.payout_hold);
    const processing = delivered.filter((o) => o.payout_status === 'prepared' || o.payout_status === 'approved');
    const onTheWay = orders.filter((o) => o.status === 'new' || o.status === 'ready' || o.status === 'dispatched');
    return {
      upcoming,
      held,
      processingTotal: total(processing),
      onTheWayTotal: total(onTheWay),
      paidTotal: payouts.filter((p) => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0),
    };
  }, [orders, payouts]);

  const example = splitSupplierPrice(1000, 5, rates);

  return (
    <section className="space-y-6">
      <h2 className="font-display font-black text-2xl text-maroon-900">Your Payments</h2>

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Figure label="Orders not yet delivered" value={rupees(summary.onTheWayTotal)} hint="Paid after delivery" />
        <Figure label="Delivered, waiting period" value={rupees(total(summary.upcoming))} hint={`${rates.holdDays} days after delivery`} />
        <Figure label="In a payout now" value={rupees(summary.processingTotal)} hint="Being checked and sent" />
        <Figure label="Paid to you" value={rupees(summary.paidTotal)} hint="All time" strong />
      </div>

      {summary.held.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900">
          <ShieldAlert size={18} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            {summary.held.length} delivered {summary.held.length === 1 ? 'order is' : 'orders are'} on hold (
            {rupees(total(summary.held))}) because the customer reported a problem. SafaKing will call you before it is
            released.
          </p>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-amber-100 flex items-center gap-2">
          <Wallet size={18} className="text-amber-600" />
          <h3 className="font-display font-bold text-lg text-maroon-950">Payouts</h3>
        </div>
        {loading ? (
          <div className="p-10 text-center">
            <Loader2 size={24} className="animate-spin mx-auto mb-2 text-amber-500" />
            <p className="text-xs font-bold text-gray-600">Loading…</p>
          </div>
        ) : payouts.length === 0 ? (
          <div className="p-10 text-center">
            <Clock size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-600">No payouts yet.</p>
            <p className="text-xs text-gray-500 mt-1">
              A delivered order is paid in the first weekly payout {rates.holdDays} days after delivery.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-amber-100">
            {payouts.map((payout) => (
              <li key={payout.id} className="p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display font-black text-lg text-maroon-950">{rupees(Number(payout.amount))}</p>
                  <p className="text-[11px] text-gray-500">
                    {payout.shipment_count} {payout.shipment_count === 1 ? 'order' : 'orders'} · prepared {day(payout.prepared_at)}
                    {payout.paid_at ? ` · paid ${day(payout.paid_at)}` : ''}
                  </p>
                  {payout.payment_reference && (
                    <p className="text-[11px] text-emerald-800 mt-0.5">Bank reference (UTR): {payout.payment_reference}</p>
                  )}
                  {payout.status === 'cancelled' && payout.cancel_reason && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {payout.cancel_reason}. Its orders go into the next payout.
                    </p>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${PAYOUT_CHIP[payout.status]}`}>
                  {payout.status === 'paid' && <CheckCircle2 size={11} />} {PAYOUT_LABEL[payout.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6 space-y-2">
          <h3 className="font-display font-bold text-maroon-950 flex items-center gap-2">
            <Landmark size={16} className="text-amber-600" /> Where we pay you
          </h3>
          {supplier.upi_id && <p className="text-sm text-maroon-950">UPI: <span className="font-bold">{supplier.upi_id}</span></p>}
          {(supplier.bank_holder_name || supplier.bank_ifsc) && (
            <p className="text-sm text-maroon-950">
              Bank: <span className="font-bold">{supplier.bank_holder_name ?? '—'}</span>
              {supplier.bank_ifsc ? ` · IFSC ${supplier.bank_ifsc}` : ''}
              {supplier.bank_account_last4 ? ` · A/c ending ${supplier.bank_account_last4}` : ''}
            </p>
          )}
          {!supplier.upi_id && !supplier.bank_holder_name && !supplier.bank_ifsc && (
            <p className="text-sm text-rose-700">No payment account on file. Call SafaKing.</p>
          )}
          <p className="text-[11px] text-gray-500 leading-relaxed">
            To change this account, call SafaKing. We confirm it with you first, so nobody else can redirect your
            money.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm p-6 space-y-1.5 text-xs text-gray-700">
          <h3 className="font-display font-bold text-maroon-950 flex items-center gap-2 text-base mb-1">
            <Info size={16} className="text-amber-600" /> How a sale is split
          </h3>
          <p className="flex justify-between"><span>You sell a safa at 5% GST for</span><span className="font-bold">₹1,000</span></p>
          <p className="flex justify-between"><span>GST inside the price</span><span>− {rupees(example.gst)}</span></p>
          <p className="flex justify-between"><span>SafaKing platform fee ({Math.round(rates.platformRate * 100)}%)</span><span>− {rupees(example.platformFee)}</span></p>
          <p className="flex justify-between"><span>Payment gateway fee ({Math.round(rates.gatewayRate * 100)}%)</span><span>− {rupees(example.gatewayFee)}</span></p>
          <p className="flex justify-between font-black text-emerald-800 pt-1.5 border-t border-amber-100">
            <span>You receive</span><span>{rupees(example.payout)}</span>
          </p>
          <p className="text-[11px] text-gray-500 pt-1">Plus the delivery charge the customer paid, in full.</p>
        </div>
      </div>
    </section>
  );
}

function Figure({ label, value, hint, strong }: { label: string; value: string; hint: string; strong?: boolean }) {
  return (
    <div className={`p-5 rounded-3xl border shadow-sm ${strong ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-amber-200/60'}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 leading-tight">{label}</p>
      <p className={`font-display font-black text-2xl mt-1 ${strong ? 'text-emerald-800' : 'text-maroon-950'}`}>{value}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{hint}</p>
    </div>
  );
}
