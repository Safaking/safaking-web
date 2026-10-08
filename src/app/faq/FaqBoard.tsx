'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, MessageCircle, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BUSINESS, telHref } from '@/lib/business';
import { FAQ_GROUPS, FAQ_FALLBACKS, fillTokens } from '@/lib/faq';
import { useTermsLanguage } from '@/lib/terms-language';

/**
 * The questions and answers, in whichever language the reader has chosen.
 *
 * Each answer is a native <details>, so the text is in the page whether or
 * not it is open — which is what lets Google quote it — and the page still
 * works with no JavaScript at all.
 *
 * The few numbers in the answers are filled from the same settings that run a
 * booking, so the FAQ cannot promise one advance while the checkout takes
 * another.
 */
export function FaqBoard() {
  const [language, choose] = useTermsLanguage();
  const [values, setValues] = useState<Record<string, string>>(FAQ_FALLBACKS);
  const [query, setQuery] = useState('');
  const hi = language === 'hi';

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('key, value')
      .then(({ data }) => {
        const settings = Object.fromEntries(
          ((data ?? []) as { key: string; value: number }[]).map((row) => [row.key, Number(row.value)])
        );
        const percent = (key: string, fallback: number) => {
          const raw = settings[key];
          if (raw === undefined) return fallback;
          return Math.round(raw <= 1 ? raw * 100 : raw);
        };
        setValues({
          advance: String(percent('advance_rate', 50)),
          groomAdvance: String(percent('groom_safa_advance_percent', 25)),
          dateChangeDays: String(settings['customer_date_change_free_days'] ?? 3),
        });
      });
  }, []);

  const needle = query.trim().toLowerCase();
  const groups = FAQ_GROUPS.map((group) => ({
    ...group,
    items: needle
      ? group.items.filter((item) =>
          `${item.q.en} ${item.q.hi} ${item.a.en} ${item.a.hi}`.toLowerCase().includes(needle)
        )
      : group.items,
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={hi ? 'सवाल खोजें…' : 'Search the questions…'}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-amber-200/70 bg-white text-sm text-maroon-950 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-maroon-800/20"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-amber-200/70 bg-white p-1">
          {(['en', 'hi'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              aria-pressed={language === option}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                language === option ? 'bg-maroon-900 text-royal-100' : 'text-gray-500 hover:text-maroon-900'
              }`}
            >
              {option === 'en' ? 'English' : 'हिंदी'}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-500">
          {hi ? 'इस खोज से कोई सवाल नहीं मिला। हमें फ़ोन कर लीजिए।' : 'Nothing matched that. Give us a call and ask.'}
        </p>
      )}

      {groups.map((group) => (
        <section key={group.id} id={group.id} className="space-y-3 scroll-mt-24">
          <h2 className="font-display font-black text-xl text-maroon-950">
            {hi ? group.title.hi : group.title.en}
          </h2>
          <div className="rounded-2xl border border-amber-200/70 bg-white overflow-hidden divide-y divide-amber-100">
            {group.items.map((item) => (
              <details key={item.id} id={item.id} className="group scroll-mt-24">
                <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-4 text-sm font-bold text-maroon-950 hover:bg-amber-50/60">
                  <span className="mt-0.5 text-royal-600 transition-transform group-open:rotate-45">+</span>
                  <span className="flex-1">{fillTokens(hi ? item.q.hi : item.q.en, values)}</span>
                </summary>
                <p className="px-4 pb-4 pl-11 text-[13px] leading-relaxed text-gray-700">
                  {fillTokens(hi ? item.a.hi : item.a.en, values)}
                </p>
              </details>
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-2xl bg-maroon-950 p-6 text-royal-100">
        <h2 className="font-display font-black text-xl text-royal-100">
          {hi ? 'जवाब नहीं मिला?' : 'Still not answered?'}
        </h2>
        <p className="mt-1 text-sm text-royal-200/70">
          {hi
            ? `सोमवार से शनिवार, सुबह 10 से रात 8 बजे तक हमसे बात कीजिए।`
            : `Talk to us, Monday to Saturday, 10 AM to 8 PM.`}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={telHref}
            className="inline-flex items-center gap-2 rounded-full bg-royal-400 px-5 py-3 text-xs font-bold uppercase tracking-widest text-maroon-950"
          >
            <Phone size={14} /> {BUSINESS.phone}
          </a>
          <a
            href={`https://wa.me/${BUSINESS.phoneDigits}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-royal-400/40 px-5 py-3 text-xs font-bold uppercase tracking-widest text-royal-200"
          >
            <MessageCircle size={14} /> WhatsApp
          </a>
          <Link
            href="/policies"
            className="inline-flex items-center gap-2 rounded-full border border-royal-400/40 px-5 py-3 text-xs font-bold uppercase tracking-widest text-royal-200"
          >
            {hi ? 'पूरी नीतियाँ' : 'Full policies'}
          </Link>
        </div>
      </section>
    </>
  );
}
