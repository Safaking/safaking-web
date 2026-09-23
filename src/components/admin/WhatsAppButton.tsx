'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Check } from 'lucide-react';
import { WhatsAppDraft, getWhatsAppClickLink } from '@/lib/whatsapp';

/**
 * Opens WhatsApp with a message already typed for this customer or artist.
 *
 * Nothing is sent automatically — the staff member reads it and presses send
 * in WhatsApp. That is what keeps this free: no DLT registration, no WhatsApp
 * Business API, and no message ever goes out without a person behind it.
 */
export function WhatsAppButton({
  phone,
  drafts,
  label = 'WhatsApp',
}: {
  phone: string | null | undefined;
  drafts: WhatsAppDraft[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [sentLabel, setSentLabel] = useState<string | null>(null);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  // Indian numbers are stored with and without the country code.
  const withCountry = digits.length === 10 ? `91${digits}` : digits;

  const send = (draft: WhatsAppDraft) => {
    window.open(getWhatsAppClickLink(withCountry, draft.text), '_blank', 'noopener');
    setSentLabel(draft.label);
    setOpen(false);
    setTimeout(() => setSentLabel(null), 4000);
  };

  return (
    <div className="relative inline-block" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-[10px] font-bold text-green-800 hover:bg-green-100"
        title="Open WhatsApp with a ready message"
      >
        {sentLabel ? <Check size={11} /> : <MessageCircle size={11} />}
        {sentLabel ? 'Opened' : label}
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-60 rounded-xl border border-amber-200 bg-white p-1.5 shadow-xl">
          <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-400">
            Opens WhatsApp — you press send
          </p>
          {drafts.map((draft) => (
            <button
              key={draft.label}
              type="button"
              onClick={() => send(draft)}
              className="block w-full rounded-lg px-2 py-2 text-left text-[11px] font-medium text-maroon-900 hover:bg-amber-50"
            >
              {draft.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
