'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Wallet, Plus, Trash2, Loader2, AlertCircle, Search, Download, Printer,
} from 'lucide-react';
import {
  supabase, friendlyError, DBExpense, EXPENSE_CATEGORIES, EXPENSE_MODES,
} from '@/lib/supabase';

const money = (v: number) => `₹${Math.round(v ?? 0).toLocaleString('en-IN')}`;
const todayISO = () => new Date().toLocaleDateString('en-CA');
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA');
};

const CATEGORY_LABEL: Record<string, string> = {
  salary: 'Salary & wages',
  artist_payment: 'Artist payment',
  marketing: 'Marketing & ads',
  rent: 'Shop rent',
  electricity: 'Electricity & utilities',
  delivery: 'Delivery & courier',
  software: 'Software & subscriptions',
  travel: 'Travel & fuel',
  materials: 'Fabric & materials',
  refund: 'Customer refund',
  other: 'Other',
};

const CATEGORY_TONE: Record<string, string> = {
  salary: 'bg-royal-100 text-royal-800',
  artist_payment: 'bg-maroon-100 text-maroon-800',
  marketing: 'bg-blue-100 text-blue-800',
  rent: 'bg-amber-100 text-amber-800',
  electricity: 'bg-yellow-100 text-yellow-800',
  delivery: 'bg-teal-100 text-teal-800',
  software: 'bg-indigo-100 text-indigo-800',
  travel: 'bg-cyan-100 text-cyan-800',
  materials: 'bg-emerald-100 text-emerald-800',
  refund: 'bg-rose-100 text-rose-800',
  other: 'bg-gray-100 text-gray-700',
};

const FIELD =
  'w-full px-3.5 py-2.5 rounded-xl border border-amber-200/80 bg-white text-[13px] font-medium text-maroon-950 outline-none focus:ring-2 focus:ring-maroon-800/15 focus:border-amber-300';

/**
 * Every rupee going out. Without this the Reports tab could only ever show
 * revenue — "Profit & Loss" with no expenses is just sales with a nicer name.
 */
