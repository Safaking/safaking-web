'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, AlertCircle, Printer, Download, RefreshCw, ClipboardList, Sunrise,
  Calendar, CalendarRange, Crown, Users, IndianRupee, TrendingUp, Search,
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

type ReportId =
  | 'control' | 'ops' | 'bookings' | 'rentals' | 'artists' | 'customers' | 'revenue' | 'analytics';

const REPORTS: { id: ReportId; label: string; hint: string; icon: typeof ClipboardList }[] = [
  { id: 'control', label: 'Daily Control Sheet', hint: 'One page — the whole day at a glance', icon: ClipboardList },
  { id: 'ops', label: 'Morning Operations Sheet', hint: 'Every job for a date, with artist & phone', icon: Sunrise },
  { id: 'bookings', label: 'Booking Register', hint: 'Artist bookings over a date range', icon: Calendar },
  { id: 'rentals', label: 'Rental Register', hint: 'Rentals, deposits & returns', icon: CalendarRange },
  { id: 'artists', label: 'Artist Performance & Payable', hint: 'Jobs, earnings, what we still owe', icon: Crown },
  { id: 'customers', label: 'Customer & Outstanding', hint: 'Who has booked, who still owes', icon: Users },
  { id: 'revenue', label: 'Revenue Summary', hint: 'Month by month, by business line', icon: IndianRupee },
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

function Stat({ label, value, tone = 'plain' }: { label: string; value: string | number; tone?: 'plain' | 'good' | 'warn' | 'bad' }) {
  const cls =
    tone === 'good' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
    : tone === 'warn' ? 'bg-amber-50 border-amber-300 text-amber-900'
    : tone === 'bad' ? 'bg-rose-50 border-rose-200 text-rose-900'
    : 'bg-white border-amber-200/70 text-maroon-950';
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <p className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</p>
      <p className="font-display font-black text-2xl mt-1">{value}</p>
    </div>
  );
}

const TH = 'px-3 py-2 text-[10px] font-black uppercase tracking-wider text-maroon-900/60 whitespace-nowrap';
const TD = 'px-3 py-2 text-[11px] text-gray-700 align-top';

function Table({ headers, rows, empty }: { headers: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-500">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-amber-50/70 border-y border-amber-200/70">
          <tr>{headers.map((h) => <th key={h} className={TH}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-amber-100">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-amber-50/40">
              {r.map((c, j) => <td key={j} className={TD}>{c}</td>)}
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
    const [b, r, o, a, p] = await Promise.all([
      supabase.from('artist_bookings').select('*').order('event_date', { ascending: false }),
      supabase.from('rental_bookings').select('*').order('start_date', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('artist_profiles').select('id, display_name, base_city, rating, total_events, verification_status, active, blacklisted'),
      supabase.from('profiles').select('id, full_name, phone, role'),
    ]);

    const firstError = b.error ?? r.error ?? o.error ?? a.error ?? p.error;
    if (firstError) setError(friendlyError(firstError));

    setBookings((b.data as BookingRow[]) ?? []);
    setRentals((r.data as RentalRow[]) ?? []);
    setOrders((o.data as OrderRow[]) ?? []);
    setArtists((a.data as ArtistRow[]) ?? []);
    setPeople((p.data as PersonRow[]) ?? []);
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 no-print">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const on = report === r.id;
          return (
            <button
              key={r.id}
              onClick={() => { setReport(r.id); setSearch(''); setStatusFilter('all'); }}
              title={r.hint}
              className={`text-left p-3 rounded-2xl border transition-all ${
                on ? 'bg-maroon-950 border-maroon-950 text-royal-200 shadow-md'
                   : 'bg-white border-amber-200/70 text-maroon-900 hover:border-amber-300'
              }`}
            >
              <Icon size={16} className={on ? 'text-royal-300' : 'text-amber-600'} />
              <p className="font-bold text-[11px] mt-1.5 leading-tight">{r.label}</p>
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

        {report !== 'analytics' && report !== 'control' && (
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
        <div className="px-6 py-5 border-b border-amber-100">
          <p className="font-display font-black text-lg text-maroon-950 uppercase tracking-wide">
            SafaKing — {current.label}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {rangeLabel} · generated {generatedAt} by {adminName}
          </p>
        </div>

        <div className="p-6">
          {report === 'control' && (
            <div className="space-y-6">
              <section>
                <p className="text-[10px] font-black uppercase tracking-widest text-maroon-900/50 mb-2">Bookings</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat label="Today's bookings" value={control.todayCount} />
                  <Stat label="Tomorrow's bookings" value={control.tomorrowCount} />
                  <Stat label="Pending (no artist yet)" value={control.pendingCount} tone={control.pendingCount ? 'warn' : 'plain'} />
                  <Stat label="Cancelled today" value={control.cancelledCount} tone={control.cancelledCount ? 'bad' : 'plain'} />
                </div>
              </section>

              <section>
                <p className="text-[10px] font-black uppercase tracking-widest text-maroon-900/50 mb-2">Artists</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Stat label="Artists required" value={control.required} />
                  <Stat label="Assigned" value={control.assigned} tone="good" />
                  <Stat label="Unassigned" value={control.unassigned} tone={control.unassigned ? 'bad' : 'good'} />
                </div>
              </section>

              <section>
                <p className="text-[10px] font-black uppercase tracking-widest text-maroon-900/50 mb-2">Payment</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Stat label="Advance recorded today" value={money(control.collectedToday)} tone="good" />
                  <Stat label="Pending collection (all live jobs)" value={money(control.pendingCollection)} tone={control.pendingCollection ? 'warn' : 'plain'} />
                  <Stat label="Refunds today" value={control.refunded} />
                </div>
              </section>

              <section>
                <p className="text-[10px] font-black uppercase tracking-widest text-maroon-900/50 mb-2">Rental</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Stat label="Deliveries today" value={control.deliveryToday} />
                  <Stat label="Returns due today" value={control.returnToday} />
                  <Stat label="Overdue returns" value={control.overdueReturns} tone={control.overdueReturns ? 'bad' : 'plain'} />
                </div>
              </section>

              <section>
                <p className="text-[10px] font-black uppercase tracking-widest text-maroon-900/50 mb-2">Action required</p>
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

          {report === 'analytics' && <AnalyticsPanel />}
        </div>
      </div>
    </div>
  );
}
