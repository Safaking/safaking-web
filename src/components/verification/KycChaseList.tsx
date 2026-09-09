'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, MessageCircle, Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getWhatsAppClickLink } from '@/lib/whatsapp';

interface Waiting {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  status: string;
  missing: string[];
  uploaded: number;
  awaitingReview: number;
}

/** What an artist must have approved before any booking can reach them. */
const REQUIRED: Record<string, string> = {
  aadhaar_front: 'Aadhaar (front)',
  selfie: 'Selfie',
};

const PORTAL = 'https://www.safaking.in/artist-portal/login';

const invite = (name: string) =>
  `नमस्ते ${name} जी! SafaKing में आपका आवेदन स्वीकार हो गया है 🎉\n\n` +
  `बुकिंग मिलना शुरू करने के लिए एक आख़िरी कदम बाकी है — अपने दस्तावेज़ अपलोड कीजिए:\n\n` +
  `1) इस लिंक पर लॉगिन कीजिए: ${PORTAL}\n` +
  `2) नीचे "Verification & Documents" वाले हिस्से में जाइए\n` +
  `3) आधार कार्ड (सामने का हिस्सा) और अपनी सेल्फ़ी अपलोड कीजिए\n\n` +
  `बस इतना ही — कोई सर्टिफिकेट ज़रूरी नहीं है। हमारी मंज़ूरी मिलते ही आपको बुकिंग मिलनी शुरू हो जाएँगी।`;

/**
 * Who is still holding up their own KYC, and one tap to chase them.
 *
 * The review queue below only lists documents that already exist, so with
 * nothing uploaded it is an empty screen: no sign of who is missing, or that
 * every booking is blocked until one of them acts. This is the other half.
 */
export function KycChaseList() {
  const [rows, setRows] = useState<Waiting[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const [profiles, people, docs] = await Promise.all([
      supabase
        .from('artist_profiles')
        .select('id, display_name, base_city, verification_status, active, blacklisted'),
      supabase.from('profiles').select('id, full_name, phone'),
      supabase.from('verification_documents').select('owner_id, doc_type, status'),
    ]);

    const phoneOf = new Map((people.data ?? []).map((p) => [p.id, p.phone as string | null]));

    const list: Waiting[] = (profiles.data ?? [])
      .filter((a) => a.active && !a.blacklisted && a.verification_status !== 'verified')
      .map((a) => {
        const mine = (docs.data ?? []).filter((d) => d.owner_id === a.id);
        const approved = new Set(mine.filter((d) => d.status === 'approved').map((d) => d.doc_type));
        return {
          id: a.id,
          name: a.display_name,
          phone: phoneOf.get(a.id) ?? null,
          city: a.base_city,
          status: a.verification_status ?? 'unverified',
          missing: Object.keys(REQUIRED).filter((t) => !approved.has(t)),
          uploaded: mine.length,
          awaitingReview: mine.filter((d) => d.status === 'pending').length,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    setRows(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const copy = async (row: Waiting) => {
    await navigator.clipboard.writeText(invite(row.name));
    setCopied(row.id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-amber-200/70 p-10 text-center">
        <Loader2 size={22} className="animate-spin mx-auto mb-2 text-amber-500" />
        <p className="text-xs font-bold text-gray-600">Checking who still needs KYC…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-emerald-50 rounded-3xl border border-emerald-200 p-6 flex items-start gap-3">
        <ShieldCheckIcon />
        <div>
          <p className="font-display font-black text-base text-emerald-900">Every active artist is verified</p>
          <p className="text-xs text-emerald-800/80 mt-0.5">
            Bookings can be assigned to anyone on the roster.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border-2 border-amber-300 shadow-sm overflow-hidden">
      <div className="px-6 py-5 bg-amber-50/70 border-b border-amber-200 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldAlert size={20} className="text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-display font-black text-lg text-maroon-950">
              {rows.length} artist{rows.length === 1 ? '' : 's'} cannot be given work yet
            </h3>
            <p className="text-xs text-gray-600 mt-0.5 max-w-xl leading-relaxed">
              KYC is a hard gate — until an artist&apos;s Aadhaar and selfie are approved, no booking
              can be assigned to them. Send the upload link, then approve what arrives in the queue
              below.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="px-3 py-2 rounded-xl bg-white border border-amber-200/70 hover:bg-amber-50 text-[11px] font-bold text-maroon-900 flex items-center gap-1.5"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="p-6 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-sm text-maroon-950">
                  {row.name}
                  {row.city ? <span className="font-normal text-gray-500"> · {row.city}</span> : null}
                </p>
                <p className="text-[11px] text-gray-600 mt-1">
                  {row.uploaded === 0 ? (
                    <span className="text-rose-700 font-bold">Nothing uploaded yet</span>
                  ) : row.awaitingReview > 0 ? (
                    <span className="text-amber-800 font-bold">
                      {row.awaitingReview} document{row.awaitingReview === 1 ? '' : 's'} waiting for your review below
                    </span>
                  ) : (
                    <span className="text-rose-700 font-bold">Still missing: {row.missing.map((m) => REQUIRED[m]).join(', ')}</span>
                  )}
                  {row.phone ? <span className="text-gray-400"> · {row.phone}</span> : null}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => copy(row)}
                  title="Copy the message, to paste anywhere"
                  className="px-3 py-2 rounded-xl bg-white border border-amber-200/70 hover:bg-amber-50 text-[11px] font-bold text-maroon-900 flex items-center gap-1.5"
                >
                  {copied === row.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  {copied === row.id ? 'Copied' : 'Copy message'}
                </button>
                {row.phone ? (
                  <a
                    href={getWhatsAppClickLink(row.phone, invite(row.name))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1.5"
                  >
                    <MessageCircle size={13} /> WhatsApp the link
                  </a>
                ) : (
                  <span className="text-[11px] font-bold text-gray-400">No phone on record</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShieldCheckIcon() {
  return <ShieldAlert size={20} className="text-emerald-700 shrink-0 mt-0.5" />;
}
