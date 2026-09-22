'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserX, Loader2, AlertCircle, CheckCircle2, RefreshCw, Phone, Mail, ShieldAlert } from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';

/**
 * Account deletion requests (supabase/041). A request from a signed-in person
 * already closed their sign-in; one from the web form is only a claim until
 * someone here has called them back. Completing removes the sign-in and
 * clears the person out of the database; orders and bookings stay for tax.
 */

interface DeletionRequest {
  id: string;
  user_id: string | null;
  source: 'app' | 'web' | 'web_form';
  status: 'pending' | 'completed' | 'cancelled';
  verified: boolean;
  account_role: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  reason: string | null;
  requested_at: string;
  handled_at: string | null;
  handled_note: string | null;
}

const SOURCE_LABEL: Record<DeletionRequest['source'], string> = {
  app: 'From the app',
  web: 'From the website',
  web_form: 'Web form — not signed in',
};

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export function DeletionDesk() {
  const [view, setView] = useState<'pending' | 'done'>('pending');
  const [rows, setRows] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const query = supabase
      .from('account_deletion_requests')
      .select('id, user_id, source, status, verified, account_role, contact_name, contact_phone, contact_email, reason, requested_at, handled_at, handled_note')
      .order('requested_at', { ascending: view === 'pending' })
      .limit(200);
    const { data, error: loadError } = view === 'pending'
      ? await query.eq('status', 'pending')
      : await query.neq('status', 'pending');
    if (loadError) {
      setError(/account_deletion_requests/.test(loadError.message)
        ? 'Account deletion is not set up in the database yet — run supabase/041_account_deletion.sql.'
        : friendlyError(loadError));
      setRows([]);
    } else {
      setRows((data ?? []) as DeletionRequest[]);
    }
    setLoading(false);
  }, [view]);

  useEffect(() => { void load(); }, [load]);

  const act = async (row: DeletionRequest, action: 'complete' | 'cancel') => {
    if (busyId) return;
    const question = action === 'complete'
      ? `Delete ${row.contact_name || 'this account'} now? This cannot be undone.`
      : `Cancel this request and re-open ${row.contact_name || 'the account'}'s sign-in?`;
    if (!window.confirm(question)) return;
    setBusyId(row.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/account-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, action, confirmedIdentity: !!confirmed[row.id] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That did not work. Please try again.');
      setNotice(action === 'complete' ? 'Account deleted.' : 'Request cancelled and sign-in re-opened.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display font-black text-xl text-maroon-950">
            <UserX size={20} /> Account Deletions
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Customers who asked to delete their account. Google Play expects them handled promptly — we promise
            within 7 days. Orders, bookings and invoices stay for tax; the person is removed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['pending', 'done'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${
                view === v ? 'bg-maroon-950 text-royal-100' : 'bg-white border border-amber-200 text-maroon-800'
              }`}
            >
              {v === 'pending' ? 'Waiting' : 'Handled'}
            </button>
          ))}
          <button onClick={() => void load()} className="p-2 rounded-full bg-white border border-amber-200 text-maroon-800" aria-label="Refresh">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {notice && (
        <p className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          <CheckCircle2 size={16} /> {notice}
        </p>
      )}
      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-maroon-800" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl bg-white border border-amber-200/70 p-10 text-center text-sm text-gray-500">
          {view === 'pending' ? 'No one is waiting to have their account deleted.' : 'Nothing handled yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const age = daysSince(row.requested_at);
            const overdue = row.status === 'pending' && age >= 5;
            const artistOrSupplier = row.account_role === 'artist' || row.account_role === 'supplier';
            return (
              <div key={row.id} className={`rounded-2xl bg-white border p-5 ${overdue ? 'border-rose-300' : 'border-amber-200/70'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-maroon-950">{row.contact_name || (row.status === 'pending' ? 'Name not given' : 'Deleted user')}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {SOURCE_LABEL[row.source]} · {dateTime(row.requested_at)}
                      {row.status === 'pending' && ` · ${age === 0 ? 'today' : `${age} day${age === 1 ? '' : 's'} ago`}`}
                      {row.account_role && ` · ${row.account_role}`}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    row.status === 'pending'
                      ? overdue ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      : row.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {row.status === 'pending' ? (overdue ? 'Due soon' : 'Waiting') : row.status}
                  </span>
                </div>

                {(row.contact_phone || row.contact_email) && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {row.contact_phone && (
                      <a href={`tel:+91${row.contact_phone.replace(/\D/g, '').slice(-10)}`} className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 font-bold text-maroon-800">
                        <Phone size={12} /> {row.contact_phone}
                      </a>
                    )}
                    {row.contact_email && (
                      <a href={`mailto:${row.contact_email}`} className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 font-bold text-maroon-800">
                        <Mail size={12} /> {row.contact_email}
                      </a>
                    )}
                  </div>
                )}
                {row.reason && <p className="mt-3 text-sm text-gray-700">“{row.reason}”</p>}

                {row.status === 'pending' && (
                  <div className="mt-4 space-y-3">
                    {!row.user_id && (
                      <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                        <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                        No account matched these details. Call them to find out which phone or email their account uses,
                        and ask them to use the form again with it — or cancel this request.
                      </p>
                    )}
                    {artistOrSupplier && (
                      <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                        <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                        This is a{row.account_role === 'artist' ? 'n artist' : ' supplier'} account. Settle any money owed first,
                        and remove their identity documents in Verification.
                      </p>
                    )}
                    {!row.verified && row.user_id && (
                      <label className="flex items-start gap-2 text-xs text-gray-800">
                        <input
                          type="checkbox"
                          checked={!!confirmed[row.id]}
                          onChange={(event) => setConfirmed((c) => ({ ...c, [row.id]: event.target.checked }))}
                          className="mt-0.5 h-4 w-4 accent-maroon-800"
                        />
                        I called them and confirmed it is really their account.
                      </label>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void act(row, 'complete')}
                        disabled={!!busyId || !row.user_id || (!row.verified && !confirmed[row.id])}
                        className="px-4 py-2.5 rounded-xl bg-rose-700 text-white text-xs font-black uppercase tracking-wider disabled:opacity-40 flex items-center gap-1.5"
                      >
                        {busyId === row.id ? <Loader2 size={13} className="animate-spin" /> : <UserX size={13} />}
                        Delete account
                      </button>
                      <button
                        onClick={() => void act(row, 'cancel')}
                        disabled={!!busyId}
                        className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider disabled:opacity-40"
                      >
                        Cancel request
                      </button>
                    </div>
                  </div>
                )}

                {row.status !== 'pending' && row.handled_at && (
                  <p className="mt-3 text-xs text-gray-500">
                    {row.status === 'completed' ? 'Deleted' : 'Cancelled'} {dateTime(row.handled_at)}
                    {row.handled_note && ` — ${row.handled_note}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
