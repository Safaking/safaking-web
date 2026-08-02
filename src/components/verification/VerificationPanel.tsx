'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Upload, CheckCircle2, Clock, XCircle, AlertCircle, Loader2, FileText,
} from 'lucide-react';
import {
  ARTIST_DOCS, SUPPLIER_DOCS, DocSpec, DocType, SubjectType,
  VerificationDocument, listMyDocuments, uploadDocument, looksLikeAadhaar,
} from '@/lib/verification';

interface VerificationPanelProps {
  ownerId: string;
  subjectType: SubjectType;
}

function StateChip({ status }: { status: VerificationDocument['status'] | 'missing' }) {
  const config = {
    approved: { icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-800', label: 'Approved' },
    pending: { icon: Clock, cls: 'bg-amber-100 text-amber-800', label: 'Under review' },
    rejected: { icon: XCircle, cls: 'bg-rose-100 text-rose-800', label: 'Rejected' },
    missing: { icon: Upload, cls: 'bg-gray-100 text-gray-600', label: 'Not uploaded' },
  }[status];

  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${config.cls}`}
    >
      <Icon size={11} /> {config.label}
    </span>
  );
}

function DocRow({
  spec, doc, ownerId, subjectType, onUploaded,
}: {
  spec: DocSpec;
  doc?: VerificationDocument;
  ownerId: string;
  subjectType: SubjectType;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);

    if (spec.wantsReference) {
      if (!reference.trim()) {
        setError('Enter the number shown on the document first.');
        return;
      }
      if (spec.type === 'aadhaar_front' && !looksLikeAadhaar(reference)) {
        setError('An Aadhaar number is 12 digits.');
        return;
      }
    }

    setBusy(true);
    try {
      await uploadDocument({
        ownerId,
        subjectType,
        docType: spec.type,
        file,
        referenceNumber: spec.wantsReference ? reference : undefined,
      });
      setReference('');
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="p-4 rounded-2xl border border-amber-200/70 bg-amber-50/30 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-sm text-maroon-950 flex items-center gap-1.5">
            <FileText size={14} className="text-amber-600 shrink-0" />
            {spec.label}
            {spec.required && <span className="text-rose-600 text-xs">*</span>}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{spec.hint}</p>
        </div>
        <StateChip status={doc?.status ?? 'missing'} />
      </div>

      {doc?.status === 'rejected' && doc.rejection_reason && (
        <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5">
          <strong>Rejected:</strong> {doc.rejection_reason}
        </p>
      )}

      {doc?.reference_last4 && (
        <p className="text-[11px] text-gray-500">
          Recorded: •••• •••• {doc.reference_last4}
        </p>
      )}

      {doc?.status !== 'approved' && (
        <>
          {spec.wantsReference && (
            <input
              type="text"
              inputMode="numeric"
              placeholder={
                spec.type === 'aadhaar_front' ? 'Aadhaar number (12 digits)' : 'Account number'
              }
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-maroon-800/20 outline-none"
            />
          )}

          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => handleFile(e.target.files?.[0])}
              disabled={busy}
              className="block w-full text-[11px] text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[11px] file:font-bold file:bg-maroon-950 file:text-royal-300 hover:file:bg-maroon-900 file:cursor-pointer disabled:opacity-50"
            />
            {busy && <Loader2 size={16} className="animate-spin text-amber-600 shrink-0" />}
          </div>
        </>
      )}

      {error && (
        <p className="text-[11px] text-rose-700 flex items-start gap-1.5">
          <AlertCircle size={12} className="shrink-0 mt-0.5" /> {error}
        </p>
      )}
    </div>
  );
}

export function VerificationPanel({ ownerId, subjectType }: VerificationPanelProps) {
  const specs = subjectType === 'artist' ? ARTIST_DOCS : SUPPLIER_DOCS;

  const [docs, setDocs] = useState<VerificationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDocs(await listMyDocuments(ownerId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your documents.');
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    load();
  }, [load]);

  const byType = new Map<DocType, VerificationDocument>();
  for (const doc of docs) if (!byType.has(doc.doc_type)) byType.set(doc.doc_type, doc);

  const required = specs.filter((s) => s.required);
  const approvedRequired = required.filter((s) => byType.get(s.type)?.status === 'approved').length;
  const allApproved = approvedRequired === required.length;

  return (
    <section className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-lg text-maroon-950 flex items-center gap-2">
            <ShieldCheck size={18} className={allApproved ? 'text-emerald-600' : 'text-amber-600'} />
            Verification
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {allApproved
              ? 'You are verified. Customers can see your badge.'
              : `${approvedRequired} of ${required.length} required documents approved.`}
          </p>
        </div>
        {allApproved && (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider"
          >
            <CheckCircle2 size={13} /> Verified
          </motion.span>
        )}
      </div>

      <div className="p-6">
        {error && (
          <div className="flex items-start gap-2 p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-gray-500">
            <Loader2 size={22} className="animate-spin mx-auto mb-2 text-amber-500" />
            <p className="text-xs font-bold">Loading your documents…</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {specs.map((spec) => (
              <DocRow
                key={spec.type}
                spec={spec}
                doc={byType.get(spec.type)}
                ownerId={ownerId}
                subjectType={subjectType}
                onUploaded={load}
              />
            ))}
          </div>
        )}

        <p className="text-[10px] text-gray-400 leading-relaxed mt-4">
          Your documents are stored privately and can only be opened by you and a SafaKing
          administrator. We keep only the last 4 digits of any Aadhaar or account number — never the
          full number.
        </p>
      </div>
    </section>
  );
}
