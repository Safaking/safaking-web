'use client';

import React, { useMemo } from 'react';
import {
  Stat, Table, SectionTitle, Caveat, money, dayOf, shortRef, daysSince, ageBucket,
  AGE_BUCKETS, DEAD, PAID_STATES, EXPENSE_LABEL,
} from './shared';
import type { Ctx } from './ctx';

/* ------------------------------------------------ R-29 Collection -------- */

export function Collection({ ctx }: { ctx: Ctx }) {
  const { d, inRange } = ctx;

  const rows = useMemo(() => {
    const map = new Map<string, { day: string; tying: number; rental: number; sales: number; count: number }>();
    const bucket = (day: string) => {
      if (!map.has(day)) map.set(day, { day, tying: 0, rental: 0, sales: 0, count: 0 });
      return map.get(day)!;
    };
    const take = (created: string | null, amount: number, into: 'tying' | 'rental' | 'sales') => {
      const day = dayOf(created);
      if (!day || !inRange(day) || amount <= 0) return;
      const row = bucket(day);
      row[into] += amount;
      row.count += 1;
    };

    d.bookings.filter((b) => PAID_STATES.includes(b.payment_status ?? ''))
      .forEach((b) => take(b.created_at, Number(b.advance_amount ?? 0), 'tying'));
    d.rentals.filter((r) => PAID_STATES.includes(r.payment_status))
      .forEach((r) => take(r.created_at, Number(r.advance_amount ?? 0), 'rental'));
    d.orders.filter((o) => PAID_STATES.includes(o.payment_status ?? ''))
      .forEach((o) => take(o.created_at, Number(o.advance_amount ?? 0), 'sales'));

    return [...map.values()].sort((a, b) => b.day.localeCompare(a.day));
  }, [d, inRange]);

  const t = rows.reduce((a, r) => ({
    tying: a.tying + r.tying, rental: a.rental + r.rental, sales: a.sales + r.sales, count: a.count + r.count,
  }), { tying: 0, rental: 0, sales: 0, count: 0 });

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Collected" value={money(t.tying + t.rental + t.sales)} tone="good" />
        <Stat label="Safa tying" value={money(t.tying)} />
        <Stat label="Rental" value={money(t.rental)} />
        <Stat label="Shop sales" value={money(t.sales)} />
      </div>
      <Caveat>
        <b>Payment mode is not recorded anywhere</b>, so cash, UPI, card and gateway cannot be split
        (spec R-29 asks for that breakdown). Every figure here is an <i>advance marked paid</i>.
        Adding a payment-mode field to bookings and orders is a small change that would complete
        this report and unlock reconciliation (R-30) once Razorpay is connected.
      </Caveat>
      <Table
        headers={['Date', 'Receipts', 'Safa Tying', 'Rental', 'Shop Sales', 'Total']}
        empty="Nothing collected in this range."
        rows={rows.map((r) => [
          <span key="d" className="font-bold text-maroon-950">{r.day}</span>,
          r.count, money(r.tying), money(r.rental), money(r.sales),
          <span key="t" className="font-black">{money(r.tying + r.rental + r.sales)}</span>,
        ])}
        footer={['Total', t.count, money(t.tying), money(t.rental), money(t.sales), money(t.tying + t.rental + t.sales)]}
      />
    </>
  );
}

/* ------------------------------------------- R-32 Receivable ageing ------ */

