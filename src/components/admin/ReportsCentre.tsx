'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, AlertCircle, Printer, Download, RefreshCw, ClipboardList, Sunrise,
  Calendar, CalendarRange, Crown, Users, IndianRupee, TrendingUp, Search,
  Wallet, Megaphone,
} from 'lucide-react';
import { supabase, friendlyError } from '@/lib/supabase';
import { AnalyticsPanel } from '@/components/admin/AnalyticsPanel';

/* ------------------------------------------------------------------ types */

interface BookingRow {
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
  created_at: string | null;
}

interface RentalRow {
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
  created_at: string | null;
}

interface OrderRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  advance_amount: number | null;
  balance_amount: number | null;
  payment_status: string | null;
  status: string;
  created_at: string | null;
}

interface ArtistRow {
  id: string;
  display_name: string;
  base_city: string | null;
  rating: number | null;
  total_events: number;
  verification_status: string | null;
  active: boolean;
  blacklisted: boolean;
}

interface PersonRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
}

interface ExpenseRow {
  id: string;
  expense_date: string;
  category: string;
  description: string | null;
  amount: number;
  payment_mode: string;
  paid_to: string | null;
}

const EXPENSE_LABEL: Record<string, string> = {
  salary: 'Salary & wages', artist_payment: 'Artist payment', marketing: 'Marketing & ads',
  rent: 'Shop rent', electricity: 'Electricity & utilities', delivery: 'Delivery & courier',
  software: 'Software', travel: 'Travel & fuel', materials: 'Fabric & materials',
  refund: 'Customer refund', other: 'Other',
};

type ReportId =
  | 'control' | 'ops' | 'bookings' | 'rentals' | 'artists' | 'customers'
  | 'revenue' | 'pnl' | 'sources' | 'analytics';

const REPORTS: { id: ReportId; label: string; hint: string; icon: typeof ClipboardList }[] = [
  { id: 'control', label: 'Daily Control Sheet', hint: 'One page — the whole day at a glance', icon: ClipboardList },
  { id: 'ops', label: 'Morning Operations Sheet', hint: 'Every job for a date, with artist & phone', icon: Sunrise },
  { id: 'bookings', label: 'Booking Register', hint: 'Artist bookings over a date range', icon: Calendar },
  { id: 'rentals', label: 'Rental Register', hint: 'Rentals, deposits & returns', icon: CalendarRange },
  { id: 'artists', label: 'Artist Performance & Payable', hint: 'Jobs, earnings, what we still owe', icon: Crown },
  { id: 'customers', label: 'Customer & Outstanding', hint: 'Who has booked, who still owes', icon: Users },
  { id: 'revenue', label: 'Revenue Summary', hint: 'Month by month, by business line', icon: IndianRupee },
  { id: 'pnl', label: 'Profit & Loss', hint: 'Revenue minus expenses, by month', icon: Wallet },
  { id: 'sources', label: 'Lead Source', hint: 'Which marketing actually brings bookings', icon: Megaphone },
  { id: 'analytics', label: 'Business Analytics', hint: 'Top products, top artists, trend', icon: TrendingUp },
];

/* -------------------------------------------------------------- utilities */

const money = (v: number | null | undefined) => `₹${Math.round(v ?? 0).toLocaleString('en-IN')}`;
const todayISO = () => new Date().toLocaleDateString('en-CA');
const shiftDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA');
};
const dayOf = (ts: string | null) => (ts ? ts.slice(0, 10) : '');
const shortRef = (id: string) => id.slice(0, 8).toUpperCase();
/** Safa count is stuffed into artist_bookings.city_venue as "(… Count: 25 Safas)". */
const countFromVenue = (venue: string) => Number(venue.match(/Count:\s*(\d+)/i)?.[1] ?? 1);
const cleanVenue = (venue: string) => venue.replace(/\s*\(Pincode:[^)]*\)/i, '').trim();

const PAID_STATES = ['advance_paid', 'fully_paid'];
const DEAD_BOOKING = ['cancelled', 'declined'];

function toCSV(headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const blob = new Blob([`﻿${toCSV(headers, rows)}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------ small parts */

function Stat({ label, value, tone = 'plain', note }: {
  label: string; value: string | number; tone?: 'plain' | 'good' | 'warn' | 'bad'; note?: string;
}) {
  const tones = {
    plain: { card: 'border-amber-200/70 bg-white', rule: 'bg-royal-400', value: 'text-maroon-950' },
    good: { card: 'border-emerald-200 bg-emerald-50/60', rule: 'bg-emerald-500', value: 'text-emerald-800' },
    warn: { card: 'border-amber-300 bg-amber-50/80', rule: 'bg-amber-500', value: 'text-amber-800' },
    bad: { card: 'border-rose-200 bg-rose-50/70', rule: 'bg-rose-500', value: 'text-rose-800' },
  }[tone];

  return (
    <div className={`relative rounded-2xl border pl-5 pr-4 py-4 overflow-hidden ${tones.card}`}>
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${tones.rule}`} />
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-maroon-900/45">{label}</p>
      <p className={`font-display font-black text-[26px] leading-tight mt-1 tabular-nums ${tones.value}`}>{value}</p>
      {note && <p className="text-[10px] text-maroon-900/45 mt-0.5">{note}</p>}
    </div>
  );
}

/** A section heading with the gold rule used across the admin. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-maroon-900">{children}</p>
      <span className="flex-1 h-px bg-gradient-to-r from-royal-300 to-transparent" />
    </div>
  );
}

const TH =
  'px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-maroon-900/75 whitespace-nowrap';
const TD = 'px-4 py-2.5 text-[12.5px] text-gray-800 align-top leading-snug';

/**
 * Columns whose header reads like money or a count are right-aligned with
 * tabular figures — a column of rupees that does not line up is unreadable
 * on paper, which is where these reports mostly end up.
 */
