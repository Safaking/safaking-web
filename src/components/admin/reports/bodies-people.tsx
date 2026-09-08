'use client';

import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Stat, Table, SectionTitle, Caveat, money, dayOf, shortRef, daysSince,
  DEAD, countFromVenue, cleanVenue,
} from './shared';
import type { Ctx } from './ctx';

/** Hours from the artist's own check-ins; scheduled windows are not work done. */
export function hoursFrom(ctx: Ctx, ids: string[]) {
  const spans = new Map<string, { start?: number; end?: number }>();
  ctx.d.checkins.forEach((c) => {
    const key = c.booking_id ?? c.rental_id;
    if (!key || !ids.includes(key)) return;
    const span = spans.get(key) ?? {};
    const t = new Date(c.created_at).getTime();
    if (c.stage === 'started') span.start = Math.min(span.start ?? t, t);
    if (c.stage === 'completed') span.end = Math.max(span.end ?? t, t);
    spans.set(key, span);
  });
  let ms = 0;
  spans.forEach((s) => { if (s.start && s.end && s.end > s.start) ms += s.end - s.start; });
  return Math.round((ms / 3_600_000) * 10) / 10;
}

export interface ArtistStat {
  artistId: string; name: string; city: string | null; kyc: string | null;
  jobs: number; completed: number; lost: number; hours: number;
  customerRevenue: number; earned: number; paid: number; payable: number; platform: number;
  complaints: number; openComplaints: number; reviewCount: number; avgRating: number | null;
  utilisation: number;
}

/** Shared by the performance, ratings, payable and per-artist sheets. */
export function useArtistStats(ctx: Ctx): ArtistStat[] {
  const { d, inRange, matches } = ctx;
  return useMemo(() => {
    const rows = d.artists.map((a) => {
      const jobs = d.bookings.filter((b) => b.artist_id === a.id && inRange(b.event_date));
      const rentalJobs = d.rentals.filter((r) => r.artist_id === a.id && inRange(r.start_date));
      const completed = jobs.filter((b) => b.status === 'completed');
      const lost = jobs.filter((b) => DEAD.includes(b.status));
      const payoutOf = (b: (typeof jobs)[number]) => Number(b.artist_payout_amount ?? b.amount ?? 0);

      const earned = completed.reduce((s, b) => s + payoutOf(b), 0)
        + rentalJobs.filter((r) => ['returned', 'completed'].includes(r.status))
            .reduce((s, r) => s + Number(r.artist_amount ?? 0), 0);
      const paid = completed.filter((b) => b.payment_release_status === 'released')
        .reduce((s, b) => s + payoutOf(b), 0);
      const platform = jobs
        .filter((b) => !DEAD.includes(b.status) && b.artist_payout_amount != null)
        .reduce((s, b) => s + (Number(b.amount ?? 0) - Number(b.artist_payout_amount ?? 0)), 0);

      const theirComplaints = d.complaints.filter((c) => c.artist_id === a.id && inRange(dayOf(c.created_at)));
      const theirReviews = d.reviews.filter((r) => r.subject_id === a.id && r.visible);

      const live = jobs.filter((b) => !DEAD.includes(b.status)).length + rentalJobs.length;
      // Days in the window that this artist actually worked, as a share of
      // the window — a rough utilisation, honest about being rough.
      const workedDays = new Set([
        ...jobs.filter((b) => !DEAD.includes(b.status)).map((b) => b.event_date),
        ...rentalJobs.map((r) => r.start_date),
      ]).size;
      const windowDays = Math.max(1, Math.round(
        (new Date(ctx.to).getTime() - new Date(ctx.from).getTime()) / 86_400_000
      ) + 1);

      return {
        artistId: a.id, name: a.display_name, city: a.base_city, kyc: a.verification_status,
        jobs: live, completed: completed.length, lost: lost.length,
        hours: hoursFrom(ctx, [...jobs.map((b) => b.id), ...rentalJobs.map((r) => r.id)]),
        customerRevenue: jobs.filter((b) => !DEAD.includes(b.status)).reduce((s, b) => s + Number(b.amount ?? 0), 0),
        earned, paid, payable: Math.max(0, earned - paid), platform,
        complaints: theirComplaints.length,
        openComplaints: theirComplaints.filter((c) => !['resolved', 'dismissed'].includes(c.status)).length,
        reviewCount: theirReviews.length,
        avgRating: theirReviews.length > 0
          ? Math.round((theirReviews.reduce((s, r) => s + r.rating, 0) / theirReviews.length) * 10) / 10
          : a.total_events > 0 ? a.rating : null,
        utilisation: Math.round((workedDays / windowDays) * 100),
      };
    });
    return rows.filter((r) => matches(r.name, r.city)).sort((x, y) => y.earned - x.earned);
  }, [d, inRange, matches, ctx]);
}