export function Receivable({ ctx }: { ctx: Ctx }) {
  const { d, matches } = ctx;

  const rows = useMemo(() => {
    type Row = { ref: string; kind: string; customer: string; phone: string; date: string;
      total: number; paid: number; balance: number; days: number };
    const out: Row[] = [];

    d.bookings.filter((b) => !DEAD.includes(b.status) && Number(b.balance_amount ?? 0) > 0).forEach((b) => out.push({
      ref: `BK-${shortRef(b.id)}`, kind: 'Safa Tying', customer: b.customer_name, phone: b.customer_phone,
      date: b.event_date, total: Number(b.amount ?? 0), paid: Number(b.advance_amount ?? 0),
      balance: Number(b.balance_amount ?? 0), days: daysSince(dayOf(b.created_at) || b.event_date),
    }));

    d.rentals.filter((r) => !DEAD.includes(r.status) && Number(r.balance_amount ?? 0) > 0).forEach((r) => out.push({
      ref: `RT-${shortRef(r.id)}`, kind: 'Rental', customer: r.customer_name, phone: r.customer_phone,
      date: r.start_date, total: Number(r.total_amount ?? 0), paid: Number(r.advance_amount ?? 0),
      balance: Number(r.balance_amount ?? 0), days: daysSince(dayOf(r.created_at) || r.start_date),
    }));

    d.orders.filter((o) => o.status !== 'cancelled' && Number(o.balance_amount ?? 0) > 0).forEach((o) => out.push({
      ref: `OR-${shortRef(o.id)}`, kind: 'Shop order', customer: o.customer_name, phone: o.customer_phone,
      date: dayOf(o.created_at), total: Number(o.total_amount ?? 0), paid: Number(o.advance_amount ?? 0),
      balance: Number(o.balance_amount ?? 0), days: daysSince(o.created_at),
    }));

    return out.filter((x) => matches(x.customer, x.phone, x.ref)).sort((a, b) => b.days - a.days);
  }, [d, matches]);

  const byBucket = AGE_BUCKETS.map((b) => ({
    bucket: b,
    amount: rows.filter((r) => ageBucket(r.days) === b).reduce((s, r) => s + r.balance, 0),
    count: rows.filter((r) => ageBucket(r.days) === b).length,
  }));
  const total = rows.reduce((s, r) => s + r.balance, 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Stat label="Total receivable" value={money(total)} tone={total ? 'warn' : 'good'} />
        {byBucket.map((b) => (
          <Stat key={b.bucket} label={b.bucket} value={money(b.amount)}
            note={`${b.count} invoice${b.count === 1 ? '' : 's'}`}
            tone={b.bucket === '61+ days' && b.amount > 0 ? 'bad' : 'plain'} />
        ))}
      </div>
      <Table
        headers={['Ageing', 'Ref', 'Type', 'Customer', 'Mobile', 'Event / Order Date', 'Total', 'Paid', 'Balance', 'Days']}
        empty="Nobody owes anything."
        rows={rows.map((x) => [
          <span key="a" className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
            x.days > 60 ? 'bg-rose-100 text-rose-800' : x.days > 30 ? 'bg-amber-100 text-amber-800' : 'bg-royal-100 text-royal-800'
          }`}>{ageBucket(x.days)}</span>,
          <span key="r" className="font-mono font-bold">{x.ref}</span>,
          x.kind,
          <span key="c" className="font-bold text-maroon-950">{x.customer}</span>,
          <a key="p" href={`tel:${x.phone}`} className="underline">{x.phone}</a>,
          x.date, money(x.total), money(x.paid),
          <span key="b" className="font-black text-amber-800">{money(x.balance)}</span>,
          x.days,
        ])}
        footer={['', '', '', '', '', 'Total', '', '', money(total), '']}
      />
    </>
  );
}

/* ---------------------------------------------- R-33 Payable ageing ------ */

export function Payable({ ctx }: { ctx: Ctx }) {
  const { d, matches } = ctx;

  const rows = useMemo(() => {
    const out: { artistId: string; artist: string; ref: string; date: string; gross: number;
      commission: number; payout: number; days: number }[] = [];

    d.bookings
      .filter((b) => b.status === 'completed' && b.payment_release_status !== 'released' && b.artist_id)
      .forEach((b) => {
        const payout = Number(b.artist_payout_amount ?? b.amount ?? 0);
        out.push({
          artistId: b.artist_id!, artist: b.artist_name ?? '—', ref: `BK-${shortRef(b.id)}`,
          date: b.event_date, gross: Number(b.amount ?? 0),
          commission: Number(b.amount ?? 0) - payout, payout, days: daysSince(b.event_date),
        });
      });

    d.rentals
      .filter((r) => ['returned', 'completed'].includes(r.status) && r.payment_release_status !== 'released' && r.artist_id)
      .forEach((r) => out.push({
        artistId: r.artist_id!, artist: r.artist_name ?? '—', ref: `RT-${shortRef(r.id)}`,
        date: r.end_date, gross: Number(r.artist_amount ?? 0), commission: 0,
        payout: Number(r.artist_amount ?? 0), days: daysSince(r.end_date),
      }));

    return out.filter((x) => matches(x.artist, x.ref)).sort((a, b) => b.days - a.days);
  }, [d, matches]);

  const byArtist = useMemo(() => {
    const map = new Map<string, { artist: string; artistId: string; jobs: number; gross: number; commission: number; payable: number; oldest: number }>();
    rows.forEach((r) => {
      const e = map.get(r.artistId) ?? { artist: r.artist, artistId: r.artistId, jobs: 0, gross: 0, commission: 0, payable: 0, oldest: 0 };
      e.jobs += 1; e.gross += r.gross; e.commission += r.commission; e.payable += r.payout;
      e.oldest = Math.max(e.oldest, r.days);
      map.set(r.artistId, e);
    });
    return [...map.values()].sort((a, b) => b.payable - a.payable);
  }, [rows]);

  const total = rows.reduce((s, r) => s + r.payout, 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Total payable" value={money(total)} tone={total ? 'warn' : 'good'} />
        <Stat label="Artists owed" value={byArtist.length} />
        <Stat label="Jobs unpaid" value={rows.length} />
        <Stat label="Oldest" value={rows.length ? `${rows[0].days} days` : '—'}
          tone={rows.length && rows[0].days > 30 ? 'bad' : 'plain'} />
      </div>

      <SectionTitle>By artist</SectionTitle>
      <Table
        headers={['Artist', 'Jobs', 'Gross Earning', 'Our Commission', 'Payable', 'Oldest (days)']}
        empty="Nothing owed to any artist."
        rows={byArtist.map((a) => [
          <button key="n" onClick={() => ctx.openArtist(a.artistId)}
            className="font-bold text-maroon-950 underline decoration-royal-300 underline-offset-2 text-left">
            {a.artist}
          </button>,
          a.jobs, money(a.gross), money(a.commission),
          <span key="p" className="font-black text-amber-800">{money(a.payable)}</span>,
          <span key="o" className={a.oldest > 30 ? 'font-black text-rose-700' : ''}>{a.oldest}</span>,
        ])}
        footer={['Total', '', '', '', money(total), '']}
      />

      <div className="mt-7">
        <SectionTitle>Job by job</SectionTitle>
        <Table
          headers={['Ref', 'Artist', 'Job Date', 'Customer Paid', 'Commission', 'Payable', 'Ageing']}
          empty="Nothing outstanding."
          rows={rows.map((x) => [
            <span key="r" className="font-mono font-bold">{x.ref}</span>,
            x.artist, x.date, money(x.gross), money(x.commission), money(x.payout),
            <span key="a" className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
              x.days > 60 ? 'bg-rose-100 text-rose-800' : x.days > 30 ? 'bg-amber-100 text-amber-800' : 'bg-royal-100 text-royal-800'
            }`}>{ageBucket(x.days)}</span>,
          ])}
        />
      </div>
    </>
  );
}

