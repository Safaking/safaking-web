'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MessageSquareWarning, Loader2, AlertCircle, ArrowUpCircle, CheckCircle2,
  Send, Lock, User, Crown, Shield, Search, Printer,
} from 'lucide-react';
import {
  supabase, DBComplaint, DBComplaintMessage, ComplaintStatus, UserRole,
} from '@/lib/supabase';
import {
  listComplaints, listComplaintMessages, postComplaintMessage, updateComplaint,
  COMPLAINT_STATUS_LABEL, COMPLAINT_STATUS_TONE, OPEN_STATUSES,
} from '@/lib/complaints';

const AUTHOR_ICON: Record<string, typeof User> = {
  customer: User, artist: Crown, manager: Shield, admin: Shield, system: AlertCircle,
};

const AUTHOR_TONE: Record<string, string> = {
  customer: 'bg-royal-50 border-royal-200',
  artist: 'bg-amber-50 border-amber-200',
  manager: 'bg-white border-gray-200',
  admin: 'bg-maroon-50 border-maroon-200',
  system: 'bg-gray-50 border-gray-200',
};

/**
 * Complaints as a conversation the whole chain can see.
 *
 * A manager works the thread; if they cannot settle it they escalate, and
 * from that point only an admin can close it (the database enforces that,
 * not just this screen). Internal notes are staff-only — the customer and the
 * artist never see them, which is what makes it safe to think out loud here.
 */
