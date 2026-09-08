'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, friendlyError } from '@/lib/supabase';
import type {
  BookingRow, RentalRow, OrderRow, ArtistRow, PersonRow, ExpenseRow,
  ComplaintRow, ReviewRow, CheckinRow, LeadRow, AuditRow,
} from './shared';

export interface ReportData {
  bookings: BookingRow[];
  rentals: RentalRow[];
  orders: OrderRow[];
  artists: ArtistRow[];
  people: PersonRow[];
  expenses: ExpenseRow[];
  complaints: ComplaintRow[];
  reviews: ReviewRow[];
  checkins: CheckinRow[];
  leads: LeadRow[];
  audit: AuditRow[];
  /** Latest check-in stage per job id. */
  stageByJob: Map<string, { stage: string; at: string }>;
  phoneOf: (artistId: string | null) => string;
  nameOf: (userId: string | null) => string;
  loading: boolean;
  error: string | null;
  missing: string[];
  generatedAt: string;
  reload: () => Promise<void>;
}

/** A table this build can work without says so, instead of blanking the tab. */
const OPTIONAL = ['expenses', 'complaints', 'audit_log', 'leads'];

/**
 * Everything the reports need, pulled once.
 *
 * The volumes here are small (hundreds of rows) and every report is a
 * different cut of the same facts, so one fetch keeps them mutually
 * consistent — two reports built from two queries taken seconds apart can
 * disagree, and a manager who spots that stops trusting all of them.
 */
export function useReportData(): ReportData {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [rentals, setRentals] = useState<RentalRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [generatedAt, setGeneratedAt] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [b, r, o, a, p, e, cm, rv, ci, ld, au] = await Promise.all([
      supabase.from('artist_bookings').select('*').order('event_date', { ascending: false }),
      supabase.from('rental_bookings').select('*').order('start_date', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('artist_profiles').select('id, display_name, base_city, rating, total_events, verification_status, active, blacklisted, per_safa_rate'),
      supabase.from('profiles').select('id, full_name, phone, email, role, created_at'),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('complaints').select('id, artist_id, customer_name, subject, status, severity, created_at'),
      supabase.from('reviews').select('id, subject_id, rating, comment, visible, created_at'),
      supabase.from('booking_checkins').select('booking_id, rental_id, artist_id, stage, created_at'),
      supabase.from('leads').select('id, customer_id, customer_name, pincode, event_date, safa_count, status, created_at'),
      supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(1000),
    ]);

    const isMissing = (err: { code?: string } | null) => err?.code === 'PGRST205' || err?.code === '42P01';
    const gone: string[] = [];
    const named: [string, { error: { code?: string; message?: string } | null }][] = [
      ['expenses', e], ['complaints', cm], ['audit_log', au], ['leads', ld],
    ];
    named.forEach(([name, res]) => { if (res.error && isMissing(res.error)) gone.push(name); });

    const hard = [b, r, o, a, p, rv, ci].find((x) => x.error)?.error
      ?? named.find(([name, res]) => res.error && !gone.includes(name))?.[1].error;
    if (hard) setError(friendlyError(hard));
    setMissing(gone);

    setBookings((b.data as BookingRow[]) ?? []);
    setRentals((r.data as RentalRow[]) ?? []);
    setOrders((o.data as OrderRow[]) ?? []);
    setArtists((a.data as ArtistRow[]) ?? []);
    setPeople((p.data as PersonRow[]) ?? []);
    setExpenses((e.data as ExpenseRow[]) ?? []);
    setComplaints((cm.data as ComplaintRow[]) ?? []);
    setReviews((rv.data as ReviewRow[]) ?? []);
    setCheckins((ci.data as CheckinRow[]) ?? []);
    setLeads((ld.data as LeadRow[]) ?? []);
    setAudit((au.data as AuditRow[]) ?? []);

    setGeneratedAt(new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }));
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const stageByJob = useMemo(() => {
    const map = new Map<string, { stage: string; at: string }>();
    [...checkins]
      .sort((x, y) => y.created_at.localeCompare(x.created_at))
      .forEach((c) => {
        const key = c.booking_id ?? c.rental_id;
        if (key && !map.has(key)) map.set(key, { stage: c.stage, at: c.created_at });
      });
    return map;
  }, [checkins]);

  const phoneOf = useCallback(
    (artistId: string | null) => (artistId ? people.find((x) => x.id === artistId)?.phone ?? '—' : '—'),
    [people]
  );

  const nameOf = useCallback(
    (userId: string | null) =>
      userId ? people.find((x) => x.id === userId)?.full_name ?? userId.slice(0, 8) : 'system',
    [people]
  );

  return {
    bookings, rentals, orders, artists, people, expenses, complaints, reviews,
    checkins, leads, audit, stageByJob, phoneOf, nameOf,
    loading, error, missing: missing.filter((m) => OPTIONAL.includes(m)), generatedAt, reload,
  };
}
