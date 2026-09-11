'use client';

import React from 'react';

/* ----------------------------------------------------------------- types */

export interface BookingRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  city_venue: string;
  venue_address: string | null;
  event_date: string;
  event_time: string | null;
  booking_start_time: string | null;
  safa_style: string;
  artist_id: string | null;
  artist_name: string | null;
  amount: number;
  advance_amount: number | null;
  balance_amount: number | null;
  artist_payout_amount: number | null;
  payment_status: string | null;
  payment_release_status: string | null;
  status: string;
  lead_source: string | null;
  customer_lat: number | null;
  customer_lng: number | null;
  location_note: string | null;
  assignment_approved_at: string | null;
  payment_mode: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface RentalRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  start_date: string;
  end_date: string;
  rental_days: number;
  venue_address: string;
  city: string | null;
  pincode: string;
  safa_count: number;
  needs_artist: boolean;
  artist_id: string | null;
  artist_name: string | null;
  artist_amount: number;
  rent_amount: number;
  deposit_amount: number;
  total_amount: number;
  advance_amount: number;
  balance_amount: number;
  deposit_refunded: boolean;
  payment_status: string;
  payment_release_status: string | null;
  status: string;
  lead_source: string | null;
  customer_lat: number | null;
  customer_lng: number | null;
  location_note: string | null;
  assignment_approved_at: string | null;
  payment_mode: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  created_at: string | null;
}

export interface OrderRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  advance_amount: number | null;
  balance_amount: number | null;
  payment_status: string | null;
  status: string;
  shipping_address: string | null;
  lead_source: string | null;
  payment_mode: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  created_at: string | null;
}

export interface ArtistRow {
  id: string;
  display_name: string;
  base_city: string | null;
  rating: number | null;
  total_events: number;
  verification_status: string | null;
  active: boolean;
  blacklisted: boolean;
  per_safa_rate: number | null;
  standing?: string | null;
}

export interface PersonRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  created_at: string | null;
}

export interface ExpenseRow {
  id: string;
  expense_date: string;
  category: string;
  description: string | null;
  amount: number;
  payment_mode: string;
  paid_to: string | null;
}

export interface ComplaintRow {
  id: string;
  artist_id: string | null;
  customer_name: string;
  subject: string;
  status: string;
  severity: string;
  /** From supabase/036 — absent on a database that has not run it. */
  priority?: string | null;
  sla_due_at?: string | null;
  ticket_id?: string | null;
  created_at: string | null;
}

export interface IncidentRow {
  id: string;
  artist_id: string;
  kind: string;
  points: number;
  resolved_at: string | null;
  created_at: string;
}

export interface ReviewRow {
  id: string;
  subject_id: string;
  rating: number;
  comment: string | null;
  visible: boolean;
  created_at: string | null;
}

export interface CheckinRow {
  booking_id: string | null;
  rental_id: string | null;
  artist_id: string;
  stage: string;
  created_at: string;
}

export interface LeadRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  pincode: string;
  event_date: string;
  safa_count: number;
  status: string;
  created_at: string | null;
}

export interface AuditRow {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  actor_id: string | null;
  actor_role: string | null;
  changed: Record<string, { from: unknown; to: unknown }> | null;
  snapshot: Record<string, unknown> | null;
  created_at: string;
}

/* ------------------------------------------------------------- constants */

/** Cancelled and declined never count as revenue or as work done. */
export const DEAD = ['cancelled', 'declined'];
export const PAID_STATES = ['advance_paid', 'fully_paid'];

export const STAGE_LABEL: Record<string, string> = {
  en_route: 'On the way', arrived: 'Arrived', started: 'Tying',
  completed: 'Finished', no_show: 'NO SHOW',
};

export const PAYMENT_MODE_LABEL: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank transfer',
  gateway: 'Online (gateway)', other: 'Other',
};

export const PAYMENT_MODE_ORDER = ['cash', 'upi', 'card', 'bank', 'gateway', 'other'] as const;

export const EXPENSE_LABEL: Record<string, string> = {
  salary: 'Salary & wages', artist_payment: 'Artist payment', marketing: 'Marketing & ads',
  rent: 'Shop rent', electricity: 'Electricity & utilities', delivery: 'Delivery & courier',
  software: 'Software', travel: 'Travel & fuel', materials: 'Fabric & materials',
  refund: 'Customer refund', other: 'Other',
};

/* --------------------------------------------------------------- helpers */

export const money = (v: number | null | undefined) => `₹${Math.round(v ?? 0).toLocaleString('en-IN')}`;
export const todayISO = () => new Date().toLocaleDateString('en-CA');
export const dayOf = (ts: string | null | undefined) => (ts ? ts.slice(0, 10) : '');
export const shortRef = (id: string) => id.slice(0, 8).toUpperCase();

export const shiftDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};

export const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA');
};

