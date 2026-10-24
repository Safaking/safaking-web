import type { ReactNode } from 'react';
import { Info } from 'lucide-react';

/**
 * A line of help in both languages, the way the refer page already does it.
 *
 * Not a translation toggle: both lines are on screen at once, English above
 * and Hindi below it in a quieter colour. Most people here read some of each,
 * and a page that makes them choose first is a page that makes them stop.
 *
 * Written out rather than generated so each line says what that page actually
 * needs — the Hindi is the same help, not a machine's word-for-word version
 * of the English.
 */
export function BilingualHelp({
  title,
  en,
  hi,
  icon,
  tone = 'dark',
}: {
  title?: string;
  en: ReactNode;
  hi: ReactNode;
  icon?: ReactNode;
  /** The page's own background: most are dark, the shop and gallery are light. */
  tone?: 'dark' | 'light';
}) {
  const dark = tone === 'dark';
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-5 ${
        dark ? 'border-royal-400/20 bg-white/5' : 'border-royal-200/70 bg-royal-50/60'
      }`}
    >
      <span className={`mt-0.5 shrink-0 ${dark ? 'text-royal-300' : 'text-royal-600'}`}>
        {icon ?? <Info size={20} />}
      </span>
      <div className={`text-sm leading-relaxed ${dark ? 'text-royal-100/80' : 'text-maroon-900/80'}`}>
        {title && (
          <p className={`font-bold ${dark ? 'text-royal-100' : 'text-maroon-900'}`}>{title}</p>
        )}
        <p className={title ? 'mt-1' : ''}>{en}</p>
        <p className={`mt-1 ${dark ? 'text-royal-200/60' : 'text-maroon-800/55'}`}>{hi}</p>
      </div>
    </div>
  );
}
