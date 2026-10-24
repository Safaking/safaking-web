'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Loader2, Phone } from 'lucide-react';
import { BUSINESS, telHref } from '@/lib/business';
import { useTermsLanguage } from '@/lib/terms-language';

/**
 * The shop assistant, in the corner of every page.
 *
 * It answers out of SafaKing's own live facts (see /api/chat) — prices, the
 * refund ladder, what is in the shop — in whichever language it is asked.
 * It cannot see anyone's account or change a booking, and says so; the phone
 * number is always one tap away underneath.
 *
 * Nothing is kept: close the page and the conversation is gone.
 */

interface Line {
  role: 'user' | 'assistant';
  content: string;
}

const OPENERS = {
  en: [
    'What does it cost to book an artist?',
    'Do you deliver to my city?',
    'Can I rent instead of buying?',
  ],
  hi: ['आर्टिस्ट बुक करने का खर्च कितना है?', 'क्या मेरे शहर में डिलीवरी होगी?', 'क्या किराये पर मिल सकता है?'],
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [language] = useTermsLanguage();
  const hi = language === 'hi';
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lines, open, busy]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    const next = [...lines, { role: 'user' as const, content: text }];
    setLines(next);
    setDraft('');
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json().catch(() => ({}));
      setLines((previous) => [
        ...previous,
        {
          role: 'assistant',
          content:
            data.reply ||
            data.error ||
            (hi ? 'अभी जवाब नहीं मिल पाया। कृपया फ़ोन कीजिए।' : 'I could not answer just now. Please call us.'),
        },
      ]);
    } catch {
      setLines((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: hi
            ? `कनेक्शन नहीं मिला। ${BUSINESS.phone} पर फ़ोन या WhatsApp कीजिए।`
            : `I could not connect. Call or WhatsApp ${BUSINESS.phone}.`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Clear of the phone tab bar, and of the mirror's own controls. */}
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-label={hi ? 'SafaKing से पूछिए' : 'Ask SafaKing'}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-[55] flex h-14 w-14 items-center justify-center rounded-full bg-maroon-950 text-royal-300 shadow-2xl shadow-maroon-950/40 ring-1 ring-royal-400/30 transition-transform hover:scale-105 lg:bottom-6"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {open && (
        <div className="fixed bottom-[calc(9.5rem+env(safe-area-inset-bottom))] right-4 z-[55] flex max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-royal-400/25 bg-maroon-950 shadow-2xl lg:bottom-24">
          <div className="border-b border-royal-400/20 px-5 py-4">
            <p className="font-display text-sm font-black uppercase tracking-widest text-royal-100">
              {hi ? 'SafaKing से पूछिए' : 'Ask SafaKing'}
            </p>
            <p className="mt-0.5 text-[10px] text-royal-200/60">
              {hi ? 'साफे, बुकिंग, किराया, डिलीवरी — कुछ भी पूछिए' : 'Safas, bookings, rent, delivery — ask anything'}
            </p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {lines.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs leading-relaxed text-royal-200/70">
                  {hi
                    ? 'नमस्ते! मैं SafaKing की दुकान से जवाब देता हूँ — दाम, नियम और स्टॉक सब असली।'
                    : 'Namaste. I answer from SafaKing’s own shop — real prices, real rules, real stock.'}
                </p>
                {(hi ? OPENERS.hi : OPENERS.en).map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void ask(question)}
                    className="block w-full rounded-xl border border-royal-400/25 bg-white/5 px-3 py-2 text-left text-[11px] text-royal-100 hover:border-royal-400/50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}

            {lines.map((line, index) => (
              <div
                key={index}
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  line.role === 'user'
                    ? 'ml-auto bg-royal-400 text-maroon-950'
                    : 'bg-white/8 text-royal-100/90'
                }`}
              >
                {line.content}
              </div>
            ))}

            {busy && (
              <p className="flex items-center gap-2 text-[11px] text-royal-200/60">
                <Loader2 size={12} className="animate-spin" />
                {hi ? 'देख रहा हूँ…' : 'Looking it up…'}
              </p>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void ask(draft);
            }}
            className="flex items-center gap-2 border-t border-royal-400/20 px-3 py-3"
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={hi ? 'अपना सवाल लिखिए…' : 'Type your question…'}
              maxLength={600}
              className="flex-1 rounded-xl border border-royal-400/25 bg-white/5 px-3 py-2.5 text-xs text-royal-100 placeholder:text-royal-200/40 outline-none focus:border-royal-400/60"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label={hi ? 'भेजें' : 'Send'}
              className="rounded-xl bg-royal-400 p-2.5 text-maroon-950 disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </form>

          <a
            href={telHref}
            className="flex items-center justify-center gap-1.5 border-t border-royal-400/15 bg-white/5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-royal-200/70"
          >
            <Phone size={11} /> {hi ? 'किसी व्यक्ति से बात कीजिए' : 'Talk to a person'} · {BUSINESS.phone}
          </a>
        </div>
      )}
    </>
  );
}