/* --------------------------------------- R-08 / R-09 Artist performance -- */

export function ArtistPerformance({ ctx }: { ctx: Ctx }) {
  const rows = useArtistStats(ctx);
  const t = rows.reduce((a, r) => ({
    jobs: a.jobs + r.jobs, earned: a.earned + r.earned,
    platform: a.platform + r.platform, payable: a.payable + r.payable, hours: a.hours + r.hours,
  }), { jobs: 0, earned: 0, platform: 0, payable: 0, hours: 0 });

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Stat label="Jobs" value={t.jobs} />
        <Stat label="Hours worked" value={t.hours > 0 ? `${Math.round(t.hours)} h` : '—'} />
        <Stat label="Artist earnings" value={money(t.earned)} />
        <Stat label="SafaKing earned" value={money(t.platform)} tone="good" />
        <Stat label="Still payable" value={money(t.payable)} tone={t.payable ? 'warn' : 'plain'} />
      </div>
      <p className="text-[11px] text-gray-500 mb-3 no-print">
        Click a name for that artist&apos;s full sheet — every job, payment, complaint and review.
      </p>
      <Table
        headers={['Artist', 'City', 'KYC', 'Rating', 'Jobs', 'Done', 'Lost', 'Hours', 'Used %', 'Complaints', 'Customer Revenue', 'Earned', 'Paid', 'Payable']}
        empty="No artists to report on."
        rows={rows.map((x) => [
          <button key="n" onClick={() => ctx.openArtist(x.artistId)}
            className="font-bold text-maroon-950 hover:text-royal-700 underline decoration-royal-300 underline-offset-2 text-left flex items-center gap-1">
            {x.name} <ChevronRight size={11} />
          </button>,
          x.city ?? '—',
          <span key="k" className={x.kyc === 'verified' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
            {x.kyc === 'verified' ? 'Verified' : 'Not verified'}
          </span>,
          x.avgRating != null
            ? <span key="r" className={x.avgRating < 3 ? 'text-rose-700 font-black' : x.avgRating < 4 ? 'text-amber-700 font-black' : 'text-emerald-700 font-black'}>
                {x.avgRating.toFixed(1)} ★ <span className="text-gray-400 font-normal">({x.reviewCount})</span>
              </span>
            : 'New',
          x.jobs, x.completed,
          <span key="l" className={x.lost ? 'text-rose-700 font-bold' : ''}>{x.lost}</span>,
          x.hours > 0 ? `${x.hours} h` : '—',
          `${x.utilisation}%`,
          <span key="c" className={x.openComplaints ? 'text-rose-700 font-black' : ''}>
            {x.complaints}{x.openComplaints ? ` (${x.openComplaints} open)` : ''}
          </span>,
          money(x.customerRevenue), money(x.earned), money(x.paid),
          <span key="p" className={x.payable ? 'font-black text-amber-800' : ''}>{money(x.payable)}</span>,
        ])}
      />
    </>
  );
}

/* --------------------------------------------- R-10 Ratings & complaints - */