const NUMERIC = /amount|revenue|balance|advance|paid|payable|total|rent|deposit|qty|safas|jobs|completed|lost|bookings|rentals|orders|days|share|profit|expense|collected|outstanding|sales|tying/i;

function Table({ headers, rows, empty }: { headers: string[]; rows: React.ReactNode[][]; empty: string }) {
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
        <thead className="bg-gradient-to-b from-royal-100/80 to-royal-50 border-b-2 border-royal-300/70">
          <tr>
            {headers.map((h, i) => (
              <th key={h + i} className={`${TH} ${alignOf(i)}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className={`border-b border-amber-100/80 last:border-0 transition-colors hover:bg-royal-50/60 ${
                i % 2 === 1 ? 'bg-amber-50/25' : 'bg-white'
              }`}
            >
              {r.map((c, j) => <td key={j} className={`${TD} ${alignOf(j)}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------- main */

export function ReportsCentre({ adminName }: { adminName: string }) {
  const [report, setReport] = useState<ReportId>('control');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [rentals, setRentals] = useState<RentalRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  // Single-date reports (control sheet, ops sheet) vs range reports.
  const [onDate, setOnDate] = useState(todayISO());
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [generatedAt, setGeneratedAt] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Everything is pulled once and aggregated in the browser: the volumes
    // here are small (hundreds of rows), and it keeps every report instant
    // and consistent instead of firing a query per switch.
    const [b, r, o, a, p, e] = await Promise.all([
      supabase.from('artist_bookings').select('*').order('event_date', { ascending: false }),
      supabase.from('rental_bookings').select('*').order('start_date', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('artist_profiles').select('id, display_name, base_city, rating, total_events, verification_status, active, blacklisted'),
      supabase.from('profiles').select('id, full_name, phone, role'),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
    ]);

    // Expenses are the one table that may not exist yet (it arrives with
    // supabase/027) — a missing table should grey out one report, not break
    // the whole centre.
    const firstError = b.error ?? r.error ?? o.error ?? a.error ?? p.error;
    if (firstError) setError(friendlyError(firstError));
    else if (e.error) setError('Expense reports need supabase/027_expenses_and_lead_source.sql to be run first.');

    setBookings((b.data as BookingRow[]) ?? []);
    setRentals((r.data as RentalRow[]) ?? []);
    setOrders((o.data as OrderRow[]) ?? []);
    setArtists((a.data as ArtistRow[]) ?? []);
    setPeople((p.data as PersonRow[]) ?? []);
    setExpenses((e.data as ExpenseRow[]) ?? []);
    setGeneratedAt(new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const phoneOf = useCallback(
    (artistId: string | null) => (artistId ? people.find((x) => x.id === artistId)?.phone ?? '—' : '—'),
    [people]
  );

  const inRange = useCallback((d: string | null) => !!d && d >= from && d <= to, [from, to]);
  const matches = useCallback(
    (...fields: (string | null | undefined)[]) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return fields.some((f) => (f ?? '').toLowerCase().includes(q));
    },
    [search]
  );

  const current = REPORTS.find((x) => x.id === report)!;

  /* ------------------------------------------------- report: control sheet */

  const control = useMemo(() => {
    const tomorrow = shiftDays(onDate, 1);
    const dayBookings = bookings.filter((b) => b.event_date === onDate);
    const dayRentals = rentals.filter((r) => r.start_date === onDate);
    const live = (s: string) => !DEAD_BOOKING.includes(s);

    const jobsToday = [...dayBookings.filter((b) => live(b.status)), ...dayRentals.filter((r) => r.needs_artist && live(r.status))];
    const unassigned = jobsToday.filter((j) => !('artist_id' in j ? j.artist_id : null));

    const collectedToday =
      [...bookings, ...rentals, ...orders]
        .filter((x) => dayOf(x.created_at) === onDate && PAID_STATES.includes(x.payment_status ?? ''))
        .reduce((sum, x) => sum + Number(x.advance_amount ?? 0), 0);

    const pendingCollection =
      [...bookings.filter((b) => live(b.status)), ...rentals.filter((r) => live(r.status))]
        .reduce((sum, x) => sum + Number(x.balance_amount ?? 0), 0);

    const overdueReturns = rentals.filter(
      (r) => ['dispatched', 'active'].includes(r.status) && r.end_date < onDate
    );

    const actions: string[] = [];
    if (unassigned.length > 0) actions.push(`${unassigned.length} job(s) today still have no artist assigned.`);
    const tomorrowUnassigned = bookings.filter((b) => b.event_date === tomorrow && live(b.status) && !b.artist_id);
    if (tomorrowUnassigned.length > 0) actions.push(`${tomorrowUnassigned.length} booking(s) tomorrow have no artist yet — assign today.`);
    if (overdueReturns.length > 0) actions.push(`${overdueReturns.length} rental(s) are past their return date.`);
    const kycPending = artists.filter((a) => a.verification_status !== 'verified' && a.active && !a.blacklisted);
    if (kycPending.length > 0) actions.push(`${kycPending.length} artist(s) cannot be assigned until their KYC is approved.`);
    const unpaidCompleted = bookings.filter((b) => b.status === 'completed' && b.payment_release_status !== 'released');
    if (unpaidCompleted.length > 0) actions.push(`${unpaidCompleted.length} completed job(s) are waiting on artist payment release.`);

    return {
      tomorrow,
      todayCount: dayBookings.length,
      tomorrowCount: bookings.filter((b) => b.event_date === tomorrow).length,
      pendingCount: bookings.filter((b) => b.status === 'pending').length,
      cancelledCount: bookings.filter((b) => b.event_date === onDate && DEAD_BOOKING.includes(b.status)).length,
      required: jobsToday.length,
      assigned: jobsToday.length - unassigned.length,
      unassigned: unassigned.length,
      collectedToday,
      pendingCollection,
      refunded: [...bookings, ...rentals].filter((x) => x.payment_status === 'refunded' && dayOf(x.created_at) === onDate).length,
      deliveryToday: rentals.filter((r) => r.start_date === onDate).length,
      returnToday: rentals.filter((r) => r.end_date === onDate).length,
      overdueReturns: overdueReturns.length,
      actions,
    };
  }, [bookings, rentals, orders, artists, onDate]);

  /* ----------------------------------------------------- report: ops sheet */

  const opsRows = useMemo(() => {
    const fromBookings = bookings
      .filter((b) => b.event_date === onDate && !DEAD_BOOKING.includes(b.status))
      .map((b) => ({
        ref: shortRef(b.id),
        customer: b.customer_name,
        phone: b.customer_phone,
        type: 'Safa Tying',
        when: [b.event_date, b.booking_start_time ?? b.event_time].filter(Boolean).join(' · '),
        place: cleanVenue(b.venue_address || b.city_venue),
        service: b.safa_style,
        qty: countFromVenue(b.city_venue),
        artist: b.artist_name ?? '— UNASSIGNED —',
        artistPhone: phoneOf(b.artist_id),
        pay: b.payment_status ?? '—',
        status: b.status,
      }));

    const fromRentals = rentals
      .filter((r) => r.start_date === onDate && !DEAD_BOOKING.includes(r.status))
      .map((r) => ({
        ref: shortRef(r.id),
        customer: r.customer_name,
        phone: r.customer_phone,
        type: r.needs_artist ? 'Rental + Artist' : 'Rental',
        when: `${r.start_date} → ${r.end_date}`,
        place: r.venue_address || r.city || r.pincode,
        service: `${r.safa_count} safas`,
        qty: r.safa_count,
        artist: r.needs_artist ? r.artist_name ?? '— UNASSIGNED —' : '—',
        artistPhone: r.needs_artist ? phoneOf(r.artist_id) : '—',
        pay: r.payment_status,
        status: r.status,
      }));

    return [...fromBookings, ...fromRentals].filter((x) => matches(x.customer, x.phone, x.artist, x.place, x.ref));
  }, [bookings, rentals, onDate, phoneOf, matches]);

  /* ----------------------------------------------- report: booking register */

  const bookingRows = useMemo(
    () =>
      bookings
        .filter((b) => inRange(b.event_date))
        .filter((b) => statusFilter === 'all' || b.status === statusFilter)
        .filter((b) => matches(b.customer_name, b.customer_phone, b.artist_name, b.city_venue, shortRef(b.id))),
    [bookings, inRange, statusFilter, matches]
  );

  const bookingTotals = useMemo(
    () =>
      bookingRows.reduce(
        (acc, b) => {
          const dead = DEAD_BOOKING.includes(b.status);
          return {
            amount: acc.amount + (dead ? 0 : Number(b.amount ?? 0)),
            advance: acc.advance + (dead ? 0 : Number(b.advance_amount ?? 0)),
            balance: acc.balance + (dead ? 0 : Number(b.balance_amount ?? 0)),
          };
        },
        { amount: 0, advance: 0, balance: 0 }
      ),
    [bookingRows]
  );

  /* ------------------------------------------------ report: rental register */

  const rentalRows = useMemo(
    () =>
      rentals
        .filter((r) => inRange(r.start_date))
        .filter((r) => statusFilter === 'all' || r.status === statusFilter)
        .filter((r) => matches(r.customer_name, r.customer_phone, r.artist_name, r.city, r.pincode, shortRef(r.id))),
    [rentals, inRange, statusFilter, matches]
  );

  /* ------------------------------------------- report: artist performance */

  const artistRows = useMemo(() => {
    const rows = artists.map((a) => {
      const jobs = bookings.filter((b) => b.artist_id === a.id && inRange(b.event_date));
      const rentalJobs = rentals.filter((r) => r.artist_id === a.id && inRange(r.start_date));
      const completed = jobs.filter((b) => b.status === 'completed');
      const lost = jobs.filter((b) => DEAD_BOOKING.includes(b.status));
      const payoutOf = (b: BookingRow) => Number(b.artist_payout_amount ?? b.amount ?? 0);
      const earned = completed.reduce((s, b) => s + payoutOf(b), 0)
        + rentalJobs.filter((r) => ['returned', 'completed'].includes(r.status)).reduce((s, r) => s + Number(r.artist_amount ?? 0), 0);
      const paid = completed.filter((b) => b.payment_release_status === 'released').reduce((s, b) => s + payoutOf(b), 0);
      return {
        artist: a,
        jobs: jobs.length + rentalJobs.length,
        completed: completed.length,
        lost: lost.length,
        customerRevenue: jobs.filter((b) => !DEAD_BOOKING.includes(b.status)).reduce((s, b) => s + Number(b.amount ?? 0), 0),
        earned,
        paid,
        payable: Math.max(0, earned - paid),
      };
    });
    return rows
      .filter((row) => matches(row.artist.display_name, row.artist.base_city))
      .sort((x, y) => y.earned - x.earned);
  }, [artists, bookings, rentals, inRange, matches]);

  /* -------------------------------------------- report: customers & dues */

  const customerRows = useMemo(() => {
    const map = new Map<string, {
      name: string; phone: string; bookings: number; rentals: number; orders: number;
      billed: number; advance: number; outstanding: number; last: string;
    }>();

    const touch = (phone: string, name: string) => {
      const key = (phone || name).trim();
      if (!map.has(key)) {
        map.set(key, { name, phone, bookings: 0, rentals: 0, orders: 0, billed: 0, advance: 0, outstanding: 0, last: '' });
      }
      return map.get(key)!;
    };

    bookings.filter((b) => inRange(b.event_date)).forEach((b) => {
      const row = touch(b.customer_phone, b.customer_name);
      row.bookings += 1;
      if (!DEAD_BOOKING.includes(b.status)) {
        row.billed += Number(b.amount ?? 0);
        row.advance += Number(b.advance_amount ?? 0);
        row.outstanding += Number(b.balance_amount ?? 0);
      }
      if (b.event_date > row.last) row.last = b.event_date;
    });

    rentals.filter((r) => inRange(r.start_date)).forEach((r) => {
      const row = touch(r.customer_phone, r.customer_name);
      row.rentals += 1;
      if (!DEAD_BOOKING.includes(r.status)) {
        row.billed += Number(r.total_amount ?? 0);
        row.advance += Number(r.advance_amount ?? 0);
        row.outstanding += Number(r.balance_amount ?? 0);
      }
      if (r.start_date > row.last) row.last = r.start_date;
    });

    orders.filter((o) => inRange(dayOf(o.created_at))).forEach((o) => {
      const row = touch(o.customer_phone, o.customer_name);
      row.orders += 1;
      if (o.status !== 'cancelled') {
        row.billed += Number(o.total_amount ?? 0);
        row.advance += Number(o.advance_amount ?? 0);
        row.outstanding += Number(o.balance_amount ?? 0);
      }
      const d = dayOf(o.created_at);
      if (d > row.last) row.last = d;
    });

    return [...map.values()]
      .filter((c) => matches(c.name, c.phone))
      .sort((a, b) => b.billed - a.billed);
  }, [bookings, rentals, orders, inRange, matches]);

  /* ------------------------------------------------- report: revenue by month */

  const revenueRows = useMemo(() => {
    const map = new Map<string, { month: string; tying: number; rental: number; deposits: number; sales: number; collected: number; outstanding: number }>();
    const bucket = (iso: string) => {
      const m = iso.slice(0, 7);
      if (!map.has(m)) map.set(m, { month: m, tying: 0, rental: 0, deposits: 0, sales: 0, collected: 0, outstanding: 0 });
      return map.get(m)!;
    };

    bookings.filter((b) => inRange(b.event_date) && !DEAD_BOOKING.includes(b.status)).forEach((b) => {
      const row = bucket(b.event_date);
      row.tying += Number(b.amount ?? 0);
      if (PAID_STATES.includes(b.payment_status ?? '')) row.collected += Number(b.advance_amount ?? 0);
      row.outstanding += Number(b.balance_amount ?? 0);
    });

    rentals.filter((r) => inRange(r.start_date) && !DEAD_BOOKING.includes(r.status)).forEach((r) => {
      const row = bucket(r.start_date);
      row.rental += Number(r.rent_amount ?? 0) + Number(r.artist_amount ?? 0);
      row.deposits += Number(r.deposit_amount ?? 0);
      if (PAID_STATES.includes(r.payment_status)) row.collected += Number(r.advance_amount ?? 0);
      row.outstanding += Number(r.balance_amount ?? 0);
    });

    orders.filter((o) => inRange(dayOf(o.created_at)) && o.status !== 'cancelled').forEach((o) => {
      const row = bucket(dayOf(o.created_at));
      row.sales += Number(o.total_amount ?? 0);
      if (PAID_STATES.includes(o.payment_status ?? '')) row.collected += Number(o.advance_amount ?? 0);
      row.outstanding += Number(o.balance_amount ?? 0);
    });

    return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
  }, [bookings, rentals, orders, inRange]);

  const revenueTotals = useMemo(
    () =>
      revenueRows.reduce(
        (a, r) => ({
          tying: a.tying + r.tying, rental: a.rental + r.rental, deposits: a.deposits + r.deposits,
          sales: a.sales + r.sales, collected: a.collected + r.collected, outstanding: a.outstanding + r.outstanding,
        }),
        { tying: 0, rental: 0, deposits: 0, sales: 0, collected: 0, outstanding: 0 }
      ),
    [revenueRows]
  );

  /* ------------------------------------------------- report: profit & loss */

  const pnlRows = useMemo(() => {
    const map = new Map<string, { month: string; revenue: number; expense: number }>();
    const bucket = (iso: string) => {
      const m = iso.slice(0, 7);
      if (!map.has(m)) map.set(m, { month: m, revenue: 0, expense: 0 });
      return map.get(m)!;
    };

    revenueRows.forEach((r) => { bucket(`${r.month}-01`).revenue += r.tying + r.rental + r.sales; });
    expenses.filter((e) => inRange(e.expense_date)).forEach((e) => {
      bucket(e.expense_date).expense += Number(e.amount ?? 0);
    });

    return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
  }, [revenueRows, expenses, inRange]);

  const pnlTotals = useMemo(
    () => pnlRows.reduce((a, r) => ({ revenue: a.revenue + r.revenue, expense: a.expense + r.expense }),
      { revenue: 0, expense: 0 }),
    [pnlRows]
  );

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses.filter((e) => inRange(e.expense_date))
      .forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount ?? 0)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses, inRange]);

  /* -------------------------------------------------- report: lead source */

  const sourceRows = useMemo(() => {
    const map = new Map<string, { source: string; bookings: number; rentals: number; orders: number; revenue: number }>();
    const bucket = (src: string | null | undefined) => {
      const key = (src ?? '').trim() || 'Not recorded';
      if (!map.has(key)) map.set(key, { source: key, bookings: 0, rentals: 0, orders: 0, revenue: 0 });
      return map.get(key)!;
    };

    bookings.filter((b) => inRange(b.event_date) && !DEAD_BOOKING.includes(b.status)).forEach((b) => {
      const row = bucket((b as BookingRow & { lead_source?: string | null }).lead_source);
      row.bookings += 1;
      row.revenue += Number(b.amount ?? 0);
    });
    rentals.filter((r) => inRange(r.start_date) && !DEAD_BOOKING.includes(r.status)).forEach((r) => {
      const row = bucket((r as RentalRow & { lead_source?: string | null }).lead_source);
      row.rentals += 1;
      row.revenue += Number(r.total_amount ?? 0);
    });
    orders.filter((o) => inRange(dayOf(o.created_at)) && o.status !== 'cancelled').forEach((o) => {
      const row = bucket((o as OrderRow & { lead_source?: string | null }).lead_source);
      row.orders += 1;
      row.revenue += Number(o.total_amount ?? 0);
    });

    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [bookings, rentals, orders, inRange]);

  const sourceTotals = useMemo(
    () => sourceRows.reduce(
      (a, r) => ({ jobs: a.jobs + r.bookings + r.rentals + r.orders, revenue: a.revenue + r.revenue }),
      { jobs: 0, revenue: 0 }
    ),
    [sourceRows]
  );

  /* --------------------------------------------------------------- export */

  const exportCSV = () => {
    const stamp = report === 'control' || report === 'ops' ? onDate : `${from}_to_${to}`;
    const name = `safaking-${report}-${stamp}.csv`;

    if (report === 'ops') {
      downloadCSV(name,
        ['Ref', 'Customer', 'Mobile', 'Type', 'When', 'Location', 'Service', 'Qty', 'Artist', 'Artist Mobile', 'Payment', 'Status'],
        opsRows.map((x) => [x.ref, x.customer, x.phone, x.type, x.when, x.place, x.service, x.qty, x.artist, x.artistPhone, x.pay, x.status]));
    } else if (report === 'bookings') {
      downloadCSV(name,
        ['Ref', 'Booked On', 'Event Date', 'Customer', 'Phone', 'Venue', 'Style', 'Safas', 'Artist', 'Amount', 'Advance', 'Balance', 'Payment', 'Status'],
        bookingRows.map((b) => [shortRef(b.id), dayOf(b.created_at), b.event_date, b.customer_name, b.customer_phone,
          cleanVenue(b.city_venue), b.safa_style, countFromVenue(b.city_venue), b.artist_name ?? '', b.amount,
          b.advance_amount ?? 0, b.balance_amount ?? 0, b.payment_status ?? '', b.status]));
    } else if (report === 'rentals') {
      downloadCSV(name,
        ['Ref', 'Customer', 'Phone', 'Start', 'End', 'Days', 'Safas', 'City', 'Artist', 'Rent', 'Deposit', 'Total', 'Advance', 'Balance', 'Payment', 'Status'],
        rentalRows.map((r) => [shortRef(r.id), r.customer_name, r.customer_phone, r.start_date, r.end_date, r.rental_days,
          r.safa_count, r.city ?? r.pincode, r.artist_name ?? '', r.rent_amount, r.deposit_amount, r.total_amount,
          r.advance_amount, r.balance_amount, r.payment_status, r.status]));
    } else if (report === 'artists') {
      downloadCSV(name,
        ['Artist', 'City', 'KYC', 'Rating', 'Jobs', 'Completed', 'Cancelled/Declined', 'Customer Revenue', 'Artist Earned', 'Paid', 'Still Payable'],
        artistRows.map((x) => [x.artist.display_name, x.artist.base_city ?? '', x.artist.verification_status ?? '',
          x.artist.rating ?? '', x.jobs, x.completed, x.lost, x.customerRevenue, x.earned, x.paid, x.payable]));
    } else if (report === 'customers') {
      downloadCSV(name,
        ['Customer', 'Phone', 'Bookings', 'Rentals', 'Orders', 'Billed', 'Advance Paid', 'Outstanding', 'Last Activity'],
        customerRows.map((c) => [c.name, c.phone, c.bookings, c.rentals, c.orders, c.billed, c.advance, c.outstanding, c.last]));
    } else if (report === 'pnl') {
      downloadCSV(name,
        ['Month', 'Revenue', 'Expenses', 'Net Profit'],
        pnlRows.map((r) => [r.month, r.revenue, r.expense, r.revenue - r.expense]));
    } else if (report === 'sources') {
      downloadCSV(name,
        ['Source', 'Bookings', 'Rentals', 'Orders', 'Revenue', 'Share %'],
        sourceRows.map((r) => [r.source, r.bookings, r.rentals, r.orders, r.revenue,
          sourceTotals.revenue > 0 ? Math.round((r.revenue / sourceTotals.revenue) * 100) : 0]));
    } else if (report === 'revenue') {
      downloadCSV(name,
        ['Month', 'Safa Tying', 'Rental', 'Deposits Held', 'Product Sales', 'Total Revenue', 'Collected', 'Outstanding'],
        revenueRows.map((r) => [r.month, r.tying, r.rental, r.deposits, r.sales, r.tying + r.rental + r.sales, r.collected, r.outstanding]));
    } else {
      downloadCSV(name,
        ['Metric', 'Value'],
        [
          ["Today's bookings", control.todayCount], ["Tomorrow's bookings", control.tomorrowCount],
          ['Pending (no artist yet)', control.pendingCount], ['Cancelled', control.cancelledCount],
          ['Artists required', control.required], ['Assigned', control.assigned], ['Unassigned', control.unassigned],
          ['Advance recorded', control.collectedToday], ['Pending collection', control.pendingCollection],
          ['Rental deliveries', control.deliveryToday], ['Rental returns due', control.returnToday],
          ['Overdue returns', control.overdueReturns],
        ]);
    }
  };

  /* ----------------------------------------------------------------- view */

  const rangeLabel = report === 'control' || report === 'ops'
    ? new Date(`${onDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : `${from} to ${to}`;

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-amber-200/60 p-12 text-center">
        <Loader2 size={26} className="animate-spin mx-auto mb-3 text-amber-500" />
        <p className="text-sm font-bold text-gray-600">Building your reports…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 no-print">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {/* Report picker */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 no-print">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const on = report === r.id;
          return (
            <button
              key={r.id}
              onClick={() => { setReport(r.id); setSearch(''); setStatusFilter('all'); }}
              className={`group text-left p-3.5 rounded-2xl border transition-all duration-150 ${
                on
                  ? 'bg-maroon-950 border-maroon-950 shadow-lg shadow-maroon-950/20'
                  : 'bg-white border-amber-200/70 hover:border-royal-300 hover:shadow-sm'
              }`}
            >
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                on ? 'bg-royal-400/20 text-royal-300' : 'bg-royal-50 text-royal-600 group-hover:bg-royal-100'
              }`}>
                <Icon size={15} />
              </span>
              <p className={`font-bold text-[12px] mt-2 leading-tight ${on ? 'text-royal-100' : 'text-maroon-950'}`}>
                {r.label}
              </p>
              <p className={`text-[10px] mt-0.5 leading-snug ${on ? 'text-royal-200/60' : 'text-gray-500'}`}>
                {r.hint}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-2xl bg-white border border-amber-200/70 no-print">
        {report === 'control' || report === 'ops' ? (
          <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">
            Date
            <input
              type="date" value={onDate} onChange={(e) => setOnDate(e.target.value)}
              className="block mt-1 px-3 py-2 rounded-xl border border-amber-200/70 text-xs font-bold text-maroon-950"
            />
          </label>
        ) : report !== 'analytics' ? (
          <>
            <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="block mt-1 px-3 py-2 rounded-xl border border-amber-200/70 text-xs font-bold text-maroon-950" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="block mt-1 px-3 py-2 rounded-xl border border-amber-200/70 text-xs font-bold text-maroon-950" />
            </label>
          </>
        ) : null}

        {report !== 'analytics' && report !== 'control' && report !== 'pnl' && report !== 'sources' && (
          <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 flex-1 min-w-[12rem]">
            Search
            <span className="relative block mt-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Customer, phone, artist, venue…"
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-amber-200/70 text-xs font-medium text-maroon-950"
              />
            </span>
          </label>
        )}

        {(report === 'bookings' || report === 'rentals') && (
          <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="block mt-1 px-3 py-2 rounded-xl border border-amber-200/70 text-xs font-bold text-maroon-950">
              <option value="all">All</option>
              {(report === 'bookings'
                ? ['pending', 'offered', 'assigned', 'declined', 'completed', 'cancelled']
                : ['pending', 'confirmed', 'dispatched', 'active', 'returned', 'completed', 'cancelled']
              ).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={load} title="Reload data"
            className="px-3 py-2 rounded-xl bg-white border border-amber-200/70 hover:bg-amber-50 text-[11px] font-bold text-maroon-900 flex items-center gap-1.5">
            <RefreshCw size={13} /> Refresh
          </button>
          {report !== 'analytics' && (
            <button onClick={exportCSV}
              className="px-3 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[11px] font-bold flex items-center gap-1.5">
              <Download size={13} /> Excel / CSV
            </button>
          )}
          <button onClick={() => window.print()}
            className="px-3 py-2 rounded-xl bg-maroon-950 hover:bg-maroon-900 text-royal-300 text-[11px] font-bold flex items-center gap-1.5">
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- printable area */}
      <div id="report-print-area" className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden print:border-0 print:shadow-none print:rounded-none">
        <div className="relative px-7 py-6 bg-gradient-to-r from-maroon-950 via-maroon-900 to-maroon-950 overflow-hidden">
          <span className="absolute inset-0 pattern-diamond opacity-[0.07] pointer-events-none" />
          <div className="relative flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-royal-400/70">SafaKing</p>
              <h2 className="font-display font-black text-2xl text-royal-100 mt-1">{current.label}</h2>
              <p className="text-[11px] text-royal-200/60 mt-1">{current.hint}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold text-royal-200">{rangeLabel}</p>
              <p className="text-[10px] text-royal-200/50 mt-0.5">
                Generated {generatedAt} · {adminName}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {report === 'control' && (
            <div className="space-y-6">
              <section>
                <SectionTitle>Bookings</SectionTitle>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat label="Today's bookings" value={control.todayCount} />
                  <Stat label="Tomorrow's bookings" value={control.tomorrowCount} />
                  <Stat label="Pending (no artist yet)" value={control.pendingCount} tone={control.pendingCount ? 'warn' : 'plain'} />
                  <Stat label="Cancelled today" value={control.cancelledCount} tone={control.cancelledCount ? 'bad' : 'plain'} />
                </div>
              </section>

              <section>
                <SectionTitle>Artists</SectionTitle>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Stat label="Artists required" value={control.required} />
                  <Stat label="Assigned" value={control.assigned} tone="good" />
                  <Stat label="Unassigned" value={control.unassigned} tone={control.unassigned ? 'bad' : 'good'} />
                </div>
              </section>

              <section>
                <SectionTitle>Payment</SectionTitle>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Stat label="Advance recorded today" value={money(control.collectedToday)} tone="good" />
                  <Stat label="Pending collection (all live jobs)" value={money(control.pendingCollection)} tone={control.pendingCollection ? 'warn' : 'plain'} />
                  <Stat label="Refunds today" value={control.refunded} />
                </div>
              </section>

              <section>
                <SectionTitle>Rental</SectionTitle>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Stat label="Deliveries today" value={control.deliveryToday} />
                  <Stat label="Returns due today" value={control.returnToday} />
                  <Stat label="Overdue returns" value={control.overdueReturns} tone={control.overdueReturns ? 'bad' : 'plain'} />
                </div>
              </section>

              <section>
                <SectionTitle>Action required</SectionTitle>
                {control.actions.length === 0 ? (
                  <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                    Nothing outstanding — every job for this date has an artist, and no returns are overdue.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {control.actions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-maroon-900 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                        <span className="font-black">{i + 1}.</span> {a}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          )}

          {report === 'ops' && (
            <Table
              headers={['Ref', 'Customer', 'Mobile', 'Type', 'When', 'Location', 'Service', 'Qty', 'Artist', 'Artist Mobile', 'Payment', 'Status']}
              empty="No jobs scheduled for this date."
              rows={opsRows.map((x) => [
                <span key="r" className="font-mono font-bold">{x.ref}</span>,
                <span key="c" className="font-bold text-maroon-950">{x.customer}</span>,
                x.phone, x.type, x.when, x.place, x.service, x.qty,
                <span key="a" className={x.artist.includes('UNASSIGNED') ? 'font-black text-rose-700' : 'font-bold'}>{x.artist}</span>,
                x.artistPhone,
                <span key="p" className="capitalize">{(x.pay ?? '').replace(/_/g, ' ')}</span>,
                <span key="s" className="capitalize font-bold">{x.status}</span>,
              ])}
            />
          )}

          {report === 'bookings' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <Stat label="Bookings" value={bookingRows.length} />
                <Stat label="Billed" value={money(bookingTotals.amount)} />
                <Stat label="Advance" value={money(bookingTotals.advance)} tone="good" />
                <Stat label="Balance due" value={money(bookingTotals.balance)} tone={bookingTotals.balance ? 'warn' : 'plain'} />
              </div>
              <Table
                headers={['Ref', 'Booked', 'Event Date', 'Customer', 'Phone', 'Venue', 'Style', 'Safas', 'Artist', 'Amount', 'Advance', 'Balance', 'Payment', 'Status']}
                empty="No bookings in this range."
                rows={bookingRows.map((b) => [
                  <span key="r" className="font-mono font-bold">{shortRef(b.id)}</span>,
                  dayOf(b.created_at), b.event_date,
                  <span key="c" className="font-bold text-maroon-950">{b.customer_name}</span>,
                  b.customer_phone, cleanVenue(b.city_venue), b.safa_style, countFromVenue(b.city_venue),
                  b.artist_name ?? <span key="u" className="text-rose-700 font-bold">Unassigned</span>,
                  money(b.amount), money(b.advance_amount), money(b.balance_amount),
                  <span key="p" className="capitalize">{(b.payment_status ?? '').replace(/_/g, ' ')}</span>,
                  <span key="s" className="capitalize font-bold">{b.status}</span>,
                ])}
              />
            </>
          )}

          {report === 'rentals' && (
            <Table
              headers={['Ref', 'Customer', 'Phone', 'Start', 'End', 'Days', 'Safas', 'City', 'Artist', 'Rent', 'Deposit', 'Total', 'Balance', 'Status']}
              empty="No rentals in this range."
              rows={rentalRows.map((r) => {
                const overdue = ['dispatched', 'active'].includes(r.status) && r.end_date < todayISO();
                return [
                  <span key="r" className="font-mono font-bold">{shortRef(r.id)}</span>,
                  <span key="c" className="font-bold text-maroon-950">{r.customer_name}</span>,
                  r.customer_phone, r.start_date,
                  <span key="e" className={overdue ? 'font-black text-rose-700' : ''}>{r.end_date}{overdue ? ' ⚠' : ''}</span>,
                  r.rental_days, r.safa_count, r.city ?? r.pincode, r.artist_name ?? '—',
                  money(r.rent_amount), money(r.deposit_amount), money(r.total_amount), money(r.balance_amount),
                  <span key="s" className="capitalize font-bold">{r.status}</span>,
                ];
              })}
            />
          )}

          {report === 'artists' && (
            <Table
              headers={['Artist', 'City', 'KYC', 'Rating', 'Jobs', 'Completed', 'Lost', 'Customer Revenue', 'Artist Earned', 'Paid', 'Still Payable']}
              empty="No artists to report on."
              rows={artistRows.map((x) => [
                <span key="n" className="font-bold text-maroon-950">{x.artist.display_name}</span>,
                x.artist.base_city ?? '—',
                <span key="k" className={x.artist.verification_status === 'verified' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                  {x.artist.verification_status === 'verified' ? 'Verified' : 'Not verified'}
                </span>,
                x.artist.total_events > 0 && x.artist.rating != null ? `${x.artist.rating.toFixed(1)} ★` : 'New',
                x.jobs, x.completed,
                <span key="l" className={x.lost ? 'text-rose-700 font-bold' : ''}>{x.lost}</span>,
                money(x.customerRevenue), money(x.earned), money(x.paid),
                <span key="p" className={x.payable ? 'font-black text-amber-800' : ''}>{money(x.payable)}</span>,
              ])}
            />
          )}

          {report === 'customers' && (
            <Table
              headers={['Customer', 'Phone', 'Bookings', 'Rentals', 'Orders', 'Billed', 'Advance Paid', 'Outstanding', 'Last Activity']}
              empty="No customer activity in this range."
              rows={customerRows.map((c) => [
                <span key="n" className="font-bold text-maroon-950">{c.name}</span>,
                c.phone, c.bookings, c.rentals, c.orders, money(c.billed), money(c.advance),
                <span key="o" className={c.outstanding ? 'font-black text-amber-800' : ''}>{money(c.outstanding)}</span>,
                c.last || '—',
              ])}
            />
          )}

          {report === 'revenue' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <Stat label="Total revenue" value={money(revenueTotals.tying + revenueTotals.rental + revenueTotals.sales)} />
                <Stat label="Collected (advance)" value={money(revenueTotals.collected)} tone="good" />
                <Stat label="Outstanding" value={money(revenueTotals.outstanding)} tone={revenueTotals.outstanding ? 'warn' : 'plain'} />
                <Stat label="Deposits held" value={money(revenueTotals.deposits)} />
              </div>
              <Table
                headers={['Month', 'Safa Tying', 'Rental', 'Deposits Held', 'Product Sales', 'Total', 'Collected', 'Outstanding']}
                empty="No revenue recorded in this range."
                rows={[
                  ...revenueRows.map((r) => [
                    <span key="m" className="font-bold text-maroon-950">{r.month}</span>,
                    money(r.tying), money(r.rental), money(r.deposits), money(r.sales),
                    <span key="t" className="font-black">{money(r.tying + r.rental + r.sales)}</span>,
                    money(r.collected), money(r.outstanding),
                  ]),
                  ...(revenueRows.length > 0 ? [[
                    <span key="tt" className="font-black uppercase text-[10px] tracking-wider">Total</span>,
                    <span key="a" className="font-black">{money(revenueTotals.tying)}</span>,
                    <span key="b" className="font-black">{money(revenueTotals.rental)}</span>,
                    <span key="c" className="font-black">{money(revenueTotals.deposits)}</span>,
                    <span key="d" className="font-black">{money(revenueTotals.sales)}</span>,
                    <span key="e" className="font-black">{money(revenueTotals.tying + revenueTotals.rental + revenueTotals.sales)}</span>,
                    <span key="f" className="font-black">{money(revenueTotals.collected)}</span>,
                    <span key="g" className="font-black">{money(revenueTotals.outstanding)}</span>,
                  ]] : []),
                ]}
              />
            </>
          )}

          {report === 'pnl' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <Stat label="Revenue" value={money(pnlTotals.revenue)} tone="good" note="Tying + rental + product sales" />
                <Stat label="Expenses" value={money(pnlTotals.expense)} tone="bad" note="Everything recorded in the Expenses tab" />
                <Stat
                  label="Net profit"
                  value={money(pnlTotals.revenue - pnlTotals.expense)}
                  tone={pnlTotals.revenue - pnlTotals.expense >= 0 ? 'good' : 'bad'}
                  note={pnlTotals.revenue > 0
                    ? `${Math.round(((pnlTotals.revenue - pnlTotals.expense) / pnlTotals.revenue) * 100)}% margin`
                    : undefined}
                />
              </div>

              {expenses.length === 0 && (
                <div className="flex items-start gap-2.5 p-4 mb-5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">
                    No expenses recorded yet, so this is revenue only. Add them under the
                    <span className="font-black"> Expenses </span> tab and the profit line becomes real.
                  </p>
                </div>
              )}

              <SectionTitle>Month by month</SectionTitle>
              <Table
                headers={['Month', 'Revenue', 'Expenses', 'Net Profit', 'Margin']}
                empty="Nothing recorded in this range."
                rows={[
                  ...pnlRows.map((r) => {
                    const net = r.revenue - r.expense;
                    return [
                      <span key="m" className="font-bold text-maroon-950">{r.month}</span>,
                      money(r.revenue), money(r.expense),
                      <span key="n" className={net >= 0 ? 'font-black text-emerald-800' : 'font-black text-rose-800'}>
                        {money(net)}
                      </span>,
                      r.revenue > 0 ? `${Math.round((net / r.revenue) * 100)}%` : '—',
                    ];
                  }),
                  ...(pnlRows.length > 0 ? [[
                    <span key="t" className="font-black uppercase text-[10px] tracking-wider">Total</span>,
                    <span key="a" className="font-black">{money(pnlTotals.revenue)}</span>,
                    <span key="b" className="font-black">{money(pnlTotals.expense)}</span>,
                    <span key="c" className={`font-black ${pnlTotals.revenue - pnlTotals.expense >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                      {money(pnlTotals.revenue - pnlTotals.expense)}
                    </span>,
                    pnlTotals.revenue > 0 ? `${Math.round(((pnlTotals.revenue - pnlTotals.expense) / pnlTotals.revenue) * 100)}%` : '—',
                  ]] : []),
                ]}
              />

              {expenseByCategory.length > 0 && (
                <div className="mt-7">
                  <SectionTitle>Where the money went</SectionTitle>
                  <Table
                    headers={['Category', 'Amount', 'Share']}
                    empty="No expenses in this range."
                    rows={expenseByCategory.map(([cat, sum]) => [
                      <span key="c" className="font-bold text-maroon-950">{EXPENSE_LABEL[cat] ?? cat}</span>,
                      money(sum),
                      pnlTotals.expense > 0 ? `${Math.round((sum / pnlTotals.expense) * 100)}%` : '—',
                    ])}
                  />
                </div>
              )}
            </>
          )}

          {report === 'sources' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                <Stat label="Jobs in range" value={sourceTotals.jobs} />
                <Stat label="Revenue" value={money(sourceTotals.revenue)} tone="good" />
                <Stat
                  label="Source recorded"
                  value={`${sourceTotals.jobs > 0
                    ? Math.round(((sourceTotals.jobs - (sourceRows.find((r) => r.source === 'Not recorded')
                        ? sourceRows.find((r) => r.source === 'Not recorded')!.bookings
                          + sourceRows.find((r) => r.source === 'Not recorded')!.rentals
                          + sourceRows.find((r) => r.source === 'Not recorded')!.orders
                        : 0)) / sourceTotals.jobs) * 100)
                    : 0}%`}
                  note="Older bookings have no source — the field is new"
                />
              </div>

              <Table
                headers={['Source', 'Bookings', 'Rentals', 'Orders', 'Revenue', 'Share']}
                empty="No activity in this range."
                rows={sourceRows.map((r) => {
                  const share = sourceTotals.revenue > 0 ? Math.round((r.revenue / sourceTotals.revenue) * 100) : 0;
                  const unknown = r.source === 'Not recorded';
                  return [
                    <span key="s" className={unknown ? 'font-bold text-gray-400 italic' : 'font-bold text-maroon-950'}>
                      {r.source}
                    </span>,
                    r.bookings, r.rentals, r.orders, money(r.revenue),
                    <span key="p" className="inline-flex items-center gap-2 justify-end w-full">
                      <span className="hidden sm:block w-16 h-1.5 rounded-full bg-amber-100 overflow-hidden">
                        <span className="block h-full bg-maroon-800 rounded-full" style={{ width: `${share}%` }} />
                      </span>
                      <span className="font-bold">{share}%</span>
                    </span>,
                  ];
                })}
              />
            </>
          )}

          {report === 'analytics' && <AnalyticsPanel />}
        </div>
      </div>
    </div>
  );
}
