'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift, Plus, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, Store, Users } from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';

/**
 * Who referred whom, and what the shop owes in credit (supabase/045, 046).
 *
 * The figure that matters is the outstanding one: credit given out and not
 * yet spent is money promised against future baskets, and it is the only
 * number here that is a liability rather than a record.
 */

interface CodeRow {
  code: string;
  owner_id: string | null;
  label: string | null;
  active: boolean;
  created_at: string;
}

interface ReferralRow {
  id: string;
  code: string;
  joiner_id: string;
  status: 'joined' | 'earned' | 'void';
  joined_at: string;
  earned_at: string | null;
}

interface LedgerRow {
  user_id: string;
  amount: number;
  reason: string;
  created_at: string;
}

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const day = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

export function ReferralDesk() {
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [codeRes, refRes, ledgerRes] = await Promise.all([
      supabase.from('referral_codes').select('*').order('created_at', { ascending: false }),
      supabase.from('referrals').select('*').order('joined_at', { ascending: false }).limit(200),
      supabase.from('credit_ledger').select('user_id, amount, reason, created_at').limit(2000),
    ]);

    // A database without supabase/045 says so plainly rather than looking broken.
    if (codeRes.error && /referral_codes/i.test(codeRes.error.message)) {
      setMissing(true);
      setLoading(false);
      return;
    }

    const codeRows = (codeRes.data ?? []) as CodeRow[];
    const refRows = (refRes.data ?? []) as ReferralRow[];
    const ledgerRows = (ledgerRes.data ?? []) as LedgerRow[];
    setCodes(codeRows);
    setReferrals(refRows);
    setLedger(ledgerRows);

    // Names for everyone who appears, in one query.
    const ids = [...new Set([
      ...refRows.map((r) => r.joiner_id),
      ...codeRows.map((c) => c.owner_id).filter(Boolean) as string[],
      ...ledgerRows.map((l) => l.user_id),
    ])];
    if (ids.length) {
      const { data: people } = await supabase.from('profiles').select('id, full_name, phone').in('id', ids);
      setNames(Object.fromEntries(
        ((people ?? []) as { id: string; full_name: string; phone: string | null }[])
          .map((p) => [p.id, p.full_name?.trim() || p.phone || 'Customer'])
      ));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const given = ledger.filter((l) => l.amount > 0).reduce((sum, l) => sum + l.amount, 0);
    const spent = ledger.filter((l) => l.amount < 0).reduce((sum, l) => sum - l.amount, 0);
    return {
      given,
      spent,
      outstanding: given - spent,
      joined: referrals.length,
      earned: referrals.filter((r) => r.status === 'earned').length,
    };
  }, [ledger, referrals]);

  const joinsPerCode = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of referrals) counts[r.code] = (counts[r.code] ?? 0) + 1;
    return counts;
  }, [referrals]);

  const makeCode = async () => {
    if (!newCode.trim() || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { data, error: rpcErr } = await supabase.rpc('create_shop_code', {
      p_code: newCode.trim(),
      p_label: newLabel.trim(),
    });
    setBusy(false);
    const result = data as { ok?: boolean; error?: string; code?: string } | null;
    if (rpcErr || !result?.ok) {
      setError(result?.error ?? friendlyError(rpcErr ?? new Error('Could not make that code.')));
      return;
    }
    setNotice(`${result.code} is ready to hand out.`);
    setNewCode('');
    setNewLabel('');
    void load();
  };

  const toggle = async (code: string, active: boolean) => {
    setBusy(true);
    const { error: rpcErr } = await supabase.rpc('set_referral_code_active', { p_code: code, p_active: active });
    setBusy(false);
    if (rpcErr) return setError(friendlyError(rpcErr));
    setCodes((prev) => prev.map((c) => (c.code === code ? { ...c, active } : c)));
  };

  if (missing) {
    return (
      <Card>
        <p className="p-6 text-sm text-gray-700">
          Run <span className="font-mono text-[12px] text-maroon-900">supabase/045_referrals_and_credits.sql</span>{' '}
          and <span className="font-mono text-[12px] text-maroon-900">046_referral_admin.sql</span> to turn referrals on.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed">{notice}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Credit given" value={money(totals.given)} />
        <Stat label="Credit spent" value={money(totals.spent)} />
        <Stat
          label="Still owed"
          value={money(totals.outstanding)}
          hint="Promised against future orders"
          strong
        />
        <Stat label="Referrals" value={`${totals.earned} / ${totals.joined}`} hint="Earned / joined" />
      </div>

      {/* Shop codes — the card at the counter. These earn nobody a commission. */}
      <Card>
        <Header icon={<Store size={18} className="text-amber-600" />} title="Shop codes">
          Hand these out at the counter. The customer gets their credit; no commission is paid.
        </Header>
        <div className="flex flex-wrap gap-2 border-b border-amber-100 p-5">
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            placeholder="SAFAKING"
            maxLength={16}
            className="w-40 rounded-xl border border-amber-300 px-4 py-2.5 font-mono text-sm uppercase tracking-widest outline-none focus:ring-2 focus:ring-maroon-800/20"
          />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Where it is used — counter card, an artist…"
            className="min-w-[220px] flex-1 rounded-xl border border-amber-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-maroon-800/20"
          />
          <button
            type="button"
            onClick={() => void makeCode()}
            disabled={busy || !newCode.trim()}
            className="flex items-center gap-2 rounded-xl bg-maroon-950 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-royal-100 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Make the code
          </button>
        </div>

        {loading ? (
          <Loading />
        ) : codes.length === 0 ? (
          <Empty>No codes yet. Customers get one automatically the first time they open Refer.</Empty>
        ) : (
          <ul className="divide-y divide-amber-100">
            {codes.map((c) => (
              <li key={c.code} className="flex flex-wrap items-center gap-3 p-4 hover:bg-amber-50/30">
                <span className="font-mono text-sm font-black tracking-widest text-maroon-950">{c.code}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800">
                  {c.owner_id ? names[c.owner_id] ?? 'Customer' : 'Shop'}
                </span>
                {!c.active && (
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-600">
                    Retired
                  </span>
                )}
                <span className="flex-1 text-[11px] text-gray-500">{c.label ?? ''}</span>
                <span className="text-[11px] font-bold text-gray-500">
                  {joinsPerCode[c.code] ?? 0} joined
                </span>
                <button
                  type="button"
                  onClick={() => void toggle(c.code, !c.active)}
                  disabled={busy}
                  title={c.active ? 'Retire this code' : 'Bring it back'}
                  className="rounded-xl border border-amber-200 p-2 text-maroon-800 hover:bg-amber-50 disabled:opacity-40"
                >
                  {c.active ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <Header icon={<Users size={18} className="text-amber-600" />} title="Who joined">
          A sharer is paid only once the person they brought in has actually bought something.
        </Header>
        {loading ? (
          <Loading />
        ) : referrals.length === 0 ? (
          <Empty>Nobody has used a code yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-amber-100 bg-amber-50/50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="p-4">Joined</th>
                  <th className="p-4">Code</th>
                  <th className="hidden p-4 sm:table-cell">Came in on</th>
                  <th className="p-4">Status</th>
                  <th className="hidden p-4 lg:table-cell">Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 text-xs">
                {referrals.map((r) => (
                  <tr key={r.id} className="hover:bg-amber-50/30">
                    <td className="p-4 font-bold text-maroon-950">{names[r.joiner_id] ?? 'Customer'}</td>
                    <td className="p-4 font-mono text-[11px] text-gray-600">{r.code}</td>
                    <td className="hidden p-4 text-gray-500 sm:table-cell">{day(r.joined_at)}</td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                          r.status === 'earned'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'void'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.status === 'earned' ? 'earned' : r.status === 'void' ? 'void' : 'waiting'}
                      </span>
                    </td>
                    <td className="hidden p-4 text-gray-500 lg:table-cell">{day(r.earned_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-3xl border border-amber-200/60 bg-white shadow-sm">{children}</div>;
}

function Header({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="border-b border-amber-100 p-6">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold text-maroon-950">
        {icon} {title}
      </h3>
      {children && <p className="mt-0.5 text-xs text-gray-500">{children}</p>}
    </div>
  );
}

function Stat({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${strong ? 'border-maroon-200 bg-maroon-50/50' : 'border-amber-200/60 bg-white'}`}>
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
        <Gift size={11} /> {label}
      </p>
      <p className="mt-1 text-xl font-black text-maroon-950">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}

const Loading = () => (
  <p className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500">
    <Loader2 size={16} className="animate-spin" /> Loading…
  </p>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="p-10 text-center text-sm text-gray-500">{children}</p>
);