export function RatingsComplaints({ ctx }: { ctx: Ctx }) {
  const rows = useArtistStats(ctx);
  const { d } = ctx;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Rated artists" value={rows.filter((x) => x.reviewCount > 0).length} />
        <Stat label="Total reviews" value={rows.reduce((s, x) => s + x.reviewCount, 0)} />
        <Stat label="Below 4 stars" value={rows.filter((x) => x.reviewCount > 0 && (x.avgRating ?? 5) < 4).length}
          tone={rows.some((x) => x.reviewCount > 0 && (x.avgRating ?? 5) < 4) ? 'warn' : 'plain'} />
        <Stat label="Open complaints" value={rows.reduce((s, x) => s + x.openComplaints, 0)}
          tone={rows.some((x) => x.openComplaints > 0) ? 'bad' : 'good'} />
      </div>

      <SectionTitle>Standing, artist by artist</SectionTitle>
      <Table
        headers={['Artist', 'Rating', 'Reviews', 'Jobs', 'Cancellations', 'Complaints', 'Open', 'Standing']}
        empty="No artists to rate yet."
        rows={[...rows].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0)).map((x) => {
          const bad = (x.avgRating != null && x.avgRating < 3) || x.openComplaints > 1;
          const watch = (x.avgRating != null && x.avgRating < 4) || x.openComplaints > 0;
          return [
            <button key="n" onClick={() => ctx.openArtist(x.artistId)}
              className="font-bold text-maroon-950 underline decoration-royal-300 underline-offset-2 text-left">
              {x.name}
            </button>,
            x.avgRating != null ? `${x.avgRating.toFixed(1)} ★` : 'New',
            x.reviewCount, x.jobs,
            <span key="l" className={x.lost ? 'text-rose-700 font-bold' : ''}>{x.lost}</span>,
            x.complaints,
            <span key="o" className={x.openComplaints ? 'text-rose-700 font-black' : ''}>{x.openComplaints}</span>,
            <span key="s" className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
              bad ? 'bg-rose-100 text-rose-800' : watch ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>{bad ? 'Action needed' : watch ? 'Watch' : 'Good'}</span>,
          ];
        })}
      />

      {d.complaints.length > 0 && (
        <div className="mt-7">
          <SectionTitle>Every complaint, newest first</SectionTitle>
          <Table
            headers={['Date', 'Customer', 'About', 'Subject', 'Severity', 'Status', 'Days open']}
            empty="No complaints."
            rows={[...d.complaints]
              .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
              .map((c) => {
                const open = !['resolved', 'dismissed'].includes(c.status);
                const age = daysSince(c.created_at);
                return [
                  dayOf(c.created_at),
                  <span key="c" className="font-bold text-maroon-950">{c.customer_name}</span>,
                  d.artists.find((a) => a.id === c.artist_id)?.display_name ?? '—',
                  c.subject,
                  <span key="s" className={c.severity === 'high' ? 'text-rose-700 font-black uppercase' : 'capitalize'}>{c.severity}</span>,
                  <span key="st" className="capitalize font-bold">{c.status.replace(/_/g, ' ')}</span>,
                  open ? <span key="a" className={age > 3 ? 'font-black text-rose-700' : ''}>{age}</span> : '—',
                ];
              })}
          />
        </div>
      )}
    </>
  );
}

/* ------------------------------- R-11 / R-13 Customer master & dues ------ */

export interface CustomerStat {
  key: string; name: string; phone: string;
  bookings: number; rentals: number; orders: number;
  billed: number; advance: number; outstanding: number; first: string; last: string;
}