/* -------------------------------------------------- R-35 Refunds --------- */

export function Refunds({ ctx }: { ctx: Ctx }) {
  const { d, inRange } = ctx;

  const rows = useMemo(() => {
    const out: { ref: string; kind: string; customer: string; phone: string; date: string;
      amount: number; what: string }[] = [];

    d.bookings.filter((b) => b.payment_status === 'refunded' && inRange(b.event_date)).forEach((b) => out.push({
      ref: `BK-${shortRef(b.id)}`, kind: 'Safa Tying', customer: b.customer_name, phone: b.customer_phone,
      date: b.event_date, amount: Number(b.advance_amount ?? 0), what: 'Advance refunded',
    }));

    d.rentals.filter((r) => r.payment_status === 'refunded' && inRange(r.start_date)).forEach((r) => out.push({
      ref: `RT-${shortRef(r.id)}`, kind: 'Rental', customer: r.customer_name, phone: r.customer_phone,
      date: r.start_date, amount: Number(r.advance_amount ?? 0), what: 'Advance refunded',
    }));

    d.rentals.filter((r) => r.deposit_refunded && inRange(r.end_date)).forEach((r) => out.push({
      ref: `RT-${shortRef(r.id)}`, kind: 'Rental', customer: r.customer_name, phone: r.customer_phone,
      date: r.end_date, amount: Number(r.deposit_amount ?? 0), what: 'Deposit returned',
    }));

    d.expenses.filter((e) => e.category === 'refund' && inRange(e.expense_date)).forEach((e) => out.push({
      ref: `EX-${shortRef(e.id)}`, kind: 'Recorded expense', customer: e.paid_to ?? '—', phone: '—',
      date: e.expense_date, amount: Number(e.amount ?? 0), what: e.description ?? 'Customer refund',
    }));

    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [d, inRange]);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <Stat label="Refund events" value={rows.length} />
        <Stat label="Value refunded" value={money(total)} tone={total ? 'warn' : 'plain'} />
        <Stat label="Deposits returned" value={rows.filter((r) => r.what === 'Deposit returned').length} />
      </div>
      <Caveat>
        A refund has no <b>reason</b> or <b>approver</b> field, so this shows what went back and
        when, but not who authorised it. The audit log (R-45) records who made the change.
      </Caveat>
      <Table
        headers={['Date', 'Ref', 'Type', 'Customer', 'Mobile', 'What', 'Amount']}
        empty="No refunds in this range."
        rows={rows.map((x) => [
          <span key="d" className="font-bold text-maroon-950">{x.date}</span>,
          <span key="r" className="font-mono font-bold">{x.ref}</span>,
          x.kind, x.customer, x.phone, x.what, money(x.amount),
        ])}
        footer={['Total', '', '', '', '', '', money(total)]}
      />
    </>
  );
}

