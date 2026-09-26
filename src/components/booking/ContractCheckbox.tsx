'use client';

import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { getActiveContract, Contract, ContractAudience } from '@/lib/client-update';
import { useTermsLanguage, TermsLanguage } from '@/lib/terms-language';

/**
 * "बुकिंग के समय कस्टमर के लिए अक्सेप्त करने के लिए कंपनी का अनुबंध बनाना
 *  जिस पर टिक करना होगा" — a required tick-box on the active contract, shown
 * inline in a booking form.
 *
 * In Hindi as well as English, because most customers and artists read the
 * terms more comfortably in Hindi: the sentence beside the tick is always in
 * both, and the terms themselves switch language with one tap whenever a Hindi
 * version has been written (contracts.body_hi, supabase/043). The choice is
 * remembered, so somebody who reads in Hindi gets Hindi on every form after
 * the first.
 *
 * Renders nothing if no contract is configured yet, so a missing admin setup
 * degrades to "no extra step" rather than a broken-looking blank box.
 */

/** What the customer or artist is ticking. Ours, not the contract's — so it is in both languages either way. */
const ACCEPT: Record<ContractAudience, Record<TermsLanguage, string>> = {
  customer: {
    en: 'I have read and accept these booking terms, including the return and payment policy.',
    hi: 'मैंने ये बुकिंग शर्तें पढ़ ली हैं और स्वीकार करता/करती हूँ — जिसमें वापसी और भुगतान की नीति भी शामिल है।',
  },
  groom_safa: {
    en: 'I have read and accept these purchase terms, including the return and refund policy.',
    hi: 'मैंने ये खरीद की शर्तें पढ़ ली हैं और स्वीकार करता/करती हूँ — जिसमें वापसी और रिफंड की नीति भी शामिल है।',
  },
  artist: {
    en: 'I have read and accept this agreement, including arriving on time, wearing a helmet, carrying insurance, and never accepting payment directly from a customer.',
    hi: 'मैंने यह अनुबंध पढ़ लिया है और स्वीकार करता हूँ — समय पर पहुँचना, हेलमेट पहनना, बीमा रखना, और ग्राहक से सीधे भुगतान कभी न लेना।',
  },
};

const THEMES = {
  /** The maroon booking panels on the home page. */
  dark: {
    shell: 'border-royal-400/20 bg-white/5',
    header: 'bg-white/5 border-royal-400/20',
    icon: 'text-royal-300',
    title: 'text-royal-200/70',
    body: 'text-royal-100/70',
    note: 'text-royal-200/50',
    accept: 'border-royal-400/20',
    acceptText: 'text-royal-100/80',
    box: 'accent-royal-400',
    link: 'text-royal-300',
    pickerOn: 'bg-royal-400 text-maroon-950',
    pickerOff: 'text-royal-200/60 hover:text-royal-100',
  },
  /** White cards — /rent and the shop cart. */
  light: {
    shell: 'border-gray-200 bg-gray-50',
    header: 'bg-white border-gray-200',
    icon: 'text-gray-500',
    title: 'text-gray-600',
    body: 'text-gray-600',
    note: 'text-gray-400',
    accept: 'border-gray-200 bg-white',
    acceptText: 'text-gray-700',
    box: 'accent-maroon-900',
    link: 'text-maroon-800',
    pickerOn: 'bg-maroon-900 text-white',
    pickerOff: 'text-gray-500 hover:text-gray-900',
  },
  /** The artist portal's royal-on-white forms. */
  royal: {
    shell: 'border-royal-200 bg-white',
    header: 'bg-royal-50/60 border-royal-200',
    icon: 'text-maroon-800/50',
    title: 'text-maroon-800/70',
    body: 'text-maroon-800/70',
    note: 'text-maroon-800/40',
    accept: 'border-royal-200',
    acceptText: 'text-maroon-800/80',
    box: 'accent-maroon-900',
    link: 'text-maroon-800',
    pickerOn: 'bg-maroon-900 text-royal-100',
    pickerOff: 'text-maroon-800/50 hover:text-maroon-900',
  },
} as const;

export function ContractCheckbox({
  accepted, onChange, theme = 'dark', audience = 'customer', contract: given,
}: {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  theme?: keyof typeof THEMES;
  /** Which contract to show. Ignored when `contract` is passed in. */
  audience?: ContractAudience;
  /** For a form that already loaded the contract itself — the artist application. */
  contract?: Contract | null;
}) {
  const [fetched, setFetched] = useState<Contract | null>(null);
  const [language, choose] = useTermsLanguage();

  useEffect(() => {
    if (given !== undefined) return;
    getActiveContract(audience).then(setFetched);
  }, [audience, given]);

  const contract = given !== undefined ? given : fetched;
  if (!contract) return null;

  const t = THEMES[theme];
  const hindiTerms = contract.bodyHi?.trim() ? contract : null;
  const hindi = language === 'hi' && hindiTerms;

  return (
    <div className={`rounded-xl border overflow-hidden ${t.shell}`}>
      <div className={`px-3 py-2 border-b flex items-center gap-1.5 ${t.header}`}>
        <ScrollText size={13} className={t.icon} />
        <p className={`flex-1 text-[10px] font-bold uppercase tracking-wider ${t.title}`}>
          {hindi ? contract.titleHi || contract.title : contract.title}
        </p>
        {hindiTerms && (
          <div className="flex items-center gap-0.5 shrink-0">
            {(['en', 'hi'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => choose(option)}
                aria-pressed={language === option}
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
                  language === option ? t.pickerOn : t.pickerOff
                }`}
              >
                {option === 'en' ? 'English' : 'हिंदी'}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={`p-3 max-h-28 overflow-y-auto custom-scrollbar ${t.body}`}>
        <p className="text-[11px] leading-relaxed">{hindi ? contract.bodyHi : contract.body}</p>
        {hindi && (
          <p className={`mt-2 text-[10px] leading-relaxed ${t.note}`}>
            यह अनुवाद पढ़ने में आसानी के लिए है — शर्तें दोनों भाषाओं में एक ही हैं।
          </p>
        )}
      </div>
      <label className={`flex items-start gap-2 p-3 border-t cursor-pointer ${t.accept}`}>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onChange(e.target.checked)}
          className={`mt-0.5 ${t.box}`}
          required
        />
        <span className={`block flex-1 space-y-1 text-[11px] ${t.acceptText}`}>
          <span className="block">{ACCEPT[audience].en}</span>
          <span className="block">{ACCEPT[audience].hi}</span>
          {/* The refund ladder is the thing customers most want to check before
              paying an advance, and it lives one click away rather than inside
              this small scroll box. */}
          {audience !== 'artist' && (
            <a
              href="/policies#cancellation"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`block font-bold underline ${t.link}`}
            >
              Cancellation &amp; refund policy · रद्दीकरण और रिफंड नीति ↗
            </a>
          )}
        </span>
      </label>
    </div>
  );
}