export function useCustomerStats(ctx: Ctx, ignoreRange = false): CustomerStat[] {
  const { d, inRange, matches } = ctx;
  return useMemo(() => {
    const map = new Map<string, CustomerStat>();
    const touch = (phone: string, name: string) => {
      const key = (phone || name).trim();
      if (!map.has(key)) {
        map.set(key, { key, name, phone, bookings: 0, rentals: 0, orders: 0, billed: 0, advance: 0, outstanding: 0, first: '', last: '' });
      }
      return map.get(key)!;
    };
    const mark = (row: CustomerStat, date: string) => {
      if (!date) return;
      if (!row.first || date < row.first) row.first = date;
      if (date > row.last) row.last = date;
    };

    d.bookings.filter((b) => ignoreRange || inRange(b.event_date)).forEach((b) => {
      const row = touch(b.customer_phone, b.customer_name);
      row.bookings += 1;
      if (!DEAD.includes(b.status)) {
        row.billed += Number(b.amount ?? 0);
        row.advance += Number(b.advance_amount ?? 0);
        row.outstanding += Number(b.balance_amount ?? 0);
      }
      mark(row, b.event_date);
    });

    d.rentals.filter((r) => ignoreRange || inRange(r.start_date)).forEach((r) => {
      const row = touch(r.customer_phone, r.customer_name);
      row.rentals += 1;
      if (!DEAD.includes(r.status)) {
        row.billed += Number(r.total_amount ?? 0);
        row.advance += Number(r.advance_amount ?? 0);
        row.outstanding += Number(r.balance_amount ?? 0);
      }
      mark(row, r.start_date);
    });

    d.orders.filter((o) => ignoreRange || inRange(dayOf(o.created_at))).forEach((o) => {
      const row = touch(o.customer_phone, o.customer_name);
      row.orders += 1;
      if (o.status !== 'cancelled') {
        row.billed += Number(o.total_amount ?? 0);
        row.advance += Number(o.advance_amount ?? 0);
        row.outstanding += Number(o.balance_amount ?? 0);
      }
      mark(row, dayOf(o.created_at));
    });

    return [...map.values()].filter((c) => matches(c.name, c.phone)).sort((a, b) => b.billed - a.billed);
  }, [d, inRange, matches, ignoreRange]);
}

export function CustomerMaster({ ctx }: { ctx: Ctx }) {
  const rows = useCustomerStats(ctx);
  const t = rows.reduce((a, c) => ({
    billed: a.billed + c.billed, advance: a.advance + c.advance, outstanding: a.outstanding + c.outstanding,
  }), { billed: 0, advance: 0, outstanding: 0 });

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Customers" value={rows.length} />
        <Stat label="Lifetime value" value={money(t.billed)} />
        <Stat label="Received" value={money(t.advance)} tone="good" />
        <Stat label="Outstanding" value={money(t.outstanding)} tone={t.outstanding ? 'warn' : 'plain'} />
      </div>
      <p className="text-[11px] text-gray-500 mb-3 no-print">
        Click a name for that customer&apos;s full booking history.
      </p>
      <Table
        headers={['Customer', 'Mobile', 'Bookings', 'Rentals', 'Orders', 'Billed', 'Paid', 'Outstanding', 'First seen', 'Last activity']}
        empty="No customer activity in this range."
        rows={rows.map((c) => [
          <button key="n" onClick={() => ctx.openCustomer(c.key)}
            className="font-bold text-maroon-950 underline decoration-royal-300 underline-offset-2 text-left flex items-center gap-1">
            {c.name} <ChevronRight size={11} />
          </button>,
          <a key="p" href={`tel:${c.phone}`} className="underline">{c.phone}</a>,
          c.bookings, c.rentals, c.orders, money(c.billed), money(c.advance),
          <span key="o" className={c.outstanding ? 'font-black text-amber-800' : ''}>{money(c.outstanding)}</span>,
          c.first || '—', c.last || '—',
        ])}
        footer={['Total', '', '', '', '', money(t.billed), money(t.advance), money(t.outstanding), '', '']}
      />
    </>
  );
}

/* ------------------------------ R-14 / R-43 Repeat & retention ----------- */

