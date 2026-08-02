'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck, CheckCircle2, XCircle, Eye, Loader2, AlertCircle, ExternalLink,
} from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { VerificationDocument, signedUrlFor } from '@/lib/verification';

interface QueueRow extends VerificationDocument {
  owner_name?: string | null;
  owner_phone?: string | null;
}

const DOC_LABELS: Record<string, string> = {
  aadhaar_front: 'Aadhaar (front)',
  aadhaar_back: 'Aadhaar (back)',
  selfie: 'Selfie',
  certificate: 'Certificate',
  experience_proof: 'Experience proof',
  gst_certificate: 'GST certificate',
  shop_photo: 'Shop photo',
  bank_proof: 'Bank proof',
  pan: 'PAN card',
};

/**
 * Admin review queue for identity documents.
 *
 * Documents live in a private bucket, so each "View" mints a short-lived signed
 * URL rather than exposing a permanent link.
 */
export function VerificationQueue() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('verification_documents')
      .select('*, profiles!verification_documents_owner_id_fkey(full_name, phone)')
      .order('created_at', { ascending: true });

    if (filter === 'pending') query = query.eq('status', 'pending');

    const { data, error: loadErr } = await query;

    if (loadErr) {
      setError(friendlyError(loadErr));
      setRows([]);
    } else {
      setRows(
        ((data ?? []) as (VerificationDocument & {
          profiles?: { full_name?: string; phone?: string } | null;
        })[]).map((row) => ({
          ...row,
          owner_name: row.profiles?.full_name ?? null,
          owner_phone: row.profiles?.phone ?? null,
        }))
      );
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const view = async (path: string) => {
    const url = await signedUrlFor(path, 300);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else setError('Could not open that document. It may have been removed from storage.');
  };

  const review = async (id: string, status: 'approved' | 'rejected') => {
    let reason: string | null = null;

    if (status === 'rejected') {
      reason = window.prompt('Why is this document being rejected? The applicant will see this.');
      // A blank reason is worse than no rejection — the applicant cannot act on it.
      if (reason === null || !reason.trim()) return;
    }

    setBusyId(id);
    setError(null);

    const { error: updateErr } = await supabase
      .from('verification_documents')
      .update({ status, rejection_reason: reason?.trim() ?? null })
      .eq('id', id);

    if (updateErr) setError(friendlyError(updateErr));
    else await load(); // The DB trigger recomputes the owner's overall status.

    setBusyId(null);
  };

  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  return (
    <div className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
          <ShieldCheck size={18} className="text-amber-600" />
          Verification Queue
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-medium">{pendingCount} awaiting review</span>
          <div className="flex bg-amber-50 p-1 rounded-xl border border-amber-200/70">
            {(['pending', 'all'] as const).map((option) => (
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
          <p className="text-sm font-bold text-gray-600">Loading documents…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="p-12 text-center">
          <CheckCircle2 size={30} className="text-emerald-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-600">
            {filter === 'pending' ? 'Nothing awaiting review.' : 'No documents submitted yet.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-amber-50/50 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-amber-100">
              <tr>
                <th className="p-4">Applicant</th>
                <th className="p-4">Document</th>
                <th className="p-4">Recorded</th>
                <th className="p-4">Status</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100 text-xs">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-amber-50/30 transition-colors">
                  <td className="p-4 font-bold text-maroon-950">
                    {row.owner_name || '—'}
                    <span className="block text-[10px] text-gray-400 font-normal">
                      {row.owner_phone || row.owner_id.slice(0, 8)}
                    </span>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-royal-100 text-royal-800 text-[9px] font-black uppercase">
                      {row.subject_type}
                    </span>
                  </td>
                  <td className="p-4 text-gray-700">
                    {DOC_LABELS[row.doc_type] ?? row.doc_type}
                    <span className="block text-[10px] text-gray-400">{row.original_name}</span>
                  </td>
                  <td className="p-4 text-gray-600 font-mono text-[11px]">
                    {row.reference_last4 ? `•••• ${row.reference_last4}` : '—'}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        row.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : row.status === 'rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {row.status}
                    </span>
                    {row.rejection_reason && (
                      <span className="block text-[10px] text-rose-600 mt-1 max-w-[12rem]">
                        {row.rejection_reason}
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => view(row.storage_path)}
                        className="p-2 rounded-lg bg-royal-100 text-royal-800 hover:bg-royal-200 transition-colors"
                        title="Open document (link expires in 5 minutes)"
                      >
                        <Eye size={13} />
                      </button>
                      {row.status !== 'approved' && (
                        <button
                          onClick={() => review(row.id, 'approved')}
                          disabled={busyId === row.id}
                          className="p-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors disabled:opacity-50"
                          title="Approve"
                        >
                          {busyId === row.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={13} />
                          )}
                        </button>
                      )}
                      {row.status !== 'rejected' && (
                        <button
                          onClick={() => review(row.id, 'rejected')}
                          disabled={busyId === row.id}
                          className="p-2 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors disabled:opacity-50"
                          title="Reject"
                        >
                          <XCircle size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="p-6 pt-0 text-[10px] text-gray-400 leading-relaxed flex items-start gap-1.5">
        <ExternalLink size={11} className="shrink-0 mt-0.5" />
        Document links are signed and expire after 5 minutes. Approving the last required document
        marks the applicant verified automatically.
      </p>
    </div>
  );
}
