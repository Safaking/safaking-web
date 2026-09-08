'use client';

import React, { useMemo } from 'react';
import { Stat, Table, SectionTitle, Caveat, money, dayOf, todayISO, shiftDays, DEAD, PAID_STATES } from './shared';
import type { Ctx } from './ctx';
import { Exceptions } from './bodies-ops';
import { useArtistStats, useCustomerStats } from './bodies-people';
import { NOT_BUILT } from './registry';

/** Shared arithmetic so the dashboard, MIS pack and P&L never disagree. */
function useTotals(ctx: Ctx) {
  const { d, inRange } = ctx;
  return useMemo(() => {
    const live = <T extends { status: string }>(rows: T[]) => rows.filter((r) => !DEAD.includes(r.status));
    const bookings = live(d.bookings.filter((b) => inRange(b.event_date)));
    const rentals = live(d.rentals.filter((r) => inRange(r.start_date)));
    const orders = d.orders.filter((o) => inRange(dayOf(o.created_at)) && o.status !== 'cancelled');
    const expenses = d.expenses.filter((e) => inRange(e.expense_date));

    const revenue =
      bookings.reduce((s, b) => s + Number(b.amount ?? 0), 0)
      + rentals.reduce((s, r) => s + Number(r.rent_amount ?? 0) + Number(r.artist_amount ?? 0), 0)
      + orders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

    const collected = [
      ...bookings.filter((b) => PAID_STATES.includes(b.payment_status ?? '')),
      ...rentals.filter((r) => PAID_STATES.includes(r.payment_status)),
      ...orders.filter((o) => PAID_STATES.includes(o.payment_status ?? '')),
    ].reduce((s, x) => s + Number(x.advance_amount ?? 0), 0);

    const outstanding = [...bookings, ...rentals, ...orders]
      .reduce((s, x) => s + Number(x.balance_amount ?? 0), 0);

    const expense = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);

    return {
      bookings, rentals, orders, revenue, collected, outstanding, expense,
      profit: revenue - expense,
      cancelled: d.bookings.filter((b) => inRange(b.event_date) && DEAD.includes(b.status)).length,
      jobs: bookings.length + rentals.length,
    };
  }, [d, inRange]);
}

/* ------------------------------------------- R-01 Owner dashboard -------- */