export function RepeatRetention({ ctx }: { ctx: Ctx }) {
  const rows = useCustomerStats(ctx, true);

  const jobsOf = (c: CustomerStat) => c.bookings + c.rentals + c.orders;
  const repeat = rows.filter((c) => jobsOf(c) > 1);
  const rate = rows.length > 0 ? Math.round((repeat.length / rows.length) * 100) : 0;

  const cohorts = useMemo(() => {
    const map = new Map<string, { month: string; customers: number; returned: number }>();
    rows.forEach((c) => {
      if (!c.first) return;
      const m = c.first.slice(0, 7);
      const e = map.get(m) ?? { month: m, customers: 0, returned: 0 };
      e.customers += 1;
      if (jobsOf(c) > 1) e.returned += 1;
      map.set(m, e);
    });
    return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
  }, [rows]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Customers ever" value={rows.length} />
        <Stat label="Came back" value={repeat.length} tone={repeat.length ? 'good' : 'plain'} />
        <Stat label="Repeat rate" value={`${rate}%`} />
        <Stat label="Repeat revenue" value={money(repeat.reduce((s, c) => s + c.billed, 0))} />
      </div>
      <Caveat>
        This one ignores the date filter on purpose — a repeat customer is defined across their
        whole history, not inside a window.
      </Caveat>

      <SectionTitle>Customers who came back</SectionTitle>
      <Table
        headers={['Customer', 'Mobile', 'Times booked', 'Lifetime value', 'First', 'Last', 'Gap (days)']}
        empty="Nobody has booked twice yet."
        rows={repeat.map((c) => [
          <button key="n" onClick={() => ctx.openCustomer(c.key)}
            className="font-bold text-maroon-950 underline decoration-royal-300 underline-offset-2 text-left">
            {c.name}
          </button>,
          c.phone, jobsOf(c), money(c.billed), c.first, c.last,
          c.first && c.last ? Math.round((new Date(c.last).getTime() - new Date(c.first).getTime()) / 86_400_000) : '—',
        ])}
      />

      <div className="mt-7">
        <SectionTitle>By the month they first arrived</SectionTitle>
        <Table
          headers={['First seen', 'New customers', 'Came back', 'Retention']}
          empty="No customers yet."
          rows={cohorts.map((c) => [
            <span key="m" className="font-bold text-maroon-950">{c.month}</span>,
            c.customers, c.returned,
            c.customers > 0 ? `${Math.round((c.returned / c.customers) * 100)}%` : '—',
          ])}
        />
      </div>
    </>
  );
}

/* --------------------------------------------------- R-36 Lead source ---- */

