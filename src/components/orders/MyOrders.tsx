'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Package, Loader2, AlertCircle, CheckCircle2, Truck, Wallet, MessageSquareWarning, FileText, Send,
} from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { loadRazorpayScript, payAndVerify, payableFromBalance, startBalancePayment } from '@/lib/checkout';

type ParcelStatus = 'awaiting_payment' | 'new' | 'ready' | 'dispatched' | 'delivered' | 'cancelled';

/** One row of my_orders() — see supabase/040. Nothing about who sends it. */
interface MyOrder {
  id: string;
  ref: string;
  created_at: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  payment_status: 'advance_paid' | 'fully_paid' | 'refunded';
  total_amount: number;
  shipping_amount: number;
  advance_amount: number | null;
  balance_amount: number | null;
  items: { name: string; quantity: number; price: number; shipment_id: string | null }[];
  shipments: {
    id: string;
    status: ParcelStatus;
    courier: string | null;
    tracking_number: string | null;
    dispatched_at: string | null;
    delivered_at: string | null;
    problem_reported: boolean;
  }[];
}

const PARCEL_LABEL: Record<ParcelStatus, string> = {
  awaiting_payment: 'Waiting for payment',
  new: 'Being packed',
  ready: 'Packed',
  dispatched: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export function MyOrders({ customerName, customerPhone }: { customerName: string; customerPhone: string }) {
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problemFor, setProblemFor] = useState<string | null>(null);
  const [problemText, setProblemText] = useState('');

  const load = useCallback(async () => {
    const { data, error: loadErr } = await supabase.rpc('my_orders');
    if (loadErr) setError(friendlyError(loadErr));
    else setOrders((data as MyOrder[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const payBalance = async (order: MyOrder) => {
    setBusy(order.id);
    setError(null);
    setNotice(null);
    try {
      const started = await startBalancePayment(order.id);
      const ready = await loadRazorpayScript();
      if (!ready) throw new Error('Could not reach the payment provider. Check your connection.');
      const outcome = await payAndVerify(payableFromBalance(started), {
        name: customerName,
        phone: started.customerPhone || customerPhone,
      });
      setNotice(outcome.warning ?? 'Balance paid, thank you. Your order is being sent.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not take the payment.');
    } finally {
      setBusy(null);
    }
  };

  const confirmReceived = async (shipmentId: string) => {
    setBusy(shipmentId);
    setError(null);
    const { error: rpcErr } = await supabase.rpc('confirm_order_received', { p_shipment_id: shipmentId });
    setBusy(null);
    if (rpcErr) setError(friendlyError(rpcErr));
    else await load();
  };

  const reportProblem = async (shipmentId: string) => {
    setBusy(shipmentId);
    setError(null);
    const { error: rpcErr } = await supabase.rpc('report_order_problem', {
      p_shipment_id: shipmentId,
      p_description: problemText,
    });
    setBusy(null);
    if (rpcErr) {
      setError(friendlyError(rpcErr));
      return;
    }
    setProblemFor(null);
    setProblemText('');
    setNotice('Thank you for telling us. Our team will call you about it.');
    await load();
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-gray-500">
        <Loader2 size={22} className="animate-spin mx-auto text-amber-500" />
      </div>
    );
  }
  if (orders.length === 0 && !error) return null;

  return (
    <section className="space-y-4">
      <h2 className="font-display font-black text-xl text-maroon-900 flex items-center gap-2">
        <Package size={20} className="text-amber-600" /> My Orders
      </h2>

      {notice && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{notice}</p>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {orders.map((order) => {
        const balance = Number(order.balance_amount ?? 0);
        const sentSeparately = order.shipments.some((s) => s.status !== 'cancelled');
        const balanceDue = order.payment_status === 'advance_paid' && balance > 0 && order.status !== 'cancelled';
        return (
          <motion.article
            key={order.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white rounded-3xl shadow-sm p-6 border ${balanceDue && sentSeparately ? 'border-2 border-amber-400' : 'border-amber-200/60'}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-sm text-maroon-950">Order #{order.ref}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {day(order.created_at)} · {order.status === 'cancelled' ? 'Cancelled' : order.status}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display font-black text-lg text-maroon-950">₹{order.total_amount.toLocaleString('en-IN')}</p>
                {order.shipping_amount > 0 && (
                  <p className="text-[10px] text-gray-500">incl. ₹{order.shipping_amount.toLocaleString('en-IN')} delivery</p>
                )}
              </div>
            </div>

            <ul className="mt-3 text-xs text-gray-700 space-y-1">
              {order.items.map((item, index) => (
                <li key={`${item.name}-${index}`} className="flex justify-between gap-3">
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <span>₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>

            {balanceDue ? (
              <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-amber-900 leading-relaxed">
                  <span className="font-bold">₹{balance.toLocaleString('en-IN')} left to pay.</span>{' '}
                  {sentSeparately ? 'Your order is sent as soon as this is paid.' : 'Pay now, or on delivery.'}
                </p>
                <button
                  onClick={() => payBalance(order)}
                  disabled={busy === order.id}
                  className="px-5 py-2.5 bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5"
                >
                  {busy === order.id ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />}
                  Pay ₹{balance.toLocaleString('en-IN')}
                </button>
              </div>
            ) : order.payment_status === 'fully_paid' ? (
              <p className="mt-3 text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 size={13} /> Paid in full
              </p>
            ) : null}

            {order.shipments.map((parcel, index) => (
              <div key={parcel.id} className="mt-3 pt-3 border-t border-amber-100">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-maroon-950">
                    <Truck size={14} className="text-amber-600" />
                    {order.shipments.length > 1 ? `Parcel ${index + 1}: ` : ''}
                    {PARCEL_LABEL[parcel.status]}
                  </span>
                  {parcel.courier && (
                    <span className="text-gray-600">
                      {parcel.courier}
                      {parcel.tracking_number ? ` · ${parcel.tracking_number}` : ''}
                    </span>
                  )}
                </div>
                {parcel.dispatched_at && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Sent {day(parcel.dispatched_at)}
                    {parcel.delivered_at ? ` · delivered ${day(parcel.delivered_at)}` : ''}
                  </p>
                )}
                {parcel.problem_reported && (
                  <p className="text-[11px] text-rose-700 mt-1">You reported a problem. Our team is looking into it.</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {parcel.status === 'dispatched' && (
                    <button
                      onClick={() => confirmReceived(parcel.id)}
                      disabled={busy === parcel.id}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5"
                    >
                      {busy === parcel.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} I received it
                    </button>
                  )}
                  {(parcel.status === 'dispatched' || parcel.status === 'delivered') && !parcel.problem_reported && (
                    <button
                      onClick={() => {
                        setProblemFor(problemFor === parcel.id ? null : parcel.id);
                        setProblemText('');
                      }}
                      className="text-[11px] font-bold text-rose-700 hover:text-rose-800 flex items-center gap-1.5"
                    >
                      <MessageSquareWarning size={13} /> {problemFor === parcel.id ? 'Cancel' : 'Report a problem'}
                    </button>
                  )}
                </div>
                {problemFor === parcel.id && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      rows={2}
                      value={problemText}
                      onChange={(e) => setProblemText(e.target.value)}
                      placeholder="What is wrong? (damaged, wrong item, not received…)"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:ring-2 focus:ring-rose-500/20 outline-none"
                    />
                    <button
                      onClick={() => reportProblem(parcel.id)}
                      disabled={busy === parcel.id}
                      className="w-full py-2.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-60 text-white font-bold rounded-xl text-[11px] uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      {busy === parcel.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send to SafaKing
                    </button>
                  </div>
                )}
              </div>
            ))}

            <Link
              href={`/documents/invoice/${order.id}`}
              className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-maroon-700 hover:underline"
            >
              <FileText size={12} /> Invoice
            </Link>
          </motion.article>
        );
      })}
    </section>
  );
}
