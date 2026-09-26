'use client';

import { useEffect, useState } from 'react';
import { CalendarX2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTermsLanguage } from '@/lib/terms-language';

interface Rule {
  min_hours_before: number;
  refund_percent: number;
}

/**
 * The refund ladder, shown before the customer confirms.
 *
 * Read live from refund_rules — the same rows that price every cancellation —
 * so what the customer agrees to here is what will actually be applied.
 *
 * It follows whichever language the terms tick-box below it is being read in,
 * because how much money comes back is the part people most need to
 * understand (src/lib/terms-language.ts).
 */
export function CancellationTerms({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [language] = useTermsLanguage();
  const hi = language === 'hi';

  useEffect(() => {
    supabase
      .from('refund_rules')
      .select('min_hours_before, refund_percent')
      .eq('active', true)
      .not('min_hours_before', 'is', null)
      .order('min_hours_before', { ascending: false })
      .then(({ data }) => setRules((data as Rule[]) ?? []));
  }, []);

  if (rules.length === 0) return null;

  const dark = theme === 'dark';
  const span = (hours: number) =>
    hours >= 72 && hours % 24 === 0
      ? `${hours / 24} ${hi ? 'दिन' : 'days'}`
      : `${hours} ${hi ? 'घंटे' : 'hours'}`;

  return (
    <div className={`rounded-xl border p-3.5 ${dark ? 'border-royal-400/20 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
      <p className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 mb-2 ${
        dark ? 'text-royal-300' : 'text-maroon-900'
      }`}>
        <CalendarX2 size={12} /> {hi ? 'अगर बुकिंग रद्द करनी पड़े' : 'If you need to cancel'}
      </p>
      <ul className="space-y-1">
        {rules.map((rule, i) => {
          const upper = i > 0 ? rules[i - 1].min_hours_before : null;
          const when =
            upper === null
              ? hi ? `${span(rule.min_hours_before)} या उससे ज़्यादा पहले` : `${span(rule.min_hours_before)} or more before`
            : rule.min_hours_before === 0
              ? hi ? `${span(upper)} से कम समय पहले` : `Less than ${span(upper)} before`
            : hi ? `${span(rule.min_hours_before)} – ${span(upper)} पहले`
              : `${span(rule.min_hours_before)} – ${span(upper)} before`;
          return (
            <li key={rule.min_hours_before} className="flex items-center justify-between gap-3 text-[11px]">
              <span className={dark ? 'text-royal-100/80' : 'text-gray-700'}>{when}</span>
              <span className={`font-black tabular-nums ${
                rule.refund_percent >= 100 ? (dark ? 'text-emerald-300' : 'text-emerald-700')
                : rule.refund_percent > 0 ? (dark ? 'text-amber-300' : 'text-amber-700')
                : (dark ? 'text-rose-300' : 'text-rose-700')
              }`}>
                {rule.refund_percent > 0
                  ? `${rule.refund_percent}% ${hi ? 'वापस' : 'back'}`
                  : hi ? 'नकद रिफंड नहीं' : 'No cash refund'}
              </span>
            </li>
          );
        })}
      </ul>
      <p className={`text-[10px] leading-relaxed mt-2 ${dark ? 'text-royal-200/60' : 'text-gray-500'}`}>
        {hi
          ? 'आपने जो भुगतान किया है उसमें से — GST/टैक्स और नॉन-रिफंडेबल चार्ज छोड़कर। अगर हम आपकी बुकिंग पूरी नहीं कर पाते, तो 100% वापस मिलता है।'
          : 'Of what you paid, excluding GST/taxes and non-refundable charges. If we cannot serve your booking, you get 100% back.'}{' '}
        <a href="/policies#cancellation" target="_blank" rel="noopener noreferrer"
          className={`font-bold underline ${dark ? 'text-royal-300' : 'text-maroon-800'}`}>
          {hi ? 'पूरी नीति ↗' : 'Full policy ↗'}
        </a>
      </p>
    </div>
  );
}