export function LeadSource({ ctx }: { ctx: Ctx }) {
  const { d, inRange } = ctx;

  const rows = useMemo(() => {
    const map = new Map<string, { source: string; bookings: number; rentals: number; orders: number; revenue: number }>();
    const bucket = (src: string | null | undefined) => {
      const key = (src ?? '').trim() || 'Not recorded';
      if (!map.has(key)) map.set(key, { source: key, bookings: 0, rentals: 0, orders: 0, revenue: 0 });
      return map.get(key)!;
    };

    d.bookings.filter((b) => inRange(b.event_date) && !DEAD.includes(b.status)).forEach((b) => {
      const row = bucket(b.lead_source); row.bookings += 1; row.revenue += Number(b.amount ?? 0);
    });
    d.rentals.filter((r) => inRange(r.start_date) && !DEAD.includes(r.status)).forEach((r) => {
      const row = bucket(r.lead_source); row.rentals += 1; row.revenue += Number(r.total_amount ?? 0);
    });
    d.orders.filter((o) => inRange(dayOf(o.created_at)) && o.status !== 'cancelled').forEach((o) => {
      const row = bucket(o.lead_source); row.orders += 1; row.revenue += Number(o.total_amount ?? 0);
    });

    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [d, inRange]);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalJobs = rows.reduce((s, r) => s + r.bookings + r.rentals + r.orders, 0);
  const unknown = rows.find((r) => r.source === 'Not recorded');
  const unknownJobs = unknown ? unknown.bookings + unknown.rentals + unknown.orders : 0;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <Stat label="Jobs in range" value={totalJobs} />
        <Stat label="Revenue" value={money(totalRevenue)} tone="good" />
        <Stat label="Source recorded"
          value={totalJobs > 0 ? `${Math.round(((totalJobs - unknownJobs) / totalJobs) * 100)}%` : '0%'}
          note="the field is new — older bookings have none" />
      </div>
      <Caveat>
        <b>Campaign ROI (R-38)</b> needs one more thing: marketing spend tagged to a campaign.
        Record an ad spend under <b>Expenses → Marketing</b> with the campaign name in the
        description, and the cost side becomes matchable to these bookings.
      </Caveat>
      <Table
        headers={['Source', 'Bookings', 'Rentals', 'Orders', 'Revenue', 'Share']}
        empty="No activity in this range."
        rows={rows.map((r) => {
          const share = totalRevenue > 0 ? Math.round((r.revenue / totalRevenue) * 100) : 0;
          const isUnknown = r.source === 'Not recorded';
          return [
            <span key="s" className={isUnknown ? 'font-bold text-gray-400 italic' : 'font-bold text-maroon-950'}>{r.source}</span>,
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
  );
}

/* ------------------------------------ R-37 / R-42 Booking funnel --------- */

export function Funnel({ ctx }: { ctx: Ctx }) {
  const { d, inRange } = ctx;

  const stages = useMemo(() => {
    const leads = d.leads.filter((l) => inRange(dayOf(l.created_at)));
    const quoted = leads.filter((l) => l.status !== 'open');
    const awarded = leads.filter((l) => l.status === 'awarded');
    const booked = d.bookings.filter((b) => inRange(b.event_date) && !DEAD.includes(b.status));
    const confirmed = booked.filter((b) => !!b.assignment_approved_at);
    const completed = booked.filter((b) => b.status === 'completed');

    return [
      { stage: 'Enquiries posted', count: leads.length, note: 'customers who asked for quotes' },
      { stage: 'Quoted by an artist', count: quoted.length, note: 'at least one artist responded' },
      { stage: 'Quote accepted', count: awarded.length, note: 'customer picked one' },
      { stage: 'Bookings taken', count: booked.length, note: 'includes direct bookings, not only marketplace' },
      { stage: 'Artist confirmed', count: confirmed.length, note: 'assignment approved by an admin' },
      { stage: 'Completed', count: completed.length, note: 'both codes verified' },
    ];
  }, [d, inRange]);

  const top = stages[0].count || 1;
  const booked = stages[3].count;
  const completed = stages[5].count;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <Stat label="Enquiry → booking"
          value={stages[0].count > 0 ? `${Math.round((stages[2].count / stages[0].count) * 100)}%` : '—'}
          note="marketplace only" />
        <Stat label="Booking → completed"
          value={booked > 0 ? `${Math.round((completed / booked) * 100)}%` : '—'} />
        <Stat label="Average booking value"
          value={booked > 0
            ? money(d.bookings.filter((b) => inRange(b.event_date) && !DEAD.includes(b.status))
                .reduce((s, b) => s + Number(b.amount ?? 0), 0) / booked)
            : '—'} />
      </div>

      <div className="space-y-2 mb-7">
        {stages.map((s) => (
          <div key={s.stage} className="flex flex-wrap items-center gap-3 p-3.5 rounded-2xl bg-white border border-amber-200/70">
            <div className="min-w-[11rem]">
              <p className="font-bold text-[13px] text-maroon-950">{s.stage}</p>
              <p className="text-[11px] text-gray-500">{s.note}</p>
            </div>
            <div className="flex-1 min-w-[8rem] h-3 rounded-full bg-amber-100 overflow-hidden">
              <div className="h-full bg-maroon-800 rounded-full transition-all"
                   style={{ width: `${Math.min(100, (s.count / top) * 100)}%` }} />
            </div>
            <p className="font-display font-black text-xl text-maroon-950 tabular-nums w-14 text-right">{s.count}</p>
          </div>
        ))}
      </div>

      <Caveat>
        The first three steps count marketplace enquiries only. A customer who books directly from
        the home page never appears as a lead, which is why &ldquo;bookings taken&rdquo; is larger
        than &ldquo;quote accepted&rdquo; rather than smaller.
      </Caveat>
    </>
  );
}

/* ------------------------------------------------- R-45 Audit log -------- */

const TABLE_LABEL: Record<string, string> = {
  artist_bookings: 'Booking', rental_bookings: 'Rental', orders: 'Shop order',
  expenses: 'Expense', complaints: 'Complaint', artist_profiles: 'Artist profile',
  profiles: 'User account', app_settings: 'Pricing setting',
};

export function AuditLog({ ctx }: { ctx: Ctx }) {
  const { d, inRange, matches } = ctx;

  const rows = useMemo(
    () => d.audit
      .filter((a) => inRange(dayOf(a.created_at)))
      .filter((a) => matches(
        TABLE_LABEL[a.table_name] ?? a.table_name,
        d.nameOf(a.actor_id),
        a.actor_role,
        Object.keys(a.changed ?? {}).join(' ')
      )),
    [d, inRange, matches]
  );

  const describe = (a: (typeof rows)[number]) => {
    if (a.action !== 'update' || !a.changed) {
      return a.action === 'insert' ? 'Created' : 'Deleted';
    }
    const keys = Object.keys(a.changed);
    return keys.slice(0, 4).map((k) => {
      const { from, to } = a.changed![k];
      const show = (v: unknown) => (v === null || v === '' ? '—' : String(v));
      return `${k.replace(/_/g, ' ')}: ${show(from)} → ${show(to)}`;
    }).join(' · ') + (keys.length > 4 ? ` (+${keys.length - 4} more)` : '');
  };

  if (d.missing.includes('audit_log')) {
    return (
      <Caveat>
        The audit log table does not exist yet. Run <b>supabase/031_audit_log.sql</b> and every
        change to a booking, payment, complaint, artist profile, user role or price will be
        recorded from that moment on — it cannot reconstruct history from before it was installed.
      </Caveat>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Changes recorded" value={rows.length} />
        <Stat label="By staff" value={rows.filter((a) => ['admin', 'manager'].includes(a.actor_role ?? '')).length} />
        <Stat label="Deletions" value={rows.filter((a) => a.action === 'delete').length}
          tone={rows.some((a) => a.action === 'delete') ? 'warn' : 'plain'} />
        <Stat label="Price changes" value={rows.filter((a) => a.table_name === 'app_settings').length} />
      </div>
      <Caveat>
        The log is append-only — there is no policy that lets anyone update or delete a row in it,
        including an admin. It starts from the moment the migration ran; nothing before that exists.
      </Caveat>
      <Table
        headers={['When', 'Who', 'Role', 'What', 'Record', 'Change']}
        empty="Nothing recorded in this range."
        rows={rows.map((a) => [
          <span key="w" className="whitespace-nowrap">{a.created_at.slice(0, 16).replace('T', ' ')}</span>,
          <span key="n" className="font-bold text-maroon-950">{d.nameOf(a.actor_id)}</span>,
          <span key="r" className="capitalize">{a.actor_role ?? '—'}</span>,
          TABLE_LABEL[a.table_name] ?? a.table_name,
          <span key="id" className="font-mono">{a.record_id ? shortRef(a.record_id) : String(a.snapshot?.key ?? '—')}</span>,
          <span key="c" className={`block max-w-[28rem] ${a.action === 'delete' ? 'text-rose-700 font-bold' : ''}`}>
            {describe(a)}
          </span>,
        ])}
      />
    </>
  );
}

/* ---------------------------------------- R-12 One customer's history ---- */

export function CustomerHistory({ ctx, customerKey }: { ctx: Ctx; customerKey: string }) {
  const { d } = ctx;

  const data = useMemo(() => {
    const keyOf = (phone: string, name: string) => (phone || name).trim();
    const bookings = d.bookings.filter((b) => keyOf(b.customer_phone, b.customer_name) === customerKey);
    const rentals = d.rentals.filter((r) => keyOf(r.customer_phone, r.customer_name) === customerKey);
    const orders = d.orders.filter((o) => keyOf(o.customer_phone, o.customer_name) === customerKey);
    const name = bookings[0]?.customer_name ?? rentals[0]?.customer_name ?? orders[0]?.customer_name ?? customerKey;
    const phone = bookings[0]?.customer_phone ?? rentals[0]?.customer_phone ?? orders[0]?.customer_phone ?? '';

    const billed = bookings.filter((b) => !DEAD.includes(b.status)).reduce((s, b) => s + Number(b.amount ?? 0), 0)
      + rentals.filter((r) => !DEAD.includes(r.status)).reduce((s, r) => s + Number(r.total_amount ?? 0), 0)
      + orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

    const outstanding = [...bookings, ...rentals].filter((x) => !DEAD.includes(x.status))
      .reduce((s, x) => s + Number(x.balance_amount ?? 0), 0)
      + orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.balance_amount ?? 0), 0);

    const complaints = d.complaints.filter((c) => c.customer_name === name);

    return { name, phone, bookings, rentals, orders, billed, outstanding, complaints };
  }, [d, customerKey]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Times booked" value={data.bookings.length + data.rentals.length + data.orders.length} />
        <Stat label="Lifetime value" value={money(data.billed)} tone="good" />
        <Stat label="Outstanding" value={money(data.outstanding)} tone={data.outstanding ? 'warn' : 'plain'} />
        <Stat label="Complaints raised" value={data.complaints.length}
          tone={data.complaints.length ? 'warn' : 'plain'} />
      </div>

      <div>
        <SectionTitle>Safa tying bookings</SectionTitle>
        <Table
          headers={['Ref', 'Event Date', 'Venue', 'Service', 'Safas', 'Artist', 'Total', 'Balance', 'Status']}
          empty="None."
          rows={data.bookings.map((b) => [
            <span key="r" className="font-mono font-bold">BK-{shortRef(b.id)}</span>,
            b.event_date, cleanVenue(b.city_venue), b.safa_style, countFromVenue(b.city_venue),
            b.artist_name ?? '—', money(b.amount), money(b.balance_amount),
            <span key="s" className="capitalize font-bold">{b.status}</span>,
          ])}
        />
      </div>

      {data.rentals.length > 0 && (
        <div>
          <SectionTitle>Rentals</SectionTitle>
          <Table
            headers={['Ref', 'Out', 'Due back', 'Safas', 'Total', 'Deposit', 'Balance', 'Status']}
            empty="None."
            rows={data.rentals.map((r) => [
              <span key="r" className="font-mono font-bold">RT-{shortRef(r.id)}</span>,
              r.start_date, r.end_date, r.safa_count, money(r.total_amount),
              money(r.deposit_amount), money(r.balance_amount),
              <span key="s" className="capitalize font-bold">{r.status}</span>,
            ])}
          />
        </div>
      )}

      {data.orders.length > 0 && (
        <div>
          <SectionTitle>Shop orders</SectionTitle>
          <Table
            headers={['Ref', 'Date', 'Total', 'Paid', 'Balance', 'Status']}
            empty="None."
            rows={data.orders.map((o) => [
              <span key="r" className="font-mono font-bold">OR-{shortRef(o.id)}</span>,
              dayOf(o.created_at), money(o.total_amount), money(o.advance_amount),
              money(o.balance_amount),
              <span key="s" className="capitalize font-bold">{o.status}</span>,
            ])}
          />
        </div>
      )}

      {data.complaints.length > 0 && (
        <div>
          <SectionTitle>Complaints</SectionTitle>
          <Table
            headers={['Date', 'Subject', 'Severity', 'Status']}
            empty="None."
            rows={data.complaints.map((c) => [
              dayOf(c.created_at),
              <span key="s" className="font-bold text-maroon-950">{c.subject}</span>,
              <span key="v" className="capitalize">{c.severity}</span>,
              <span key="t" className="capitalize font-bold">{c.status.replace(/_/g, ' ')}</span>,
            ])}
          />
        </div>
      )}
    </div>
  );
}