/* --------------------------------------------- R-16 Revenue summary ------ */

export function RevenueSummary({ ctx }: { ctx: Ctx }) {
  const { d, inRange } = ctx;

  const rows = useMemo(() => {
    const map = new Map<string, { month: string; tying: number; rental: number; deposits: number; sales: number; collected: number; outstanding: number }>();
    const bucket = (iso: string) => {
      const m = iso.slice(0, 7);
      if (!map.has(m)) map.set(m, { month: m, tying: 0, rental: 0, deposits: 0, sales: 0, collected: 0, outstanding: 0 });
      return map.get(m)!;
    };

    d.bookings.filter((b) => inRange(b.event_date) && !DEAD.includes(b.status)).forEach((b) => {
      const row = bucket(b.event_date);
      row.tying += Number(b.amount ?? 0);
      if (PAID_STATES.includes(b.payment_status ?? '')) row.collected += Number(b.advance_amount ?? 0);
      row.outstanding += Number(b.balance_amount ?? 0);
    });
    d.rentals.filter((r) => inRange(r.start_date) && !DEAD.includes(r.status)).forEach((r) => {
      const row = bucket(r.start_date);
      row.rental += Number(r.rent_amount ?? 0) + Number(r.artist_amount ?? 0);
      row.deposits += Number(r.deposit_amount ?? 0);
      if (PAID_STATES.includes(r.payment_status)) row.collected += Number(r.advance_amount ?? 0);
      row.outstanding += Number(r.balance_amount ?? 0);
    });
    d.orders.filter((o) => inRange(dayOf(o.created_at)) && o.status !== 'cancelled').forEach((o) => {
      const row = bucket(dayOf(o.created_at));
      row.sales += Number(o.total_amount ?? 0);
      if (PAID_STATES.includes(o.payment_status ?? '')) row.collected += Number(o.advance_amount ?? 0);
      row.outstanding += Number(o.balance_amount ?? 0);
    });

    return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
  }, [d, inRange]);

  const t = rows.reduce((a, r) => ({
    tying: a.tying + r.tying, rental: a.rental + r.rental, deposits: a.deposits + r.deposits,
    sales: a.sales + r.sales, collected: a.collected + r.collected, outstanding: a.outstanding + r.outstanding,
  }), { tying: 0, rental: 0, deposits: 0, sales: 0, collected: 0, outstanding: 0 });

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Total revenue" value={money(t.tying + t.rental + t.sales)} />
        <Stat label="Collected" value={money(t.collected)} tone="good" />
        <Stat label="Outstanding" value={money(t.outstanding)} tone={t.outstanding ? 'warn' : 'plain'} />
        <Stat label="Deposits held" value={money(t.deposits)} note="returnable, not revenue" />
      </div>
      <Table
        headers={['Month', 'Safa Tying', 'Rental', 'Deposits Held', 'Shop Sales', 'Total', 'Collected', 'Outstanding']}
        empty="No revenue in this range."
        rows={rows.map((r) => [
          <span key="m" className="font-bold text-maroon-950">{r.month}</span>,
          money(r.tying), money(r.rental), money(r.deposits), money(r.sales),
          <span key="t" className="font-black">{money(r.tying + r.rental + r.sales)}</span>,
          money(r.collected), money(r.outstanding),
        ])}
        footer={['Total', money(t.tying), money(t.rental), money(t.deposits), money(t.sales),
          money(t.tying + t.rental + t.sales), money(t.collected), money(t.outstanding)]}
      />
    </>
  );
}