export function ExpenseLedger() {
  const [rows, setRows] = useState<DBExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayISO());
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    expense_date: todayISO(),
    category: 'marketing',
    description: '',
    amount: '',
    payment_mode: 'cash',
    paid_to: '',
    reference: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });

    if (err) setError(friendlyError(err));
    else setError(null);
    setRows((data as DBExpense[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => r.expense_date >= from && r.expense_date <= to)
      .filter((r) => category === 'all' || r.category === category)
      .filter((r) =>
        !q ||
        (r.description ?? '').toLowerCase().includes(q) ||
        (r.paid_to ?? '').toLowerCase().includes(q) ||
        (r.reference ?? '').toLowerCase().includes(q)
      );
  }, [rows, from, to, category, search]);

  const total = useMemo(() => filtered.reduce((s, r) => s + Number(r.amount ?? 0), 0), [filtered]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => map.set(r.category, (map.get(r.category) ?? 0) + Number(r.amount ?? 0)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter the amount spent.');
      return;
    }

    setSaving(true);
    setError(null);
    const { data: auth } = await supabase.auth.getUser();

    const { data, error: err } = await supabase
      .from('expenses')
      .insert({
        expense_date: form.expense_date,
        category: form.category,
        description: form.description.trim() || null,
        amount,
        payment_mode: form.payment_mode,
        paid_to: form.paid_to.trim() || null,
        reference: form.reference.trim() || null,
        created_by: auth.user?.id ?? null,
      })
      .select('*')
      .single();

    setSaving(false);
    if (err) {
      setError(friendlyError(err));
      return;
    }

    setRows((prev) => [data as DBExpense, ...prev]);
    setForm((f) => ({ ...f, description: '', amount: '', paid_to: '', reference: '' }));
  };

  const remove = async (row: DBExpense) => {
    if (!confirm(`Delete this ${CATEGORY_LABEL[row.category] ?? row.category} entry of ${money(row.amount)}?`)) return;
    const previous = rows;
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    const { error: err } = await supabase.from('expenses').delete().eq('id', row.id);
    if (err) {
      setRows(previous);
      setError(friendlyError(err));
    }
  };

  const exportCSV = () => {
    const headers = ['Date', 'Category', 'Description', 'Paid To', 'Mode', 'Reference', 'Amount'];
    const lines = filtered.map((r) => [
      r.expense_date, CATEGORY_LABEL[r.category] ?? r.category, r.description ?? '',
      r.paid_to ?? '', r.payment_mode, r.reference ?? '', r.amount,
    ]);
    const esc = (v: string | number) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(','), ...lines.map((l) => l.map(esc).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `safaking-expenses-${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 no-print">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {/* Add */}
      <form
        onSubmit={add}
        className="bg-white rounded-3xl border border-amber-200/70 shadow-sm p-6 space-y-4 no-print"
      >
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-maroon-950 text-royal-300 flex items-center justify-center">
            <Wallet size={17} />
          </span>
          <div>
            <p className="font-display font-black text-base text-maroon-950">Record an expense</p>
            <p className="text-[11px] text-gray-500">Every entry feeds the Profit &amp; Loss report.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block">
            <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Date</span>
            <input type="date" required value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Category</span>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={FIELD}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Amount (₹)</span>
            <input type="number" min={1} required placeholder="0" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Paid by</span>
            <select value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })} className={FIELD}>
              {EXPENSE_MODES.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Description</span>
            <input placeholder="e.g. Instagram ads — Nov campaign" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Paid to</span>
            <input placeholder="Person / vendor" value={form.paid_to}
              onChange={(e) => setForm({ ...form, paid_to: e.target.value })} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Bill / Ref no.</span>
            <input placeholder="Optional" value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })} className={FIELD} />
          </label>
        </div>

        <button type="submit" disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-maroon-950 hover:bg-maroon-900 disabled:opacity-60 text-royal-300 text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Plus size={14} /> Add expense</>}
        </button>
      </form>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-2xl bg-white border border-amber-200/70 no-print">
        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="block mt-1 px-3 py-2 rounded-xl border border-amber-200/80 text-xs font-bold text-maroon-950" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="block mt-1 px-3 py-2 rounded-xl border border-amber-200/80 text-xs font-bold text-maroon-950" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="block mt-1 px-3 py-2 rounded-xl border border-amber-200/80 text-xs font-bold text-maroon-950">
            <option value="all">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 flex-1 min-w-[12rem]">
          Search
          <span className="relative block mt-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Description, vendor, bill no…"
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-amber-200/80 text-xs font-medium text-maroon-950" />
          </span>
        </label>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={exportCSV}
            className="px-3 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[11px] font-bold flex items-center gap-1.5">
            <Download size={13} /> CSV
          </button>
          <button onClick={() => window.print()}
            className="px-3 py-2 rounded-xl bg-maroon-950 hover:bg-maroon-900 text-royal-300 text-[11px] font-bold flex items-center gap-1.5">
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      <div id="report-print-area" className="bg-white rounded-3xl border border-amber-200/70 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-amber-100 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display font-black text-lg text-maroon-950">Expense Register</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{from} to {to} · {filtered.length} entries</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Total spent</p>
            <p className="font-display font-black text-3xl text-rose-800 tabular-nums">{money(total)}</p>
          </div>
        </div>

        {byCategory.length > 0 && (
          <div className="px-6 py-4 border-b border-amber-100 flex flex-wrap gap-2">
            {byCategory.map(([cat, sum]) => (
              <span key={cat}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${CATEGORY_TONE[cat] ?? CATEGORY_TONE.other}`}>
                {CATEGORY_LABEL[cat] ?? cat} · {money(sum)}
              </span>
            ))}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 size={24} className="animate-spin mx-auto mb-2 text-amber-500" />
            <p className="text-xs font-bold text-gray-600">Loading expenses…</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-14 text-center text-sm text-gray-500">
            No expenses recorded for this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-amber-50/70 border-y border-amber-200/70">
                <tr>
                  {['Date', 'Category', 'Description', 'Paid To', 'Mode', 'Ref', 'Amount', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-maroon-900/60 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-amber-50/40">
                    <td className="px-4 py-2.5 text-[12px] font-bold text-maroon-950 whitespace-nowrap">{r.expense_date}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${CATEGORY_TONE[r.category] ?? CATEGORY_TONE.other}`}>
                        {CATEGORY_LABEL[r.category] ?? r.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-700">{r.description ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-700">{r.paid_to ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[11px] uppercase font-bold text-gray-500">{r.payment_mode}</td>
                    <td className="px-4 py-2.5 text-[11px] text-gray-500">{r.reference ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[13px] font-black text-rose-800 tabular-nums whitespace-nowrap">{money(r.amount)}</td>
                    <td className="px-4 py-2.5 no-print">
                      <button onClick={() => remove(r)} title="Delete entry"
                        className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center justify-center">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-amber-50/70 border-t-2 border-amber-200">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-maroon-900/70">Total</td>
                  <td className="px-4 py-3 text-sm font-black text-rose-900 tabular-nums">{money(total)}</td>
                  <td className="no-print" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
