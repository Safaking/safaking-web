'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Truck, PackageCheck, CheckCircle2, XCircle, Loader2, AlertCircle, MapPin, Phone, User, Clock, Wallet, ShieldAlert,
} from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { SHIPMENT_LABEL, SupplierOrder, ZONE_LABEL, rupees } from '@/lib/supplier';

type Filter = 'open' | 'sent' | 'closed';
type Action = 'ready' | 'dispatch' | 'deliver' | 'cancel';

const COURIERS = ['Delhivery', 'India Post', 'DTDC', 'Blue Dart', 'Xpressbees', 'Ekart', 'Shadowfax', 'Hand delivery'];

const STATUS_CHIP: Record<SupplierOrder['status'], string> = {
  new: 'bg-amber-200 text-amber-900',
  ready: 'bg-royal-100 text-royal-800',
  dispatched: 'bg-sky-100 text-sky-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-200 text-gray-600',
};

const FILTER_LABEL: Record<Filter, string> = { open: 'To send', sent: 'On the way', closed: 'Done' };

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

function inFilter(order: SupplierOrder, filter: Filter): boolean {
  if (filter === 'open') return order.status === 'new' || order.status === 'ready';
  if (filter === 'sent') return order.status === 'dispatched';
  return order.status === 'delivered' || order.status === 'cancelled';
}

/** When and whether the supplier is paid for a parcel, in words. */
function payoutNote(order: SupplierOrder, holdDays: number): { tone: string; text: string } | null {
  if (order.status === 'cancelled') return null;
  if (order.payout_status === 'paid') {
    return { tone: 'text-emerald-800 bg-emerald-50 border-emerald-200', text: `Paid to you on ${day(order.paid_at)}.` };
  }
  if (order.payout_hold) {
    return {
      tone: 'text-rose-800 bg-rose-50 border-rose-200',
      text: 'Payment on hold: the customer reported a problem. SafaKing will call you.',
    };
  }
  if (order.payout_status === 'prepared' || order.payout_status === 'approved') {
    return { tone: 'text-royal-800 bg-royal-50 border-royal-200', text: "In this week's payout." };
  }
  if (order.status === 'delivered' && order.delivered_at) {
    const due = new Date(new Date(order.delivered_at).getTime() + holdDays * 86_400_000);
    return {
      tone: 'text-gray-700 bg-gray-50 border-gray-200',
      text: `Paid in the first weekly payout after ${day(due.toISOString())}.`,
    };
  }
  return null;
}