/* ------------------------------------------ R-41 Service revenue --------- */

export function ServiceRevenue({ ctx }: { ctx: Ctx }) {
  const { d, inRange } = ctx;

  const rows = useMemo(() => {
    const map = new Map<string, { service: string; jobs: number; revenue: number; payout: number; safas: number }>();
    const bucket = (service: string) => {
      if (!map.has(service)) map.set(service, { service, jobs: 0, revenue: 0, payout: 0, safas: 0 });
      return map.get(service)!;
    };

    d.bookings.filter((b) => inRange(b.event_date) && !DEAD.includes(b.status)).forEach((b) => {
      const row = bucket(b.safa_style || 'Safa Tying');
      row.jobs += 1;
      row.revenue += Number(b.amount ?? 0);
      row.payout += Number(b.artist_payout_amount ?? b.amount ?? 0);
      row.safas += Number(b.city_venue.match(/Count:\s*(\d+)/i)?.[1] ?? 1);
    });

    d.rentals.filter((r) => inRange(r.start_date) && !DEAD.includes(r.status)).forEach((r) => {
      const row = bucket(r.needs_artist ? 'Rental + Artist' : 'Safa Rental');
      row.jobs += 1;
      row.revenue += Number(r.rent_amount ?? 0) + Number(r.artist_amount ?? 0);
      row.payout += Number(r.artist_amount ?? 0);
      row.safas += r.safa_count;
    });

    const shop = d.orders.filter((o) => inRange(dayOf(o.created_at)) && o.status !== 'cancelled');
    if (shop.length) {
      const row = bucket('Shop purchase');
      row.jobs = shop.length;
      row.revenue = shop.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
    }

    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [d, inRange]);

  const total = rows.reduce((s, r) => s + r.revenue, 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <Stat label="Services sold" value={rows.length} />
        <Stat label="Revenue" value={money(total)} />
        <Stat label="Best earner" value={rows[0]?.service ?? '—'} note={rows[0] ? money(rows[0].revenue) : undefined} />
      </div>
      <Caveat>
        &ldquo;Margin&rdquo; here is revenue minus what the artist is paid — the only direct cost
        the system records. Fabric, travel and staff time sit in the Expense Register as a lump and
        are not attributed to a service, so treat this as a ranking, not a true cost sheet.
      </Caveat>
      <Table
        headers={['Service', 'Jobs', 'Safas', 'Revenue', 'Paid to artists', 'Margin', 'Share']}
        empty="No service revenue in this range."
        rows={rows.map((r) => [
          <span key="s" className="font-bold text-maroon-950">{r.service}</span>,
          r.jobs, r.safas || '—', money(r.revenue), money(r.payout),
          <span key="m" className="font-black text-emerald-800">{money(r.revenue - r.payout)}</span>,
          total > 0 ? `${Math.round((r.revenue / total) * 100)}%` : '—',
        ])}
        footer={['Total', '', '', money(total), '', '', '100%']}
      />
    </>
  );
}

/* ---------------------------------------------- R-15 Sales register ------ */

export function SalesRegister({ ctx }: { ctx: Ctx }) {
  const { d, inRange, matches } = ctx;

  const rows = useMemo(
    () => d.orders
      .filter((o) => inRange(dayOf(o.created_at)))
      .filter((o) => matches(o.customer_name, o.customer_phone, shortRef(o.id)))
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [d.orders, inRange, matches]
  );

  const t = rows.filter((o) => o.status !== 'cancelled').reduce((a, o) => ({
    total: a.total + Number(o.total_amount ?? 0),
    advance: a.advance + Number(o.advance_amount ?? 0),
    balance: a.balance + Number(o.balance_amount ?? 0),
  }), { total: 0, advance: 0, balance: 0 });

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Orders" value={rows.length} />
        <Stat label="Sales value" value={money(t.total)} />
        <Stat label="Received" value={money(t.advance)} tone="good" />
        <Stat label="Balance" value={money(t.balance)} tone={t.balance ? 'warn' : 'plain'} />
      </div>
      <Table
        headers={['Order ID', 'Date', 'Customer', 'Mobile', 'Ship to', 'Total', 'Paid', 'Balance', 'Payment', 'Status']}
        empty="No shop orders in this range."
        rows={rows.map((o) => [
          <span key="r" className="font-mono font-bold">OR-{shortRef(o.id)}</span>,
          dayOf(o.created_at),
          <span key="c" className="font-bold text-maroon-950">{o.customer_name}</span>,
          o.customer_phone,
          <span key="s" className="block max-w-[16rem]">{o.shipping_address ?? '—'}</span>,
          money(o.total_amount), money(o.advance_amount), money(o.balance_amount),
          <span key="p" className="capitalize">{(o.payment_status ?? '').replace(/_/g, ' ')}</span>,
          <span key="st" className="capitalize font-bold">{o.status}</span>,
        ])}
        footer={['Total', '', '', '', '', money(t.total), money(t.advance), money(t.balance), '', '']}
      />
    </>
  );
}

