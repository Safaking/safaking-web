'use client';

import { useCallback, useEffect, useState } from 'react';
import { PackageX, Phone, MessageCircle, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * Orders sitting with a supplier who has not sent them.
 *
 * Before this, the way the shop learned an order had not moved was a customer
 * ringing to ask where their safa was. The number to ring back is on the card
 * for the same reason: knowing a parcel is late is only half of it.
 *
 * A wedding has a date, so late is not a smaller version of on time — a safa
 * that arrives after the baraat is worth nothing. The worst offenders are at
 * the top, counted against the supplier's own promised dispatch days.
 */

type Pending = {
  id: string;
  status: 'new' | 'ready';
  ordered_at: string;
  ready_at: string | null;
  items_amount: number;
  order_id: string;
  business_name: string;
  supplier_phone: string | null;
  supplier_city: string | null;
  promised_days: number;
  overdue_days: number;
  line_count: number;
};

const waNumber = (phone?: string | null) => {
  if (!phone) return null;
  let d = phone.replace(/\D/g, '');
  if (d.length === 10) d = `91${d}`;
  return d.length >= 12 ? d : null;
};

export default function DispatchWatch() {
  const [rows, setRows] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: rpcErr } = await supabase.rpc('admin_pending_shipments');
    if (rpcErr) setError(rpcErr.message);
    else setRows((data ?? []) as Pending[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const late = rows.filter((r) => r.overdue_days > 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PackageX className="text-indigo-600" size={20} />
          <h2 className="text-xl font-bold text-slate-800">Not dispatched yet</h2>
          {late.length > 0 && (
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-black text-rose-700">
              {late.length} late
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:border-slate-300"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          <AlertCircle size={14} /> {error}
        </p>
      )}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 size={15} className="animate-spin" /> Loading…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm font-medium text-slate-500">
          Nothing waiting on a supplier. Every paid order has been sent.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const wa = waNumber(r.supplier_phone);
            const days = Math.floor(
              (Date.now() - new Date(r.ordered_at).getTime()) / 86_400_000
            );
            return (
              <div
                key={r.id}
                className={`rounded-xl border p-4 ${
                  r.overdue_days > 0
                    ? 'border-rose-200 bg-rose-50/60'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-800">{r.business_name}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          r.status === 'new'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {r.status === 'new' ? 'not packed' : 'packed, not sent'}
                      </span>
                      {r.overdue_days > 0 && (
                        <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                          {r.overdue_days} day{r.overdue_days === 1 ? '' : 's'} late
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {r.line_count} item{r.line_count === 1 ? '' : 's'} · ₹
                      {Number(r.items_amount).toLocaleString('en-IN')} ·{' '}
                      ordered {days} day{days === 1 ? '' : 's'} ago
                      {r.supplier_city ? ` · ${r.supplier_city}` : ''}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      They promised {r.promised_days} day{r.promised_days === 1 ? '' : 's'}
                    </p>
                  </div>

                  {/* The number, right here. Knowing a parcel is late is only
                      half of it — the other half is ringing them about it. */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {r.supplier_phone ? (
                      <>
                        <a
                          href={`tel:${r.supplier_phone}`}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 hover:border-slate-300"
                        >
                          <Phone size={13} /> {r.supplier_phone}
                        </a>
                        {wa && (
                          <a
                            href={`https://wa.me/${wa}?text=${encodeURIComponent(
                              `Namaste, order from SafaKing placed ${days} day${days === 1 ? '' : 's'} ago is still to be dispatched. Could you send it today?`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-700"
                          >
                            <MessageCircle size={13} /> WhatsApp
                          </a>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400">No number on file</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