export function SupplierOrders({
  orders, loading, holdDays = 7, onChanged,
}: {
  orders: SupplierOrder[];
  loading: boolean;
  holdDays?: number;
  onChanged: () => Promise<void> | void;
}) {
  const [filter, setFilter] = useState<Filter>('open');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dispatchFor, setDispatchFor] = useState<string | null>(null);
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');
  const [cancelFor, setCancelFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [openBreakdown, setOpenBreakdown] = useState<string | null>(null);

  const visible = orders.filter((o) => inFilter(o, filter));
  const handDelivery = courier.trim().toLowerCase().startsWith('hand delivery');

  const act = async (order: SupplierOrder, action: Action, extra: { courier?: string; tracking?: string; reason?: string } = {}) => {
    setBusy(order.id);
    setError(null);
    const { error: rpcErr } = await supabase.rpc('update_supplier_shipment', {
      p_shipment_id: order.id,
      p_action: action,
      p_courier: extra.courier ?? null,
      p_tracking: extra.tracking ?? null,
      p_reason: extra.reason ?? null,
    });
    setBusy(null);
    if (rpcErr) {
      setError(friendlyError(rpcErr));
      return;
    }
    setDispatchFor(null);
    setCancelFor(null);
    await onChanged();
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display font-black text-2xl text-maroon-900">Your Orders</h2>
        <div className="flex bg-white p-1 rounded-2xl border border-amber-200/60 shadow-sm">
          {(['open', 'sent', 'closed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                filter === f ? 'bg-maroon-950 text-royal-300 shadow-md' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {FILTER_LABEL[f]} ({orders.filter((o) => inFilter(o, f)).length})
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-gray-500 leading-relaxed">
        Pack an order as soon as it arrives. The customer pays the rest before it leaves: send it only when it says{' '}
        <span className="font-bold text-emerald-700">Paid in full</span>. Their name, phone and address appear then.
      </p>

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-amber-200/60">
          <Loader2 size={28} className="text-amber-500 mx-auto mb-3 animate-spin" />
          <p className="font-bold text-gray-700 text-sm">Loading your orders…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-amber-200/60">
          <Truck size={34} className="text-gray-300 mx-auto mb-3" />
          <p className="font-bold text-gray-700">
            {filter === 'open' ? 'No orders to send right now.' : filter === 'sent' ? 'Nothing on the way.' : 'No finished orders yet.'}
          </p>
          <p className="text-xs text-gray-500 mt-1.5">New orders appear here the moment a customer pays the advance.</p>
        </div>
      ) : (
        visible.map((order) => {
          const note = payoutNote(order, holdDays);
          const canSend = (order.status === 'new' || order.status === 'ready') && order.paid_in_full && !order.order_cancelled;
          return (
            <motion.article
              key={order.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-3xl p-6 shadow-sm border ${
                order.status === 'new' ? 'border-2 border-amber-400' : 'border-amber-200/60'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-black text-lg text-maroon-950">Order #{order.order_ref}</span>
                  <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full ${STATUS_CHIP[order.status]}`}>
                    {SHIPMENT_LABEL[order.status]}
                  </span>
                  <span className="text-[11px] text-gray-500">{day(order.created_at)}</span>
                </div>
                <div className="sm:text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">You receive</p>
                  <p className="font-display font-black text-xl text-emerald-700">{rupees(Number(order.payout_amount))}</p>
                </div>
              </div>

              {order.order_cancelled && order.status !== 'cancelled' && (
                <p className="mt-3 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3">
                  SafaKing cancelled this order. Do not send it.
                </p>
              )}

              <ul className="mt-4 divide-y divide-amber-100 text-sm">
                {order.items.map((item, index) => (
                  <li key={`${item.name}-${index}`} className="py-2 flex justify-between gap-3">
                    <span className="text-maroon-950">
                      {item.name} <span className="text-gray-500">× {item.quantity}</span>
                    </span>
                    <span className="font-bold text-maroon-950">{rupees(Number(item.line_total))}</span>
                  </li>
                ))}
                <li className="py-2 flex justify-between gap-3 text-gray-600">
                  <span>Delivery charge ({ZONE_LABEL[order.zone]})</span>
                  <span>{rupees(order.shipping_amount)}</span>
                </li>
              </ul>

              <button
                onClick={() => setOpenBreakdown(openBreakdown === order.id ? null : order.id)}
                className="mt-1 text-[11px] font-bold text-maroon-700 hover:underline"
              >
                {openBreakdown === order.id ? 'Hide' : 'How'} your amount is worked out
              </button>
              {openBreakdown === order.id && (
                <div className="mt-2 rounded-2xl bg-amber-50/60 border border-amber-200 p-3 text-[11px] text-gray-700 space-y-1">
                  {order.items.map((item, index) => (
                    <div key={`${item.name}-split-${index}`} className="space-y-0.5">
                      <p className="font-bold text-maroon-950">{item.name}</p>
                      <p className="flex justify-between"><span>Sold for</span><span>{rupees(Number(item.line_total))}</span></p>
                      <p className="flex justify-between"><span>GST ({Number(item.gst_percent)}%)</span><span>− {rupees(Number(item.gst_amount))}</span></p>
                      <p className="flex justify-between"><span>SafaKing platform fee</span><span>− {rupees(Number(item.platform_fee))}</span></p>
                      <p className="flex justify-between"><span>Payment gateway fee</span><span>− {rupees(Number(item.gateway_fee))}</span></p>
                    </div>
                  ))}
                  <p className="flex justify-between"><span>Delivery charge, in full</span><span>+ {rupees(order.shipping_amount)}</span></p>
                  <p className="flex justify-between font-black text-emerald-800 pt-1 border-t border-amber-200">
                    <span>You receive</span><span>{rupees(Number(order.payout_amount))}</span>
                  </p>
                </div>
              )}

              <div className="mt-4 grid sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-start gap-2 text-maroon-900/80">
                  <MapPin size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Goes to <strong>{order.ship_to_area ?? 'India'}</strong>
                    {order.ship_to_pincode ? ` · ${order.ship_to_pincode}` : ''}
                  </span>
                </div>
                {(order.status === 'new' || order.status === 'ready') && !order.order_cancelled && (
                  <div
                    className={`flex items-start gap-2 font-bold ${order.paid_in_full ? 'text-emerald-700' : 'text-amber-800'}`}
                  >
                    {order.paid_in_full ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <Clock size={14} className="shrink-0 mt-0.5" />}
                    <span>
                      {order.paid_in_full
                        ? 'Paid in full. Send it now.'
                        : 'Waiting for the customer to pay the balance. Pack it, but do not send it yet.'}
                    </span>
                  </div>
                )}
              </div>

              {order.customer && (
                <div className="mt-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 p-3 text-xs text-maroon-950 space-y-1.5">
                  <p className="flex items-center gap-2"><User size={13} className="text-emerald-700" /> {order.customer.name}</p>
                  <p className="flex items-center gap-2">
                    <Phone size={13} className="text-emerald-700" />
                    <a href={`tel:${order.customer.phone}`} className="font-bold underline">{order.customer.phone}</a>
                    <span className="text-[10px] text-gray-500">(for the courier only)</span>
                  </p>
                  <p className="flex items-start gap-2"><MapPin size={13} className="text-emerald-700 shrink-0 mt-0.5" /> {order.customer.address}</p>
                </div>
              )}

              {(order.status === 'dispatched' || order.status === 'delivered') && order.courier && (
                <p className="mt-3 text-xs text-gray-700 flex items-center gap-2">
                  <Truck size={14} className="text-sky-700" />
                  {order.courier}
                  {order.tracking_number ? ` · ${order.tracking_number}` : ''}
                  {order.dispatched_at ? ` · sent ${day(order.dispatched_at)}` : ''}
                  {order.delivered_at ? ` · delivered ${day(order.delivered_at)}` : ''}
                </p>
              )}
              {order.status === 'cancelled' && order.cancel_reason && (
                <p className="mt-3 text-xs text-gray-600">Cancelled: {order.cancel_reason}</p>
              )}

              {note && (
                <p className={`mt-3 text-[11px] font-bold rounded-xl border p-2.5 flex items-center gap-2 ${note.tone}`}>
                  {order.payout_hold ? <ShieldAlert size={13} /> : <Wallet size={13} />} {note.text}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {order.status === 'new' && !order.order_cancelled && (
                  <button
                    onClick={() => act(order, 'ready')}
                    disabled={busy === order.id}
                    className="px-5 py-2.5 bg-royal-500 hover:bg-royal-400 disabled:opacity-60 text-maroon-950 font-bold text-[11px] uppercase tracking-wider rounded-xl flex items-center gap-1.5"
                  >
                    {busy === order.id ? <Loader2 size={13} className="animate-spin" /> : <PackageCheck size={13} />} Mark packed
                  </button>
                )}
                {canSend && (
                  <button
                    onClick={() => {
                      setDispatchFor(dispatchFor === order.id ? null : order.id);
                      setCancelFor(null);
                      setCourier('');
                      setTracking('');
                    }}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] uppercase tracking-wider rounded-xl flex items-center gap-1.5"
                  >
                    <Truck size={13} /> Send parcel
                  </button>
                )}
                {order.status === 'dispatched' && (
                  <button
                    onClick={() => act(order, 'deliver')}
                    disabled={busy === order.id}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-[11px] uppercase tracking-wider rounded-xl flex items-center gap-1.5"
                  >
                    {busy === order.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Mark delivered
                  </button>
                )}
                {(order.status === 'new' || order.status === 'ready') && !order.order_cancelled && (
                  <button
                    onClick={() => {
                      setCancelFor(cancelFor === order.id ? null : order.id);
                      setDispatchFor(null);
                      setReason('');
                    }}
                    className="px-4 py-2.5 bg-white border-2 border-rose-300 hover:bg-rose-50 text-rose-700 font-bold text-[11px] uppercase tracking-wider rounded-xl flex items-center gap-1.5"
                  >
                    <XCircle size={13} /> Can&apos;t send it
                  </button>
                )}
              </div>

              {dispatchFor === order.id && (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Courier</label>
                      <input
                        list="safaking-couriers"
                        value={courier}
                        onChange={(e) => setCourier(e.target.value)}
                        placeholder="e.g. Delhivery, or Hand delivery"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      />
                      <datalist id="safaking-couriers">
                        {COURIERS.map((c) => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                    {!handDelivery && (
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Tracking number</label>
                        <input
                          value={tracking}
                          onChange={(e) => setTracking(e.target.value)}
                          placeholder="From the courier receipt"
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => act(order, 'dispatch', { courier, tracking: handDelivery ? undefined : tracking })}
                    disabled={busy === order.id}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    {busy === order.id && <Loader2 size={14} className="animate-spin" />} Confirm it has been sent
                  </button>
                </div>
              )}

              {cancelFor === order.id && (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50/40 p-4 space-y-3">
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why can't you send it? (e.g. out of stock)"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:ring-2 focus:ring-rose-500/20 outline-none"
                  />
                  <p className="text-[10px] text-rose-800/80 leading-relaxed">
                    SafaKing refunds the customer. If you ran out of stock, set the stock in Products so it is not
                    ordered again.
                  </p>
                  <button
                    onClick={() => act(order, 'cancel', { reason })}
                    disabled={busy === order.id}
                    className="w-full py-3 bg-rose-700 hover:bg-rose-800 disabled:opacity-60 text-white font-bold rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    {busy === order.id && <Loader2 size={14} className="animate-spin" />} Cancel this order
                  </button>
                </div>
              )}
            </motion.article>
          );
        })
      )}
    </section>
  );
}