export function OwnerDashboard({ ctx }: { ctx: Ctx }) {
  const { d } = ctx;
  const t = useTotals(ctx);
  const today = todayISO();

  const todayBookings = d.bookings.filter((b) => b.event_date === today && !DEAD.includes(b.status)).length;
  const tomorrow = d.bookings.filter((b) => b.event_date === shiftDays(today, 1) && !DEAD.includes(b.status)).length;
  const unassigned = d.bookings.filter((b) => !DEAD.includes(b.status) && !b.artist_id && b.event_date >= today).length;
  const todayCollected = [...d.bookings, ...d.rentals, ...d.orders]
    .filter((x) => dayOf(x.created_at) === today && PAID_STATES.includes(x.payment_status ?? ''))
    .reduce((s, x) => s + Number(x.advance_amount ?? 0), 0);

  const alerts =
    unassigned
    + d.bookings.filter((b) => b.artist_id && !b.assignment_approved_at && !DEAD.includes(b.status)).length
    + d.rentals.filter((r) => ['dispatched', 'active'].includes(r.status) && r.end_date < today).length
    + d.complaints.filter((c) => !['resolved', 'dismissed'].includes(c.status)).length
    + d.artists.filter((a) => a.active && !a.blacklisted && a.verification_status !== 'verified').length;

  return (
    <div className="space-y-7">
      <section>
        <SectionTitle>Today</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Stat label="Today's bookings" value={todayBookings} onClick={() => ctx.goTo('ops')} />
          <Stat label="Tomorrow's bookings" value={tomorrow} onClick={() => ctx.goTo('upcoming')} />
          <Stat label="Collected today" value={money(todayCollected)} tone="good" onClick={() => ctx.goTo('collection')} />
          <Stat label="Artist unassigned" value={unassigned} tone={unassigned ? 'bad' : 'good'} onClick={() => ctx.goTo('pending')} />
          <Stat label="Critical alerts" value={alerts} tone={alerts ? 'warn' : 'good'} onClick={() => ctx.goTo('exceptions')} />
        </div>
      </section>

      <section>
        <SectionTitle>This period</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Revenue" value={money(t.revenue)} onClick={() => ctx.goTo('revenue')} />
          <Stat label="Collected" value={money(t.collected)} tone="good" onClick={() => ctx.goTo('collection')} />
          <Stat label="Outstanding" value={money(t.outstanding)} tone={t.outstanding ? 'warn' : 'plain'} onClick={() => ctx.goTo('receivable')} />
          <Stat label="Net profit" value={money(t.profit)} tone={t.profit >= 0 ? 'good' : 'bad'}
            note={t.revenue > 0 ? `${Math.round((t.profit / t.revenue) * 100)}% margin` : undefined}
            onClick={() => ctx.goTo('pnl')} />
        </div>
      </section>

      <section>
        <SectionTitle>The business behind it</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Jobs" value={t.jobs} onClick={() => ctx.goTo('bookings')} />
          <Stat label="Cancelled" value={t.cancelled} tone={t.cancelled ? 'warn' : 'plain'} onClick={() => ctx.goTo('cancellations')} />
          <Stat label="Assignable artists"
            value={`${d.artists.filter((a) => a.verification_status === 'verified' && a.active && !a.blacklisted).length} of ${d.artists.length}`}
            tone={d.artists.some((a) => a.verification_status === 'verified') ? 'plain' : 'bad'}
            onClick={() => ctx.goTo('artists')} />
          <Stat label="Owed to artists"
            value={money(d.bookings.filter((b) => b.status === 'completed' && b.payment_release_status !== 'released')
              .reduce((s, b) => s + Number(b.artist_payout_amount ?? b.amount ?? 0), 0))}
            onClick={() => ctx.goTo('payable')} />
        </div>
      </section>

      <section>
        <SectionTitle>Needs somebody today</SectionTitle>
        <Exceptions ctx={ctx} compact />
      </section>
    </div>
  );
}

/* ---------------------------------------------- R-49 Monthly MIS pack ---- */