export function ComplaintsPanel({ role, userId, userName }: {
  role: UserRole; userId: string; userName: string;
}) {
  const isAdmin = role === 'admin';

  const [rows, setRows] = useState<DBComplaint[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DBComplaintMessage[]>([]);
  const [artistNames, setArtistNames] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [filter, setFilter] = useState<'open' | 'all' | ComplaintStatus>('open');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listComplaints();
      setRows(list);

      const ids = [...new Set(list.map((c) => c.artist_id).filter(Boolean))] as string[];
      if (ids.length > 0) {
        const { data } = await supabase.from('artist_profiles').select('id, display_name').in('id', ids);
        setArtistNames(Object.fromEntries((data ?? []).map((a) => [a.id, a.display_name])));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load complaints.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openThread = async (complaint: DBComplaint) => {
    setOpenId(complaint.id);
    setMessages([]);
    setReply('');
    setInternal(false);
    try {
      setMessages(await listComplaintMessages(complaint.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the conversation.');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((c) =>
        filter === 'all' ? true
        : filter === 'open' ? OPEN_STATUSES.includes(c.status)
        : c.status === filter
      )
      .filter((c) =>
        !q || c.subject.toLowerCase().includes(q) || c.customer_name.toLowerCase().includes(q) ||
        (c.artist_id ? (artistNames[c.artist_id] ?? '').toLowerCase().includes(q) : false)
      );
  }, [rows, filter, search, artistNames]);

  const active = rows.find((c) => c.id === openId) ?? null;

  const send = async () => {
    if (!active || !reply.trim()) return;
    setBusy(true);
    try {
      const msg = await postComplaintMessage({
        complaintId: active.id,
        authorId: userId,
        authorRole: role,
        authorName: userName,
        body: reply,
        internal,
      });
      setMessages((prev) => [...prev, msg]);
      setReply('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post your reply.');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: ComplaintStatus, extra: Partial<DBComplaint> = {}) => {
    if (!active) return;
    setBusy(true);
    try {
      await updateComplaint(active.id, { status, ...extra });
      setRows((prev) => prev.map((c) => (c.id === active.id ? { ...c, status, ...extra } : c)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this complaint.');
    } finally {
      setBusy(false);
    }
  };

  const escalate = async () => {
    const note = window.prompt('What could you not settle? The admin sees this note.');
    if (note === null) return;
    await setStatus('escalated', {
      escalated_at: new Date().toISOString(),
      escalated_by: userId,
      escalation_note: note.trim() || null,
    });
    await postComplaintMessage({
      complaintId: active!.id, authorId: userId, authorRole: role, authorName: userName,
      body: `Escalated to admin. ${note.trim()}`, internal: true,
    }).catch(() => {});
    openThread(active!);
  };

  const resolve = async () => {
    const note = window.prompt('How was it settled? This is recorded against the artist.');
    if (note === null) return;
    await setStatus('resolved', {
      resolution: note.trim() || null,
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    });
  };

  const openCount = rows.filter((c) => OPEN_STATUSES.includes(c.status)).length;
  const escalatedCount = rows.filter((c) => c.status === 'escalated').length;

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-amber-200/70 p-12 text-center">
        <Loader2 size={24} className="animate-spin mx-auto mb-2 text-amber-500" />
        <p className="text-xs font-bold text-gray-600">Loading complaints…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-amber-200/70 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Open</p>
          <p className="font-display font-black text-2xl text-maroon-950">{openCount}</p>
        </div>
        <div className="rounded-2xl border border-maroon-200 bg-maroon-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-maroon-800/70">Escalated to admin</p>
          <p className="font-display font-black text-2xl text-maroon-900">{escalatedCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800/70">Resolved</p>
          <p className="font-display font-black text-2xl text-emerald-800">
            {rows.filter((c) => c.status === 'resolved').length}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['open', 'escalated', 'resolved', 'all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors ${
              filter === f ? 'bg-maroon-950 text-royal-300' : 'bg-white border border-amber-200/70 text-maroon-900 hover:bg-amber-50'
            }`}>
            {f}
          </button>
        ))}
        <span className="relative flex-1 min-w-[12rem]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Customer, artist or subject…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-amber-200/70 text-xs font-medium text-maroon-950" />
        </span>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,22rem)_1fr] gap-4">
        {/* List */}
        <div className="space-y-2 max-h-[38rem] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500 bg-white rounded-2xl border border-amber-200/70">
              No complaints here.
            </p>
          ) : filtered.map((c) => (
            <button key={c.id} onClick={() => openThread(c)}
              className={`w-full text-left p-4 rounded-2xl border transition-all ${
                openId === c.id ? 'bg-maroon-950 border-maroon-950' : 'bg-white border-amber-200/70 hover:border-royal-300'
              }`}>
              <div className="flex items-start justify-between gap-2">
                <p className={`font-bold text-[13px] leading-tight ${openId === c.id ? 'text-royal-100' : 'text-maroon-950'}`}>
                  {c.subject}
                </p>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${COMPLAINT_STATUS_TONE[c.status]}`}>
                  {COMPLAINT_STATUS_LABEL[c.status]}
                </span>
              </div>
              <p className={`text-[11px] mt-1 ${openId === c.id ? 'text-royal-200/70' : 'text-gray-500'}`}>
                {c.customer_name}
                {c.artist_id ? ` · about ${artistNames[c.artist_id] ?? 'artist'}` : ''}
                {c.created_at ? ` · ${c.created_at.slice(0, 10)}` : ''}
              </p>
              {c.severity === 'high' && (
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[9px] font-black uppercase">
                  High severity
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Thread */}
        <div id="report-print-area" className="bg-white rounded-3xl border border-amber-200/70 shadow-sm overflow-hidden">
          {!active ? (
            <div className="p-16 text-center">
              <MessageSquareWarning size={30} className="mx-auto mb-3 text-amber-400" />
              <p className="text-sm font-bold text-gray-500">Pick a complaint to see the whole conversation.</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-5 bg-gradient-to-r from-maroon-950 to-maroon-900">
                <p className="font-display font-black text-lg text-royal-100">{active.subject}</p>
                <p className="text-[11px] text-royal-200/70 mt-1">
                  {active.customer_name}{active.customer_phone ? ` · ${active.customer_phone}` : ''}
                  {active.artist_id ? ` · Artist: ${artistNames[active.artist_id] ?? '—'}` : ''}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-4 rounded-2xl bg-royal-50 border border-royal-200">
                  <p className="text-[10px] font-black uppercase tracking-wider text-royal-800 mb-1">
                    What the customer said
                  </p>
                  <p className="text-[13px] text-maroon-950 leading-relaxed">{active.description}</p>
                </div>

                {active.escalation_note && (
                  <div className="p-3.5 rounded-2xl bg-maroon-50 border border-maroon-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-maroon-800 mb-1">
                      Escalated to admin
                    </p>
                    <p className="text-[12px] text-maroon-900">{active.escalation_note}</p>
                  </div>
                )}

                {active.resolution && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800 mb-1">Resolution</p>
                    <p className="text-[12px] text-emerald-900">{active.resolution}</p>
                  </div>
                )}

                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">
                      No replies yet. Ask the artist for their side, or answer the customer below.
                    </p>
                  ) : messages.map((m) => {
                    const Icon = AUTHOR_ICON[m.author_role] ?? User;
                    return (
                      <div key={m.id} className={`p-3.5 rounded-2xl border ${AUTHOR_TONE[m.author_role] ?? AUTHOR_TONE.system}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={13} className="text-maroon-800" />
                          <p className="text-[10px] font-black uppercase tracking-wider text-maroon-900/70">
                            {m.author_name || m.author_role}
                            <span className="font-bold text-gray-400"> · {m.author_role}</span>
                          </p>
                          {m.internal && (
                            <span className="px-2 py-0.5 rounded-full bg-gray-800 text-white text-[9px] font-black uppercase flex items-center gap-1">
                              <Lock size={9} /> Internal
                            </span>
                          )}
                          <span className="ml-auto text-[10px] text-gray-400">
                            {m.created_at?.slice(0, 16).replace('T', ' ')}
                          </span>
                        </div>
                        <p className="text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap">{m.body}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Reply */}
                {!['resolved', 'dismissed'].includes(active.status) && (
                  <div className="space-y-2 no-print">
                    <textarea
                      rows={3} value={reply} onChange={(e) => setReply(e.target.value)}
                      placeholder={internal ? 'Internal note — the customer and artist never see this…' : 'Reply to the customer and artist…'}
                      className="w-full px-4 py-3 rounded-2xl border border-amber-200/70 text-[13px] resize-none outline-none focus:ring-2 focus:ring-maroon-800/15"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-maroon-900" />
                        <span className="text-[11px] font-bold text-gray-600">Internal note</span>
                      </label>
                      <button onClick={send} disabled={busy || !reply.trim()}
                        className="px-4 py-2 rounded-xl bg-maroon-950 hover:bg-maroon-900 disabled:opacity-50 text-royal-300 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Post
                      </button>

                      <div className="flex flex-wrap items-center gap-2 ml-auto">
                        <button onClick={() => setStatus('awaiting_artist')} disabled={busy}
                          className="px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold">
                          Ask artist to answer
                        </button>
                        <button onClick={() => setStatus('awaiting_customer')} disabled={busy}
                          className="px-3 py-2 rounded-xl bg-royal-100 hover:bg-royal-200 text-royal-800 text-[11px] font-bold">
                          Waiting on customer
                        </button>
                        {active.status !== 'escalated' && !isAdmin && (
                          <button onClick={escalate} disabled={busy}
                            className="px-3 py-2 rounded-xl bg-maroon-100 hover:bg-maroon-200 text-maroon-900 text-[11px] font-bold flex items-center gap-1.5">
                            <ArrowUpCircle size={13} /> Escalate to admin
                          </button>
                        )}
                        {(isAdmin || active.status !== 'escalated') && (
                          <button onClick={resolve} disabled={busy}
                            className="px-3 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[11px] font-bold flex items-center gap-1.5">
                            <CheckCircle2 size={13} /> Mark resolved
                          </button>
                        )}
                        <button onClick={() => window.print()}
                          className="px-3 py-2 rounded-xl bg-white border border-amber-200/70 text-maroon-900 text-[11px] font-bold flex items-center gap-1.5">
                          <Printer size={13} /> Print
                        </button>
                      </div>
                    </div>

                    {active.status === 'escalated' && !isAdmin && (
                      <p className="text-[11px] text-maroon-800 bg-maroon-50 border border-maroon-200 rounded-xl p-3">
                        This is with the admin now. You can still reply and add notes, but only an
                        admin can close it.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
