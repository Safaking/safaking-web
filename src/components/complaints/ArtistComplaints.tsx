'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquareWarning, Loader2, Send, AlertCircle } from 'lucide-react';
import { supabase, DBComplaint, DBComplaintMessage } from '@/lib/supabase';
import {
  listComplaintMessages, postComplaintMessage,
  COMPLAINT_STATUS_LABEL, COMPLAINT_STATUS_TONE,
} from '@/lib/complaints';

/**
 * Complaints raised about this artist, and their right to answer.
 *
 * A complaint that only the office can see is a rumour; showing it here, with
 * a reply box, is what makes it fair — and the answer lands in the same
 * thread the admin and manager are reading.
 */
export function ArtistComplaints({ artistId, artistName }: { artistId: string; artistName: string }) {
  const [rows, setRows] = useState<DBComplaint[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DBComplaintMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('complaints')
      .select('*')
      .eq('artist_id', artistId)
      .order('created_at', { ascending: false });

    if (err) setError(err.message);
    setRows((data as DBComplaint[]) ?? []);
    setLoading(false);
  }, [artistId]);

  useEffect(() => { load(); }, [load]);

  const open = async (id: string) => {
    setOpenId(id === openId ? null : id);
    setReply('');
    if (id !== openId) {
      try {
        setMessages(await listComplaintMessages(id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load the conversation.');
      }
    }
  };

  const send = async (complaintId: string) => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      const msg = await postComplaintMessage({
        complaintId, authorId: artistId, authorRole: 'artist',
        authorName: artistName, body: reply,
      });
      setMessages((prev) => [...prev, msg]);
      setReply('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your reply.');
    } finally {
      setBusy(false);
    }
  };

  if (loading || rows.length === 0) return null;

  return (
    <section className="bg-white rounded-3xl border-2 border-rose-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-rose-100 bg-rose-50/60">
        <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
          <MessageSquareWarning size={18} className="text-rose-600" />
          Complaints about your work ({rows.length})
        </h3>
        <p className="text-xs text-gray-600 mt-0.5">
          Answer honestly — your reply goes straight to the SafaKing team, and an unanswered
          complaint counts against you.
        </p>
      </div>

      <div className="p-6 space-y-3">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        {rows.map((c) => (
          <div key={c.id} className="rounded-2xl border border-gray-200 overflow-hidden">
            <button onClick={() => open(c.id)} className="w-full text-left p-4 hover:bg-amber-50/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-sm text-maroon-950">{c.subject}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {c.created_at?.slice(0, 10)} · from {c.customer_name}
                  </p>
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${COMPLAINT_STATUS_TONE[c.status]}`}>
                  {COMPLAINT_STATUS_LABEL[c.status]}
                </span>
              </div>
            </button>

            {openId === c.id && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                <p className="text-[13px] text-gray-800 leading-relaxed bg-gray-50 rounded-xl p-3">
                  {c.description}
                </p>

                {messages.map((m) => (
                  <div key={m.id} className={`p-3 rounded-xl border text-[12.5px] ${
                    m.author_role === 'artist' ? 'bg-amber-50 border-amber-200' : 'bg-royal-50 border-royal-200'
                  }`}>
                    <p className="text-[10px] font-black uppercase tracking-wider text-maroon-900/60 mb-1">
                      {m.author_role === 'artist' ? 'You' : m.author_name || m.author_role}
                    </p>
                    <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                  </div>
                ))}

                {!['resolved', 'dismissed'].includes(c.status) && (
                  <div className="space-y-2">
                    <textarea
                      rows={3} value={reply} onChange={(e) => setReply(e.target.value)}
                      placeholder="Your side of what happened…"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[13px] resize-none outline-none focus:ring-2 focus:ring-maroon-800/15"
                    />
                    <button onClick={() => send(c.id)} disabled={busy || !reply.trim()}
                      className="px-4 py-2 rounded-xl bg-maroon-950 hover:bg-maroon-900 disabled:opacity-50 text-royal-300 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send reply
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
