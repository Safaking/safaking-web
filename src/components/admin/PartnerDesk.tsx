'use client';

import { useCallback, useEffect, useState } from 'react';
import { Briefcase, Check, X, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * Businesses asking to refer on the trade rate.
 *
 * The higher rate is only paid to an approved partner, and before this the
 * only way to approve one was to edit the row by hand — so in practice nobody
 * was ever approved and nobody was ever paid it.
 *
 * Everything a decision needs is on the card: who they are, where they are,
 * how to reach them, where credit would be paid, and what they have actually
 * brought in so far. Approving on a business name alone is how a trade rate
 * ends up going to somebody's cousin.
 */

type Partner = {
  id: string;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  kind: string | null;
  city: string | null;
  address_line: string | null;
  village: string | null;
  tehsil: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  payout_upi: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
  code: string | null;
  earned: number;
  joined_count: number;
};

const TONE: Record<Partner['status'], string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-700 border-rose-200',
};

export default function PartnerDesk() {
  const [rows, setRows] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: rpcErr } = await supabase.rpc('admin_list_partners');
    if (rpcErr) setError(rpcErr.message);
    else setRows((data ?? []) as Partner[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string, status: Partner['status']) => {
    setBusy(id);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc('admin_set_partner_status', {
      p_id: id,
      p_status: status,
    });
    setBusy(null);
    const result = data as { ok?: boolean; error?: string } | null;
    if (rpcErr || !result?.ok) {
      setError(result?.error ?? rpcErr?.message ?? 'Could not save that.');
      return;
    }
    void load();
  };

  const address = (p: Partner) =>
    [p.address_line, p.village || p.city, p.tehsil, p.district, p.state, p.pincode]
      .filter(Boolean)
      .join(', ');

  const waiting = rows.filter((r) => r.status === 'pending').length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Briefcase className="text-indigo-600" size={20} />
          <h2 className="text-xl font-bold text-slate-800">Business partners</h2>
          {waiting > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-800">
              {waiting} waiting
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
          Nobody has applied yet. Applications arrive from the refer page.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-800">{p.business_name}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${TONE[p.status]}`}>
                      {p.status}
                    </span>
                    {p.code && (
                      <span className="font-mono text-[11px] font-bold text-slate-500">{p.code}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {[p.kind, p.contact_name].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>

                {/* What they have brought in, which is the other half of the
                    decision — a name alone says nothing. */}
                <div className="text-right text-xs shrink-0">
                  <p className="font-black text-slate-800">₹{(p.earned || 0).toLocaleString('en-IN')}</p>
                  <p className="text-slate-400">{p.joined_count} joined</p>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 border-t border-slate-200 pt-3 text-xs sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="shrink-0 font-bold text-slate-400">Address</dt>
                  <dd className="text-slate-700">{address(p) || '—'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 font-bold text-slate-400">Phone</dt>
                  <dd className="text-slate-700">
                    {[p.phone, p.whatsapp && `WA ${p.whatsapp}`].filter(Boolean).join(' · ') || '—'}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 font-bold text-slate-400">Payout</dt>
                  <dd className="font-mono text-slate-700">{p.payout_upi || '—'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 font-bold text-slate-400">Applied</dt>
                  <dd className="text-slate-700">
                    {new Date(p.created_at).toLocaleDateString('en-IN')}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap gap-2">
                {p.status !== 'approved' && (
                  <button
                    type="button"
                    disabled={busy === p.id}
                    onClick={() => void decide(p.id, 'approved')}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check size={13} /> Approve — pays the trade rate
                  </button>
                )}
                {p.status !== 'rejected' && (
                  <button
                    type="button"
                    disabled={busy === p.id}
                    onClick={() => void decide(p.id, 'rejected')}
                    className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-[11px] font-bold text-rose-700 hover:border-rose-300 disabled:opacity-50"
                  >
                    <X size={13} /> Reject
                  </button>
                )}
                {p.status !== 'pending' && (
                  <button
                    type="button"
                    disabled={busy === p.id}
                    onClick={() => void decide(p.id, 'pending')}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-500 hover:border-slate-300 disabled:opacity-50"
                  >
                    Put back to waiting
                  </button>
                )}
              </div>

              {p.status === 'approved' && (
                <p className="mt-2 text-[11px] font-semibold text-slate-400">
                  Earns the trade rate on orders from here on. Credit already paid is untouched.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