/** Safa count is stuffed into artist_bookings.city_venue as "(… Count: 25 Safas)". */
export const countFromVenue = (venue: string) => Number(venue.match(/Count:\s*(\d+)/i)?.[1] ?? 1);
export const cleanVenue = (venue: string) => venue.replace(/\s*\(Pincode:[^)]*\)/i, '').trim();
export const pinFromVenue = (venue: string) => venue.match(/Pincode:\s*(\d{6})/i)?.[1] ?? '';

/** Days between a date and today, for ageing buckets. */
export const daysSince = (iso: string | null | undefined) => {
  if (!iso) return 0;
  const then = new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
};

/** Spec §32: 0-7, 8-30, 31-60, 61+ */
export const ageBucket = (days: number) =>
  days <= 7 ? '0–7 days' : days <= 30 ? '8–30 days' : days <= 60 ? '31–60 days' : '61+ days';

export const AGE_BUCKETS = ['0–7 days', '8–30 days', '31–60 days', '61+ days'] as const;

export function toCSV(headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const blob = new Blob([`﻿${toCSV(headers, rows)}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------- UI atoms */

export function Stat({ label, value, tone = 'plain', note, onClick }: {
  label: string;
  value: string | number;
  tone?: 'plain' | 'good' | 'warn' | 'bad';
  note?: string;
  /** Spec §13: a KPI you can click through to the report behind it. */
  onClick?: () => void;
}) {
  const tones = {
    plain: { card: 'border-amber-200/70 bg-white', rule: 'bg-royal-400', value: 'text-maroon-950' },
    good: { card: 'border-emerald-200 bg-emerald-50/60', rule: 'bg-emerald-500', value: 'text-emerald-800' },
    warn: { card: 'border-amber-300 bg-amber-50/80', rule: 'bg-amber-500', value: 'text-amber-800' },
    bad: { card: 'border-rose-200 bg-rose-50/70', rule: 'bg-rose-500', value: 'text-rose-800' },
  }[tone];

  const inner = (
    <>
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${tones.rule}`} />
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-maroon-900/45">{label}</p>
      <p className={`font-display font-black text-[26px] leading-tight mt-1 tabular-nums ${tones.value}`}>{value}</p>
      {note && <p className="text-[10px] text-maroon-900/45 mt-0.5">{note}</p>}
    </>
  );

  const cls = `relative rounded-2xl border pl-5 pr-4 py-4 overflow-hidden text-left w-full ${tones.card}`;

  return onClick ? (
    <button onClick={onClick} className={`${cls} hover:shadow-md transition-shadow cursor-pointer group`}>
      {inner}
      <span className="absolute right-3 top-3 text-[9px] font-black uppercase tracking-wider text-maroon-900/25 group-hover:text-maroon-900/60 no-print">
        Open →
      </span>
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3 mt-1">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-maroon-900">{children}</p>
      <span className="flex-1 h-px bg-gradient-to-r from-royal-300 to-transparent" />
    </div>
  );
}

const TH = 'px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-maroon-900/75 whitespace-nowrap';
const TD = 'px-4 py-2.5 text-[12.5px] text-gray-800 align-top leading-snug';

/**
 * Columns whose header reads like money or a count are right-aligned with
 * tabular figures — a column of rupees that does not line up is unreadable
 * on paper, which is where these reports mostly end up.
 */
const NUMERIC =
  /amount|revenue|balance|advance|paid|payable|total|rent|deposit|qty|safas|jobs|completed|lost|bookings|rentals|orders|days|share|profit|expense|collected|outstanding|sales|tying|value|count|rate|earned|due|spend|leads|%/i;

export function Table({ headers, rows, empty, footer }: {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
  footer?: React.ReactNode[];
}) {
  if (rows.length === 0) {
    return (
      <div className="py-14 text-center">
        <p className="text-sm font-bold text-maroon-900/40">{empty}</p>
      </div>
    );
  }
  const alignOf = (i: number) =>
    NUMERIC.test(headers[i] ?? '') ? 'text-right tabular-nums font-semibold text-maroon-900' : '';

  return (
    <div className="overflow-x-auto rounded-2xl border border-amber-200/70">
      <table className="w-full text-left border-collapse">
        {/* Repeats on every printed page — spec §18. */}
        <thead className="bg-gradient-to-b from-royal-100/80 to-royal-50 border-b-2 border-royal-300/70">
          <tr>{headers.map((h, i) => <th key={h + i} className={`${TH} ${alignOf(i)}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-amber-100/80 last:border-0 transition-colors hover:bg-royal-50/60 ${
              i % 2 === 1 ? 'bg-amber-50/25' : 'bg-white'
            }`}>
              {r.map((c, j) => <td key={j} className={`${TD} ${alignOf(j)}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot className="bg-royal-50 border-t-2 border-royal-300/70">
            <tr>
              {footer.map((c, j) => (
                <td key={j} className={`${TD} font-black text-maroon-950 ${alignOf(j)}`}>{c}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** A muted line explaining why a report cannot show something. */
export function Caveat({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-gray-500 leading-relaxed mb-4 p-3 rounded-xl bg-amber-50/60 border border-amber-200/70">
      {children}
    </p>
  );
}
