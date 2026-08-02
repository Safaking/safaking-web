'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, Loader2, AlertCircle, CheckCircle2, Phone } from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { getWhatsAppClickLink } from '@/lib/whatsapp';

interface ContactMessage {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  subject: string | null;
  message: string;
  status: 'new' | 'read' | 'replied' | 'closed';
  admin_note: string | null;
  created_at: string;
}

const STATUSES = ['new', 'read', 'replied', 'closed'] as const;

export function ContactInbox() {
  const [rows, setRows] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  const load = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter === 'open') query = query.in('status', ['new', 'read']);

    const { data, error: loadErr } = await query;

    if (loadErr) {
      setError(friendlyError(loadErr));
      setRows([]);
    } else {
      setRows((data as ContactMessage[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: ContactMessage['status']) => {
    setBusy(id);
    const { error: updateErr } = await supabase
      .from('contact_messages')
      .update({ status })
      .eq('id', id);

    if (updateErr) setError(friendlyError(updateErr));
    else await load();
    setBusy(null);
  };

  const newCount = rows.filter((r) => r.status === 'new').length;

  return (
    <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
            <Mail size={18} className="text-amber-600" /> Contact Messages
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {newCount} unread from the Contact Us page.
          </p>
        </div>
        <div className="flex bg-amber-50 p-1 rounded-xl border border-amber-200/70">
          {(['open', 'all'] as const).map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                filter === option ? 'bg-maroon-950 text-royal-300 shadow-sm' : 'text-gray-500'
              }`}
            >
              {option}
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
          <p className="text-sm font-bold text-gray-600">Loading inbox…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="p-12 text-center">
          <CheckCircle2 size={30} className="text-emerald-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-600">
            {filter === 'open' ? 'Inbox clear.' : 'No messages yet.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-amber-100">
          {rows.map((row) => (
            <div
              key={row.id}
              className={`p-6 ${row.status === 'new' ? 'bg-amber-50/40' : ''}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-maroon-950 flex items-center gap-2">
                    {row.full_name}
                    {row.status === 'new' && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[9px] font-black uppercase">
                        New
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {row.subject ?? 'General'} ·{' '}
                    {new Date(row.created_at).toLocaleString('en-IN', {
                      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                  <p className="text-xs text-gray-700 leading-relaxed mt-2 max-w-2xl whitespace-pre-line">
                    {row.message}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-2">
                    {row.phone}
                    {row.email ? ` · ${row.email}` : ''}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <a
                    href={getWhatsAppClickLink(
                      row.phone,
                      `Namaste ${row.full_name}, this is SafaKing replying to your enquiry.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wider"
                  >
                    <Phone size={12} /> Reply
                  </a>

                  <select
                    value={row.status}
                    onChange={(e) => setStatus(row.id, e.target.value as ContactMessage['status'])}
                    disabled={busy === row.id}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white font-bold text-[11px] capitalize disabled:opacity-50"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