export function MISPack({ ctx }: { ctx: Ctx }) {
  const { from, to } = ctx;
  const t = useTotals(ctx);
  const artists = useArtistStats(ctx);
  const customers = useCustomerStats(ctx);

  const services = useMemo(() => {
    const map = new Map<string, number>();
    t.bookings.forEach((b) => map.set(b.safa_style, (map.get(b.safa_style) ?? 0) + Number(b.amount ?? 0)));
    if (t.rentals.length) map.set('Rental', t.rentals.reduce((s, r) => s + Number(r.rent_amount ?? 0) + Number(r.artist_amount ?? 0), 0));
    if (t.orders.length) map.set('Shop sales', t.orders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [t]);

  const sources = useMemo(() => {
    const map = new Map<string, number>();
    [...t.bookings, ...t.rentals, ...t.orders].forEach((x) => {
      const key = (x.lead_source ?? '').trim() || 'Not recorded';
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [t]);

  return (
    <div className="space-y-8">
      <p className="text-[12px] text-gray-500 -mt-2">
        Everything below prints as one pack for {from} to {to}. Sections the data cannot support are
        listed honestly at the end rather than left as empty pages.
      </p>

      <section>
        <SectionTitle>1 · Executive summary</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Revenue" value={money(t.revenue)} />
          <Stat label="Collected" value={money(t.collected)} tone="good" />
          <Stat label="Expenses" value={money(t.expense)} tone="bad" />
          <Stat label="Net profit" value={money(t.profit)} tone={t.profit >= 0 ? 'good' : 'bad'} />
          <Stat label="Jobs" value={t.jobs} />
          <Stat label="Cancelled" value={t.cancelled} tone={t.cancelled ? 'warn' : 'plain'} />
          <Stat label="Outstanding" value={money(t.outstanding)} tone={t.outstanding ? 'warn' : 'plain'} />
          <Stat label="New customers" value={customers.length} />
        </div>
      </section>

      <section>
        <SectionTitle>2 · Revenue by service</SectionTitle>
        <Table
          headers={['Service', 'Revenue', 'Share']}
          empty="No revenue in this period."
          rows={services.map(([name, value]) => [
            <span key="s" className="font-bold text-maroon-950">{name}</span>,
            money(value),
            t.revenue > 0 ? `${Math.round((value / t.revenue) * 100)}%` : '—',
          ])}
        />
      </section>

      <section>
        <SectionTitle>3 · Bookings</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Taken" value={t.bookings.length + t.rentals.length} />
          <Stat label="Completed" value={t.bookings.filter((b) => b.status === 'completed').length} tone="good" />
          <Stat label="Still open" value={t.bookings.filter((b) => ['pending', 'offered', 'assigned'].includes(b.status)).length} />
          <Stat label="Cancelled / declined" value={t.cancelled} tone={t.cancelled ? 'warn' : 'plain'} />
        </div>
      </section>

      <section>
        <SectionTitle>4 · Artists</SectionTitle>
        <Table
          headers={['Artist', 'Jobs', 'Hours', 'Rating', 'Complaints', 'Earned', 'Payable']}
          empty="No artist activity."
          rows={artists.slice(0, 15).map((a) => [
            <span key="n" className="font-bold text-maroon-950">{a.name}</span>,
            a.jobs, a.hours > 0 ? `${a.hours} h` : '—',
            a.avgRating != null ? `${a.avgRating.toFixed(1)} ★` : 'New',
            a.complaints, money(a.earned),
            <span key="p" className={a.payable ? 'font-black text-amber-800' : ''}>{money(a.payable)}</span>,
          ])}
        />
      </section>

      <section>
        <SectionTitle>5 · Customers</SectionTitle>
        <Table
          headers={['Customer', 'Mobile', 'Jobs', 'Billed', 'Outstanding']}
          empty="No customers in this period."
          rows={customers.slice(0, 15).map((c) => [
            <span key="n" className="font-bold text-maroon-950">{c.name}</span>,
            c.phone, c.bookings + c.rentals + c.orders, money(c.billed),
            <span key="o" className={c.outstanding ? 'font-black text-amber-800' : ''}>{money(c.outstanding)}</span>,
          ])}
        />
      </section>

      <section>
        <SectionTitle>6 · Finance</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Collected" value={money(t.collected)} tone="good" />
          <Stat label="Expenses" value={money(t.expense)} tone="bad" />
          <Stat label="Receivable" value={money(t.outstanding)} tone={t.outstanding ? 'warn' : 'plain'} />
          <Stat label="Payable to artists"
            value={money(artists.reduce((s, a) => s + a.payable, 0))} />
        </div>
      </section>

      <section>
        <SectionTitle>7 · Marketing</SectionTitle>
        <Table
          headers={['Lead source', 'Jobs', 'Share']}
          empty="No jobs in this period."
          rows={sources.map(([name, count]) => [
            <span key="s" className={name === 'Not recorded' ? 'italic text-gray-400 font-bold' : 'font-bold text-maroon-950'}>{name}</span>,
            count,
            t.jobs > 0 ? `${Math.round((count / t.jobs) * 100)}%` : '—',
          ])}
        />
      </section>

      <section>
        <SectionTitle>8 · Exceptions at close</SectionTitle>
        <Exceptions ctx={ctx} compact />
      </section>

      <section>
        <SectionTitle>9 · Not in this pack, and why</SectionTitle>
        <Table
          headers={['Spec', 'Report', 'Why it is absent']}
          empty="—"
          rows={NOT_BUILT.map((n) => [
            <span key="c" className="font-mono font-bold">{n.codes}</span>,
            <span key="w" className="font-bold text-maroon-950">{n.what}</span>,
            <span key="y" className="block max-w-[34rem] text-gray-600">{n.why}</span>,
          ])}
        />
      </section>
    </div>
  );
}

/* ------------------------------------------------ R-50 Annual review ----- */

export function AnnualReview({ ctx }: { ctx: Ctx }) {
  const { d } = ctx;

  const years = useMemo(() => {
    const map = new Map<string, { year: string; bookings: number; rentals: number; orders: number;
      revenue: number; expense: number; customers: Set<string>; artists: Set<string> }>();
    const bucket = (iso: string) => {
      const y = iso.slice(0, 4);
      if (!map.has(y)) map.set(y, { year: y, bookings: 0, rentals: 0, orders: 0, revenue: 0, expense: 0, customers: new Set(), artists: new Set() });
      return map.get(y)!;
    };

    d.bookings.filter((b) => !DEAD.includes(b.status)).forEach((b) => {
      const row = bucket(b.event_date);
      row.bookings += 1;
      row.revenue += Number(b.amount ?? 0);
      row.customers.add(b.customer_phone);
      if (b.artist_id) row.artists.add(b.artist_id);
    });
    d.rentals.filter((r) => !DEAD.includes(r.status)).forEach((r) => {
      const row = bucket(r.start_date);
      row.rentals += 1;
      row.revenue += Number(r.rent_amount ?? 0) + Number(r.artist_amount ?? 0);
      row.customers.add(r.customer_phone);
    });
    d.orders.filter((o) => o.status !== 'cancelled').forEach((o) => {
      const row = bucket(dayOf(o.created_at));
      row.orders += 1;
      row.revenue += Number(o.total_amount ?? 0);
      row.customers.add(o.customer_phone);
    });
    d.expenses.forEach((e) => { bucket(e.expense_date).expense += Number(e.amount ?? 0); });

    return [...map.values()].filter((y) => y.year).sort((a, b) => b.year.localeCompare(a.year));
  }, [d]);

  const growth = (i: number, pick: (y: (typeof years)[number]) => number) => {
    const prev = years[i + 1];
    if (!prev) return '—';
    const before = pick(prev);
    if (before === 0) return '—';
    const pct = Math.round(((pick(years[i]) - before) / before) * 100);
    return `${pct > 0 ? '+' : ''}${pct}%`;
  };

  return (
    <>
      <Caveat>
        Ignores the date filter — a year-on-year view has to see every year. Growth compares each
        row with the one below it.
      </Caveat>
      <Table
        headers={['Year', 'Bookings', 'Rentals', 'Orders', 'Customers', 'Artists used', 'Revenue', 'Expenses', 'Net Profit', 'Revenue growth']}
        empty="No activity recorded yet."
        rows={years.map((y, i) => [
          <span key="y" className="font-black text-maroon-950 text-[14px]">{y.year}</span>,
          y.bookings, y.rentals, y.orders, y.customers.size, y.artists.size,
          money(y.revenue), money(y.expense),
          <span key="p" className={y.revenue - y.expense >= 0 ? 'font-black text-emerald-800' : 'font-black text-rose-800'}>
            {money(y.revenue - y.expense)}
          </span>,
          <span key="g" className="font-bold">{growth(i, (row) => row.revenue)}</span>,
        ])}
      />
    </>
  );
}

/* ------------------------------------------- Not-built disclosure -------- */

export function NotBuilt() {
  return (
    <Table
      headers={['Spec', 'Report', 'Why it is not here']}
      empty="—"
      rows={NOT_BUILT.map((n) => [
        <span key="c" className="font-mono font-bold">{n.codes}</span>,
        <span key="w" className="font-bold text-maroon-950">{n.what}</span>,
        <span key="y" className="block max-w-[36rem] text-gray-600">{n.why}</span>,
      ])}
    />
  );
}
