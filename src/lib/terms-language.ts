'use client';

import { useEffect, useState } from 'react';

/**
 * Whether the terms are being read in Hindi or English.
 *
 * Shared, because the tick-box and the refund ladder sit one above the other
 * in the same form: tapping हिंदी on one has to switch the other at the same
 * moment. Remembered too, so somebody who reads in Hindi is given Hindi on
 * every form afterwards.
 */

export type TermsLanguage = 'en' | 'hi';

const KEY = 'sk-terms-language';

let current: TermsLanguage = 'en';
const listeners = new Set<(language: TermsLanguage) => void>();

export function useTermsLanguage(): [TermsLanguage, (next: TermsLanguage) => void] {
  // Starts in English on both the server and the first paint; the remembered
  // choice is applied just after mounting, so the two always agree.
  const [language, setLanguage] = useState<TermsLanguage>('en');

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === 'hi') current = 'hi';
    } catch {
      // Private browsing. English it is.
    }
    setLanguage(current);
    listeners.add(setLanguage);
    return () => {
      listeners.delete(setLanguage);
    };
  }, []);

  return [
    language,
    (next) => {
      current = next;
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // The choice simply does not outlive this form.
      }
      listeners.forEach((listener) => listener(next));
    },
  ];
}