/* ------------------------------------------------ R-34 Profit & Loss ----- */

export function ProfitLoss({ ctx }: { ctx: Ctx }) {
  const { d, inRange } = ctx;

  const { rows, totals, byCategory } = useMemo(() => {
    const map = new Map<string, { month: string; revenue: number; expense: number }>();
    const bucket = (iso: string) => {
      const m = iso.slice(0, 7);
      if (!map.has(m)) map.set(m, { month: m, revenue: 0, expense: 0 });
      return map.get(m)!;
    };

    d.bookings.filter((b) => inRange(b.event_date) && !DEAD.includes(b.status))
      .forEach((b) => { bucket(b.event_date).revenue += Number(b.amount ?? 0); });
    d.rentals.filter((r) => inRange(r.start_date) && !DEAD.includes(r.status))
      .forEach((r) => { bucket(r.start_date).revenue += Number(r.rent_amount ?? 0) + Number(r.artist_amount ?? 0); });
    d.orders.filter((o) => inRange(dayOf(o.created_at)) && o.status !== 'cancelled')
      .forEach((o) => { bucket(dayOf(o.created_at)).revenue += Number(o.total_amount ?? 0); });
    d.expenses.filter((e) => inRange(e.expense_date))
      .forEach((e) => { bucket(e.expense_date).expense += Number(e.amount ?? 0); });

    const list = [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
    const tot = list.reduce((a, r) => ({ revenue: a.revenue + r.revenue, expense: a.expense + r.expense }), { revenue: 0, expense: 0 });

    const cat = new Map<string, number>();
    d.expenses.filter((e) => inRange(e.expense_date))
      .forEach((e) => cat.set(e.category, (cat.get(e.category) ?? 0) + Number(e.amount ?? 0)));

    return { rows: list, totals: tot, byCategory: [...cat.entries()].sort((a, b) => b[1] - a[1]) };
  }, [d, inRange]);

  const net = totals.revenue - totals.expense;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <Stat label="Revenue" value={money(totals.revenue)} tone="good" note="Tying + rental + shop sales" />
        <Stat label="Expenses" value={money(totals.expense)} tone="bad" note="Everything in the Expense Register" />
        <Stat label="Net profit" value={money(net)} tone={net >= 0 ? 'good' : 'bad'}
          note={totals.revenue > 0 ? `${Math.round((net / totals.revenue) * 100)}% margin` : undefined} />
      </div>

      {d.expenses.length === 0 && (
        <Caveat>
          No expenses recorded yet, so this is revenue wearing a different name. Add them under the
          <b> Expenses </b> tab and the profit line becomes real.
        </Caveat>
      )}

      <SectionTitle>Month by month</SectionTitle>
      <Table
        headers={['Month', 'Revenue', 'Expenses', 'Net Profit', 'Margin']}
        empty="Nothing recorded in this range."
        rows={rows.map((r) => {
          const n = r.revenue - r.expense;
          return [
            <span key="m" className="font-bold text-maroon-950">{r.month}</span>,
            money(r.revenue), money(r.expense),
            <span key="n" className={n >= 0 ? 'font-black text-emerald-800' : 'font-black text-rose-800'}>{money(n)}</span>,
            r.revenue > 0 ? `${Math.round((n / r.revenue) * 100)}%` : '—',
          ];
        })}
        footer={['Total', money(totals.revenue), money(totals.expense), money(net),
          totals.revenue > 0 ? `${Math.round((net / totals.revenue) * 100)}%` : '—']}
      />

      {byCategory.length > 0 && (
        <div className="mt-7">
          <SectionTitle>Where the money went</SectionTitle>
          <Table
            headers={['Category', 'Amount', 'Share']}
            empty="No expenses in this range."
            rows={byCategory.map(([cat, sum]) => [
              <span key="c" className="font-bold text-maroon-950">{EXPENSE_LABEL[cat] ?? cat}</span>,
              money(sum),
              totals.expense > 0 ? `${Math.round((sum / totals.expense) * 100)}%` : '—',
            ])}
          />
        </div>
      )}
    </>
  );
}

