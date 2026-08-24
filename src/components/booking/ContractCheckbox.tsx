'use client';

import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { getActiveContract, Contract, ContractAudience } from '@/lib/client-update';

/**
 * "बुकिंग के समय कस्टमर के लिए अक्सेप्त करने के लिए कंपनी का अनुबंध बनाना
 *  जिस पर टिक करना होगा" — a required tick-box on the active customer
 * contract, shown inline in a booking form.
 *
 * Renders nothing if no contract is configured yet, so a missing admin setup
 * degrades to "no extra step" rather than a broken-looking blank box.
 */
export function ContractCheckbox({
  accepted, onChange, theme = 'dark', audience = 'customer',
}: {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  /** 'dark' matches the maroon booking panels (home page); 'light' matches white cards (/rent). */
  theme?: 'dark' | 'light';
  /** Which contract to show — 'customer' (artist booking / rental), or 'groom_safa' (shop checkout). */
  audience?: Extract<ContractAudience, 'customer' | 'groom_safa'>;
}) {
  const [contract, setContract] = useState<Contract | null>(null);

  useEffect(() => {
    getActiveContract(audience).then(setContract);
  }, [audience]);

  if (!contract) return null;

  const isDark = theme === 'dark';

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isDark ? 'border-royal-400/20 bg-white/5' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div
        className={`px-3 py-2 border-b flex items-center gap-1.5 ${
          isDark ? 'bg-white/5 border-royal-400/20' : 'bg-white border-gray-200'
        }`}
      >
        <ScrollText size={13} className={isDark ? 'text-royal-300' : 'text-gray-500'} />
        <p
          className={`text-[10px] font-bold uppercase tracking-wider ${
            isDark ? 'text-royal-200/70' : 'text-gray-600'
          }`}
        >
          {contract.title}
        </p>
      </div>
      <p
        className={`p-3 text-[11px] leading-relaxed max-h-24 overflow-y-auto custom-scrollbar ${
          isDark ? 'text-royal-100/70' : 'text-gray-600'
        }`}
      >
        {contract.body}
      </p>
      <label
        className={`flex items-start gap-2 p-3 border-t cursor-pointer ${
          isDark ? 'border-royal-400/20' : 'border-gray-200 bg-white'
        }`}
      >
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onChange(e.target.checked)}
          className={`mt-0.5 ${isDark ? 'accent-royal-400' : 'accent-maroon-900'}`}
          required
        />
        <span className={`text-[11px] ${isDark ? 'text-royal-100/80' : 'text-gray-700'}`}>
          I have read and accept these booking terms, including the return and payment policy.
        </span>
      </label>
    </div>
  );
}
