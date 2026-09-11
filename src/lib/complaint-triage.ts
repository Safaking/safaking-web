/**
 * Complaint categories, priorities and SLA clocks.
 *
 * The priority itself is set by the database (triage_complaint() in
 * supabase/036) — these values only label it and must match that function.
 * Not a 'use client' module, so server routes can import it too.
 */

export type ComplaintCategory =
  | 'artist_no_show' | 'event_failure' | 'artist_late' | 'payment' | 'replacement'
  | 'quality' | 'behaviour' | 'product' | 'suggestion' | 'other';

export const COMPLAINT_CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  artist_no_show: 'The artist did not come',
  event_failure: 'Something is going badly wrong at the event',
  artist_late: 'The artist is late',
  payment: 'A payment problem',
  replacement: 'A problem with a replacement artist',
  quality: 'The quality of the work',
  behaviour: 'The artist’s behaviour',
  product: 'A problem with a safa or product',
  suggestion: 'A suggestion or feedback',
  other: 'Something else',
};

export const CUSTOMER_COMPLAINT_CATEGORIES: ComplaintCategory[] = [
  'artist_no_show', 'artist_late', 'event_failure', 'quality', 'behaviour',
  'product', 'payment', 'replacement', 'suggestion', 'other',
];

export type ComplaintPriority = 'P1' | 'P2' | 'P3' | 'P4';

export const PRIORITY_LABEL: Record<ComplaintPriority, string> = {
  P1: 'P1 · Critical',
  P2: 'P2 · High',
  P3: 'P3 · Normal',
  P4: 'P4 · Low',
};

export const PRIORITY_TONE: Record<ComplaintPriority, string> = {
  P1: 'bg-rose-600 text-white',
  P2: 'bg-orange-100 text-orange-800',
  P3: 'bg-amber-100 text-amber-800',
  P4: 'bg-gray-100 text-gray-600',
};

export const PRIORITY_RANK: Record<ComplaintPriority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

/** Mirrors complaint_sla() in supabase/036. */
export const PRIORITY_SLA_HOURS: Record<ComplaintPriority, number> = { P1: 2, P2: 8, P3: 48, P4: 168 };

const CLOSED = ['resolved', 'dismissed'];

/** How long is left on the clock, or how far past it we are. */
export function slaState(dueAt: string | null | undefined, status: string): { overdue: boolean; label: string } {
  if (!dueAt || CLOSED.includes(status)) return { overdue: false, label: '' };
  const ms = new Date(dueAt).getTime() - Date.now();
  const span = (m: number) => {
    const h = Math.floor(Math.abs(m) / 3_600_000);
    const d = Math.floor(h / 24);
    return d >= 1 ? `${d}d ${h % 24}h` : h >= 1 ? `${h}h` : `${Math.max(1, Math.round(Math.abs(m) / 60_000))}m`;
  };
  return ms < 0 ? { overdue: true, label: `Past SLA by ${span(ms)}` } : { overdue: false, label: `${span(ms)} left` };
}