/* --------------------------------------------- R-47 Commission ----------- */

export function Commission({ ctx }: { ctx: Ctx }) {
  const { d, inRange } = ctx;

  const rows = useMemo(() => {
    const map = new Map<string, { artistId: string; artist: string; jobs: number; customerPaid: number; artistEarned: number; platform: number }>();

    d.bookings
      .filter((b) => inRange(b.event_date) && !DEAD.includes(b.status) && b.artist_id)
      .forEach((b) => {
        const e = map.get(b.artist_id!) ?? {
          artistId: b.artist_id!, artist: b.artist_name ?? '—', jobs: 0, customerPaid: 0, artistEarned: 0, platform: 0,
        };
        const payout = Number(b.artist_payout_amount ?? b.amount ?? 0);
        e.jobs += 1;
        e.customerPaid += Number(b.amount ?? 0);
        e.artistEarned += payout;
        // Only marketplace jobs carry a charge; on a direct booking the whole
        // amount is the artist's, so those correctly contribute nothing.
        if (b.artist_payout_amount != null) e.platform += Number(b.amount ?? 0) - payout;
        map.set(b.artist_id!, e);
      });

    return [...map.values()].sort((a, b) => b.platform - a.platform);
  }, [d, inRange]);

  const t = rows.reduce((a, r) => ({
    customerPaid: a.customerPaid + r.customerPaid,
    artistEarned: a.artistEarned + r.artistEarned,
    platform: a.platform + r.platform,
  }), { customerPaid: 0, artistEarned: 0, platform: 0 });

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Customer paid" value={money(t.customerPaid)} />
        <Stat label="Paid to artists" value={money(t.artistEarned)} />
        <Stat label="SafaKing earned" value={money(t.platform)} tone="good" />
        <Stat label="Platform share"
          value={t.customerPaid > 0 ? `${Math.round((t.platform / t.customerPaid) * 100)}%` : '—'} />
      </div>
      <Caveat>
        The platform charge is added <b>on top of</b> the artist&apos;s rate, never deducted from it —
        so a direct booking earns SafaKing nothing and correctly shows zero. Only marketplace jobs,
        where a customer accepted a quote, carry a charge.
      </Caveat>
      <Table
        headers={['Artist', 'Jobs', 'Customer Paid', 'Artist Earned', 'SafaKing Earned', 'Rate']}
        empty="No commissionable jobs in this range."
        rows={rows.map((r) => [
          <button key="n" onClick={() => ctx.openArtist(r.artistId)}
            className="font-bold text-maroon-950 underline decoration-royal-300 underline-offset-2 text-left">
            {r.artist}
          </button>,
          r.jobs, money(r.customerPaid), money(r.artistEarned),
          <span key="p" className={r.platform ? 'font-black text-emerald-800' : 'text-gray-400'}>{money(r.platform)}</span>,
          r.customerPaid > 0 ? `${Math.round((r.platform / r.customerPaid) * 100)}%` : '—',
        ])}
        footer={['Total', '', money(t.customerPaid), money(t.artistEarned), money(t.platform), '']}
      />
    </>
  );
}
