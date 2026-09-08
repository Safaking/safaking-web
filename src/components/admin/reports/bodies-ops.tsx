'use client';

import React, { useMemo } from 'react';
import { MapPin, AlertTriangle } from 'lucide-react';
import {
  Stat, Table, SectionTitle, Caveat, money, dayOf, shortRef, shiftDays, todayISO,
  countFromVenue, cleanVenue, pinFromVenue, daysSince, DEAD, PAID_STATES, STAGE_LABEL,
} from './shared';
import type { Ctx } from './ctx';

const stageTone = (stage: string | undefined) =>
  stage === 'no_show' ? 'bg-rose-100 text-rose-800'
  : stage === 'completed' ? 'bg-emerald-100 text-emerald-800'
  : stage === 'started' ? 'bg-royal-100 text-royal-800'
  : stage === 'arrived' ? 'bg-amber-100 text-amber-800'
  : stage === 'en_route' ? 'bg-blue-100 text-blue-800'
  : 'bg-gray-100 text-gray-500';

function Where({ address, landmark, lat, lng }: {
  address: string; landmark?: string | null; lat?: number | null; lng?: number | null;
}) {
  return (
    <span className="block max-w-[16rem]">
      {address}
      {landmark ? <span className="block text-[11px] text-gray-500">Landmark: {landmark}</span> : null}
      {lat != null && lng != null ? (
        <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center gap-1 text-[11px] font-bold text-royal-700 underline mt-0.5">
          <MapPin size={9} /> Pinned location
        </a>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------- R-02 Daily Control ---- */

export function DailyControl({ ctx }: { ctx: Ctx }) {
  const { d, onDate } = ctx;

  const c = useMemo(() => {
    const tomorrow = shiftDays(onDate, 1);
    const alive = (s: string) => !DEAD.includes(s);
    const dayBookings = d.bookings.filter((b) => b.event_date === onDate);
    const dayRentals = d.rentals.filter((r) => r.start_date === onDate);
    const jobsToday = [
      ...dayBookings.filter((b) => alive(b.status)),
      ...dayRentals.filter((r) => r.needs_artist && alive(r.status)),
    ];
    const unassigned = jobsToday.filter((j) => !j.artist_id);
    const stageOf = (id: string) => d.stageByJob.get(id)?.stage;
    const ids = jobsToday.map((j) => j.id);

    return {
      tomorrow,
      today: dayBookings.length,
      tomorrowCount: d.bookings.filter((b) => b.event_date === tomorrow).length,
      pendingConfirm: d.bookings.filter((b) => b.status === 'pending').length,
      unassigned: unassigned.length,
      required: jobsToday.length,
      assigned: jobsToday.length - unassigned.length,
      awaitingApproval: d.bookings.filter((b) => b.artist_id && !b.assignment_approved_at && alive(b.status)).length,
      collected: [...d.bookings, ...d.rentals, ...d.orders]
        .filter((x) => dayOf(x.created_at) === onDate && PAID_STATES.includes(x.payment_status ?? ''))
        .reduce((s, x) => s + Number(x.advance_amount ?? 0), 0),
      outstanding: [...d.bookings.filter((b) => alive(b.status)), ...d.rentals.filter((r) => alive(r.status))]
        .reduce((s, x) => s + Number(x.balance_amount ?? 0), 0),
      deliveryToday: d.rentals.filter((r) => r.start_date === onDate).length,
      returnPending: d.rentals.filter((r) => ['dispatched', 'active'].includes(r.status) && r.end_date < onDate).length,
      live: {
        notStarted: ids.filter((id) => !stageOf(id)).length,
        enRoute: ids.filter((id) => stageOf(id) === 'en_route').length,
        arrived: ids.filter((id) => stageOf(id) === 'arrived').length,
        working: ids.filter((id) => stageOf(id) === 'started').length,
        finished: ids.filter((id) => stageOf(id) === 'completed').length,
        noShow: ids.filter((id) => stageOf(id) === 'no_show').length,
      },
    };
  }, [d, onDate]);

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>Bookings</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Today's bookings" value={c.today} onClick={() => ctx.goTo('ops')} />
          <Stat label="Tomorrow's bookings" value={c.tomorrowCount} onClick={() => ctx.goTo('upcoming')} />
          <Stat label="Pending confirmation" value={c.pendingConfirm} tone={c.pendingConfirm ? 'warn' : 'plain'} onClick={() => ctx.goTo('pending')} />
          <Stat label="Unassigned artist" value={c.unassigned} tone={c.unassigned ? 'bad' : 'good'} onClick={() => ctx.goTo('pending')} />
        </div>
      </section>

      <section>
        <SectionTitle>Artists</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Artists required" value={c.required} />
          <Stat label="Assigned" value={c.assigned} tone="good" />
          <Stat label="Waiting on your approval" value={c.awaitingApproval} tone={c.awaitingApproval ? 'warn' : 'plain'} />
        </div>
      </section>

      <section>
        <SectionTitle>Where the artists are right now</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Stat label="Not started" value={c.live.notStarted} tone={c.live.notStarted ? 'warn' : 'plain'} />
          <Stat label="On the way" value={c.live.enRoute} />
          <Stat label="Arrived" value={c.live.arrived} />
          <Stat label="Tying" value={c.live.working} />
          <Stat label="Finished" value={c.live.finished} tone="good" />
          <Stat label="No show" value={c.live.noShow} tone={c.live.noShow ? 'bad' : 'plain'} />
        </div>
      </section>

      <section>
        <SectionTitle>Payment</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Collected today" value={money(c.collected)} tone="good" onClick={() => ctx.goTo('collection')} />
          <Stat label="Outstanding (all live jobs)" value={money(c.outstanding)} tone={c.outstanding ? 'warn' : 'plain'} onClick={() => ctx.goTo('receivable')} />
          <Stat label="Refunds to date" value={[...d.bookings, ...d.rentals].filter((x) => x.payment_status === 'refunded').length} onClick={() => ctx.goTo('refunds')} />
        </div>
      </section>

      <section>
        <SectionTitle>Rental</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Delivery today" value={c.deliveryToday} onClick={() => ctx.goTo('rentals')} />
          <Stat label="Returns due today" value={d.rentals.filter((r) => r.end_date === onDate).length} />
          <Stat label="Return pending" value={c.returnPending} tone={c.returnPending ? 'bad' : 'plain'} onClick={() => ctx.goTo('returns')} />
        </div>
      </section>

      <section>
        <SectionTitle>Action required</SectionTitle>
        <Exceptions ctx={ctx} compact />
      </section>
    </div>
  );
}

/* ---------------------------------------------------- R-44 Exceptions ---- */

export function Exceptions({ ctx, compact = false }: { ctx: Ctx; compact?: boolean }) {
  const { d } = ctx;
  const today = todayISO();

  const items = useMemo(() => {
    const alive = (s: string) => !DEAD.includes(s);
    const out: { severity: 'high' | 'medium'; what: string; detail: string; who: string; go?: () => void }[] = [];

    const soonUnassigned = d.bookings.filter(
      (b) => alive(b.status) && !b.artist_id && b.event_date >= today && b.event_date <= shiftDays(today, 2)
    );
    if (soonUnassigned.length) out.push({
      severity: 'high', what: 'Unassigned artist',
      detail: `${soonUnassigned.length} booking(s) in the next 48 hours have no artist`,
      who: 'Manager', go: () => ctx.goTo('pending'),
    });

    const unapproved = d.bookings.filter((b) => b.artist_id && !b.assignment_approved_at && alive(b.status));
    if (unapproved.length) out.push({
      severity: 'high', what: 'Assignment not approved',
      detail: `${unapproved.length} artist(s) picked but not signed off — the artist cannot check in`,
      who: 'Admin', go: () => ctx.goTo('pending'),
    });

    const noShow = [...d.stageByJob.entries()].filter(([, v]) => v.stage === 'no_show');
    if (noShow.length) out.push({
      severity: 'high', what: 'Artist no-show',
      detail: `${noShow.length} job(s) marked NO SHOW — arrange a replacement`,
      who: 'Manager', go: () => ctx.goTo('ops'),
    });

    const overdue = d.rentals.filter((r) => ['dispatched', 'active'].includes(r.status) && r.end_date < today);
    if (overdue.length) out.push({
      severity: 'high', what: 'Overdue return',
      detail: `${overdue.length} rental(s) past their return date`,
      who: 'Rental', go: () => ctx.goTo('returns'),
    });

    const blockedArtists = d.artists.filter((a) => a.active && !a.blacklisted && a.verification_status !== 'verified');
    if (blockedArtists.length) out.push({
      severity: 'high', what: 'KYC incomplete',
      detail: `${blockedArtists.length} artist(s) cannot be assigned any work until their documents are approved`,
      who: 'Admin', go: () => ctx.goTo('artists'),
    });

    const unpaid = d.bookings.filter((b) => b.status === 'completed' && b.payment_release_status !== 'released');
    if (unpaid.length) out.push({
      severity: 'medium', what: 'Payout not released',
      detail: `${unpaid.length} completed job(s) waiting on payment release`,
      who: 'Finance', go: () => ctx.goTo('payable'),
    });

    const openComplaints = d.complaints.filter((c) => !['resolved', 'dismissed'].includes(c.status));
    const stale = openComplaints.filter((c) => daysSince(c.created_at) > 3);
    if (stale.length) out.push({
      severity: 'high', what: 'Complaint past SLA',
      detail: `${stale.length} complaint(s) open for more than 3 days`,
      who: 'Manager', go: () => ctx.goTo('ratings'),
    });
    else if (openComplaints.length) out.push({
      severity: 'medium', what: 'Open complaints',
      detail: `${openComplaints.length} complaint(s) still open`,
      who: 'Manager', go: () => ctx.goTo('ratings'),
    });

    const aged = [...d.bookings.filter((b) => alive(b.status)), ...d.rentals.filter((r) => alive(r.status))]
      .filter((x) => Number(x.balance_amount ?? 0) > 0 && daysSince(x.created_at) > 30);
    if (aged.length) out.push({
      severity: 'medium', what: 'Money owed over 30 days',
      detail: `${aged.length} booking(s) with a balance older than a month`,
      who: 'Finance', go: () => ctx.goTo('receivable'),
    });

    const noProfile = d.people.filter(
      (p) => p.role === 'artist' && !d.artists.some((a) => a.id === p.id)
    );
    if (noProfile.length) out.push({
      severity: 'medium', what: 'Artist without a profile',
      detail: `${noProfile.length} account(s) have the artist role but no artist profile — they are invisible everywhere`,
      who: 'Admin',
    });

    return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1));
  }, [d, today, ctx]);

  if (items.length === 0) {
    return (
      <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
        Nothing needs attention. Every job has an artist, every assignment is approved, no return is
        overdue and no complaint is stale.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {!compact && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
          <Stat label="Critical" value={items.filter((i) => i.severity === 'high').length} tone="bad" />
          <Stat label="Needs attention" value={items.filter((i) => i.severity === 'medium').length} tone="warn" />
          <Stat label="Total open" value={items.length} />
        </div>
      )}
      {items.map((item, i) => (
        <div key={i} className={`flex flex-wrap items-start gap-3 p-4 rounded-2xl border ${
          item.severity === 'high' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
        }`}>
          <AlertTriangle size={16} className={`shrink-0 mt-0.5 ${item.severity === 'high' ? 'text-rose-700' : 'text-amber-700'}`} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[13px] text-maroon-950">{item.what}</p>
            <p className="text-[12px] text-gray-700 mt-0.5">{item.detail}</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-maroon-900/50 shrink-0 mt-1">
            {item.who}
          </span>
          {item.go && (
            <button onClick={item.go}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-maroon-950 text-royal-300 text-[10px] font-bold uppercase tracking-wider no-print">
              Open
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------- R-07 Artist Assignment Sheet --- */

export function AssignmentSheet({ ctx }: { ctx: Ctx }) {
  const { d, onDate, matches } = ctx;

  const rows = useMemo(() => {
    const fromBookings = d.bookings
      .filter((b) => b.event_date === onDate && !DEAD.includes(b.status))
      .map((b) => ({
        ref: `BK-${shortRef(b.id)}`, customer: b.customer_name, phone: b.customer_phone,
        type: `Safa Tying · ${b.safa_style}`,
        when: b.event_date,
        time: b.booking_start_time ?? b.event_time ?? '',
        place: cleanVenue(b.venue_address || b.city_venue),
        landmark: b.location_note, lat: b.customer_lat, lng: b.customer_lng,
        qty: countFromVenue(b.city_venue),
        artist: b.artist_name, artistId: b.artist_id, approved: !!b.assignment_approved_at,
        artistPhone: d.phoneOf(b.artist_id),
        stage: d.stageByJob.get(b.id)?.stage, stageAt: d.stageByJob.get(b.id)?.at,
        pay: b.payment_status ?? '—', status: b.status,
      }));

    const fromRentals = d.rentals
      .filter((r) => r.start_date === onDate && !DEAD.includes(r.status))
      .map((r) => ({
        ref: `RT-${shortRef(r.id)}`, customer: r.customer_name, phone: r.customer_phone,
        type: r.needs_artist ? 'Rental + Artist' : 'Rental',
        when: `${r.start_date} → ${r.end_date}`, time: '',
        place: r.venue_address || r.city || r.pincode,
        landmark: r.location_note, lat: r.customer_lat, lng: r.customer_lng,
        qty: r.safa_count,
        artist: r.needs_artist ? r.artist_name : null, artistId: r.artist_id,
        approved: !!r.assignment_approved_at,
        artistPhone: r.needs_artist ? d.phoneOf(r.artist_id) : '—',
        stage: d.stageByJob.get(r.id)?.stage, stageAt: d.stageByJob.get(r.id)?.at,
        pay: r.payment_status, status: r.status,
      }));

    return [...fromBookings, ...fromRentals].filter((x) => matches(x.customer, x.phone, x.artist, x.place, x.ref));
  }, [d, onDate, matches]);

  /** Spec §8 asks for a reporting time — an hour before the event. */
  const reportingTime = (time: string) => {
    if (!/^\d{2}:\d{2}/.test(time)) return '—';
    const [h, m] = time.split(':').map(Number);
    const t = new Date(2000, 0, 1, h, m);
    t.setMinutes(t.getMinutes() - 60);
    return t.toTimeString().slice(0, 5);
  };

  return (
    <Table
      headers={['Booking', 'Date / Time', 'Report by', 'Customer', 'Mobile', 'Venue', 'Service', 'Qty', 'Artist', 'Artist Mobile', 'Live Status', 'Payment', 'Status']}
      empty="No jobs scheduled for this date."
      rows={rows.map((x) => [
        <span key="r" className="font-mono font-bold">{x.ref}</span>,
        <span key="w">{x.when}{x.time ? <span className="block text-[11px] text-gray-500">{x.time}</span> : null}</span>,
        <span key="rt" className="font-bold">{reportingTime(x.time)}</span>,
        <span key="c" className="font-bold text-maroon-950">{x.customer}</span>,
        x.phone,
        <Where key="v" address={x.place} landmark={x.landmark} lat={x.lat} lng={x.lng} />,
        x.type, x.qty,
        x.artistId
          ? <span key="a" className="block font-bold">
              {x.artist ?? 'Assigned'}
              {!x.approved && <span className="block text-[10px] font-black text-amber-700 uppercase">Needs approval</span>}
            </span>
          : <span key="u" className="font-black text-rose-700">— UNASSIGNED —</span>,
        x.artistPhone,
        <span key="ls" className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${stageTone(x.stage)}`}>
          {x.stage ? STAGE_LABEL[x.stage] ?? x.stage : 'Not started'}
          {x.stageAt ? <span className="block font-normal normal-case text-[9px] opacity-70">
            {new Date(x.stageAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
          </span> : null}
        </span>,
        <span key="p" className="capitalize">{(x.pay ?? '').replace(/_/g, ' ')}</span>,
        <span key="s" className="capitalize font-bold">{x.status}</span>,
      ])}
    />
  );
}

/* -------------------------------------------------- R-03 Booking Reg ----- */

export function BookingRegister({ ctx }: { ctx: Ctx }) {
  const { d, inRange, matches, statusFilter } = ctx;

  const rows = useMemo(
    () => d.bookings
      .filter((b) => inRange(b.event_date))
      .filter((b) => statusFilter === 'all' || b.status === statusFilter)
      .filter((b) => matches(b.customer_name, b.customer_phone, b.artist_name, b.city_venue, shortRef(b.id))),
    [d.bookings, inRange, matches, statusFilter]
  );

  const totals = rows.reduce((a, b) => {
    const dead = DEAD.includes(b.status);
    return {
      amount: a.amount + (dead ? 0 : Number(b.amount ?? 0)),
      advance: a.advance + (dead ? 0 : Number(b.advance_amount ?? 0)),
      balance: a.balance + (dead ? 0 : Number(b.balance_amount ?? 0)),
    };
  }, { amount: 0, advance: 0, balance: 0 });

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Bookings" value={rows.length} />
        <Stat label="Total value" value={money(totals.amount)} />
        <Stat label="Advance" value={money(totals.advance)} tone="good" />
        <Stat label="Balance due" value={money(totals.balance)} tone={totals.balance ? 'warn' : 'plain'} />
      </div>
      <Table
        headers={['Booking ID', 'Event Date', 'Time', 'Customer', 'Mobile', 'Venue', 'Service', 'Safas', 'Artist', 'Total', 'Advance', 'Balance', 'Payment', 'Status']}
        empty="No bookings in this range."
        rows={rows.map((b) => [
          <span key="r" className="font-mono font-bold">BK-{shortRef(b.id)}</span>,
          b.event_date,
          <span key="t" className="font-bold">{b.booking_start_time ?? b.event_time ?? '—'}</span>,
          <span key="c" className="font-bold text-maroon-950">{b.customer_name}</span>,
          b.customer_phone,
          <Where key="v" address={b.venue_address || cleanVenue(b.city_venue)} landmark={b.location_note} lat={b.customer_lat} lng={b.customer_lng} />,
          b.safa_style, countFromVenue(b.city_venue),
          b.artist_id
            ? <span key="a">{b.artist_name ?? 'Assigned'}{!b.assignment_approved_at &&
                <span className="block text-[10px] font-black text-amber-700 uppercase">Needs approval</span>}</span>
            : <span key="u" className="text-rose-700 font-bold">Not assigned</span>,
          money(b.amount), money(b.advance_amount), money(b.balance_amount),
          <span key="p" className="capitalize">{(b.payment_status ?? '').replace(/_/g, ' ')}</span>,
          <span key="s" className="capitalize font-bold">{b.status}</span>,
        ])}
        footer={['Total', '', '', '', '', '', '', '', '', money(totals.amount), money(totals.advance), money(totals.balance), '', '']}
      />
    </>
  );
}

/* --------------------------------------------------- R-04 Upcoming ------- */

export function Upcoming({ ctx }: { ctx: Ctx }) {
  const { d, matches } = ctx;
  const today = todayISO();

  const rows = useMemo(() => {
    const bookings = d.bookings
      .filter((b) => b.event_date >= today && !DEAD.includes(b.status))
      .map((b) => ({
        kind: 'Safa Tying', date: b.event_date, time: b.booking_start_time ?? b.event_time ?? '—',
        ref: `BK-${shortRef(b.id)}`, customer: b.customer_name, phone: b.customer_phone,
        place: cleanVenue(b.venue_address || b.city_venue), qty: countFromVenue(b.city_venue),
        artist: b.artist_name, assigned: !!b.artist_id, approved: !!b.assignment_approved_at,
        amount: Number(b.amount ?? 0), balance: Number(b.balance_amount ?? 0), status: b.status,
      }));
    const rentals = d.rentals
      .filter((r) => r.start_date >= today && !DEAD.includes(r.status))
      .map((r) => ({
        kind: r.needs_artist ? 'Rental + Artist' : 'Rental', date: r.start_date, time: '—',
        ref: `RT-${shortRef(r.id)}`, customer: r.customer_name, phone: r.customer_phone,
        place: r.venue_address || r.city || r.pincode, qty: r.safa_count,
        artist: r.artist_name, assigned: !r.needs_artist || !!r.artist_id, approved: !!r.assignment_approved_at,
        amount: Number(r.total_amount ?? 0), balance: Number(r.balance_amount ?? 0), status: r.status,
      }));
    return [...bookings, ...rentals]
      .filter((x) => matches(x.customer, x.phone, x.artist, x.place, x.ref))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [d, today, matches]);

  const within7 = rows.filter((r) => r.date <= shiftDays(today, 7));

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Upcoming jobs" value={rows.length} />
        <Stat label="Next 7 days" value={within7.length} />
        <Stat label="Still unassigned" value={rows.filter((r) => !r.assigned).length}
          tone={rows.some((r) => !r.assigned) ? 'bad' : 'good'} />
        <Stat label="Value ahead" value={money(rows.reduce((s, r) => s + r.amount, 0))} />
      </div>
      <Table
        headers={['Date', 'Time', 'Ref', 'Type', 'Customer', 'Mobile', 'Venue', 'Safas', 'Artist', 'Total', 'Balance', 'Status']}
        empty="Nothing booked ahead."
        rows={rows.map((x) => [
          <span key="d" className="font-bold text-maroon-950">{x.date}</span>,
          x.time,
          <span key="r" className="font-mono font-bold">{x.ref}</span>,
          x.kind,
          <span key="c" className="font-bold">{x.customer}</span>,
          x.phone, x.place, x.qty,
          x.assigned
            ? <span key="a">{x.artist ?? '—'}{!x.approved &&
                <span className="block text-[10px] font-black text-amber-700 uppercase">Needs approval</span>}</span>
            : <span key="u" className="text-rose-700 font-bold">Not assigned</span>,
          money(x.amount), money(x.balance),
          <span key="s" className="capitalize font-bold">{x.status}</span>,
        ])}
      />
    </>
  );
}

/* ---------------------------------------------------- R-05 Pending ------- */

export function PendingBookings({ ctx }: { ctx: Ctx }) {
  const { d, matches } = ctx;
  const today = todayISO();

  const rows = useMemo(() => {
    const out: { ref: string; date: string; customer: string; phone: string; place: string;
      reason: string; severity: 'high' | 'medium'; amount: number }[] = [];

    d.bookings.filter((b) => !DEAD.includes(b.status) && b.status !== 'completed').forEach((b) => {
      const soon = b.event_date <= shiftDays(today, 2) && b.event_date >= today;
      let reason: string | null = null;
      if (!b.artist_id) reason = 'No artist assigned';
      else if (!b.assignment_approved_at) reason = 'Artist assigned but not approved';
      else if (b.status === 'offered') reason = 'Waiting for the artist to accept';
      else if ((b.payment_status ?? '') === 'advance_pending') reason = 'Advance not collected';
      if (!reason) return;
      out.push({
        ref: `BK-${shortRef(b.id)}`, date: b.event_date, customer: b.customer_name,
        phone: b.customer_phone, place: cleanVenue(b.venue_address || b.city_venue),
        reason, severity: soon ? 'high' : 'medium', amount: Number(b.amount ?? 0),
      });
    });

    d.rentals.filter((r) => r.needs_artist && !DEAD.includes(r.status) && !r.artist_id).forEach((r) => {
      out.push({
        ref: `RT-${shortRef(r.id)}`, date: r.start_date, customer: r.customer_name,
        phone: r.customer_phone, place: r.venue_address || r.city || r.pincode,
        reason: 'No artist assigned', severity: r.start_date <= shiftDays(today, 2) ? 'high' : 'medium',
        amount: Number(r.total_amount ?? 0),
      });
    });

    return out
      .filter((x) => matches(x.customer, x.phone, x.ref, x.reason))
      .sort((a, b) => (a.severity === b.severity ? a.date.localeCompare(b.date) : a.severity === 'high' ? -1 : 1));
  }, [d, today, matches]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <Stat label="Pending actions" value={rows.length} tone={rows.length ? 'warn' : 'good'} />
        <Stat label="Within 48 hours" value={rows.filter((r) => r.severity === 'high').length}
          tone={rows.some((r) => r.severity === 'high') ? 'bad' : 'good'} />
        <Stat label="Value at risk" value={money(rows.reduce((s, r) => s + r.amount, 0))} />
      </div>
      <Table
        headers={['Urgency', 'Ref', 'Event Date', 'Customer', 'Mobile', 'Venue', 'What is missing', 'Value']}
        empty="Nothing pending — every booking is assigned, approved and accepted."
        rows={rows.map((x) => [
          <span key="u" className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
            x.severity === 'high' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
          }`}>{x.severity === 'high' ? 'Within 48h' : 'Later'}</span>,
          <span key="r" className="font-mono font-bold">{x.ref}</span>,
          x.date,
          <span key="c" className="font-bold text-maroon-950">{x.customer}</span>,
          x.phone, x.place,
          <span key="w" className="font-bold text-maroon-900">{x.reason}</span>,
          money(x.amount),
        ])}
      />
    </>
  );
}

/* ------------------------------------------------ R-06 Cancellations ----- */

export function Cancellations({ ctx }: { ctx: Ctx }) {
  const { d, inRange, matches } = ctx;

  const rows = useMemo(() => {
    const bookings = d.bookings
      .filter((b) => DEAD.includes(b.status) && inRange(b.event_date))
      .map((b) => ({
        ref: `BK-${shortRef(b.id)}`, kind: 'Safa Tying', date: b.event_date,
        customer: b.customer_name, phone: b.customer_phone,
        artist: b.artist_name ?? '—', by: b.status === 'declined' ? 'Artist declined' : 'Cancelled',
        value: Number(b.amount ?? 0), reason: b.cancellation_reason ?? '',
        who: d.nameOf(b.cancelled_by), when: dayOf(b.cancelled_at),
      }));
    const rentals = d.rentals
      .filter((r) => r.status === 'cancelled' && inRange(r.start_date))
      .map((r) => ({
        ref: `RT-${shortRef(r.id)}`, kind: 'Rental', date: r.start_date,
        customer: r.customer_name, phone: r.customer_phone,
        artist: r.artist_name ?? '—', by: 'Cancelled', value: Number(r.total_amount ?? 0),
        reason: r.cancellation_reason ?? '', who: d.nameOf(r.cancelled_by), when: dayOf(r.cancelled_at),
      }));
    const orders = d.orders
      .filter((o) => o.status === 'cancelled' && inRange(dayOf(o.created_at)))
      .map((o) => ({
        ref: `OR-${shortRef(o.id)}`, kind: 'Shop order', date: dayOf(o.created_at),
        customer: o.customer_name, phone: o.customer_phone, artist: '—', by: 'Cancelled',
        value: Number(o.total_amount ?? 0), reason: o.cancellation_reason ?? '',
        who: d.nameOf(o.cancelled_by), when: dayOf(o.cancelled_at),
      }));
    return [...bookings, ...rentals, ...orders]
      .filter((x) => matches(x.customer, x.phone, x.artist, x.ref, x.reason));
  }, [d, inRange, matches]);

  const lost = rows.reduce((s, r) => s + r.value, 0);
  const liveTotal = d.bookings.filter((b) => inRange(b.event_date)).length;
  const rate = liveTotal > 0 ? Math.round((rows.length / liveTotal) * 100) : 0;
  const withReason = rows.filter((r) => r.reason).length;

  const byReason = useMemo(() => {
    const map = new Map<string, { reason: string; count: number; value: number }>();
    rows.forEach((r) => {
      const key = r.reason.trim() || 'No reason recorded';
      const e = map.get(key) ?? { reason: key, count: 0, value: 0 };
      e.count += 1; e.value += r.value;
      map.set(key, e);
    });
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [rows]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Cancelled / declined" value={rows.length} tone={rows.length ? 'warn' : 'good'} />
        <Stat label="Value lost" value={money(lost)} tone={lost ? 'bad' : 'plain'} />
        <Stat label="Cancellation rate" value={`${rate}%`} note="of bookings in this range" />
        <Stat label="Reason recorded"
          value={rows.length ? `${Math.round((withReason / rows.length) * 100)}%` : '—'}
          note="the field is new" />
      </div>

      <SectionTitle>Why they were lost</SectionTitle>
      <Table
        headers={['Reason', 'Times', 'Value lost', 'Share']}
        empty="Nothing cancelled in this range."
        rows={byReason.map((r) => [
          <span key="r" className={r.reason === 'No reason recorded' ? 'italic text-gray-400 font-bold' : 'font-bold text-maroon-950'}>
            {r.reason}
          </span>,
          r.count, money(r.value),
          lost > 0 ? `${Math.round((r.value / lost) * 100)}%` : '—',
        ])}
      />

      <div className="mt-7">
        <SectionTitle>One by one</SectionTitle>
        <Table
          headers={['Ref', 'Type', 'Event Date', 'Customer', 'Mobile', 'Artist', 'What happened', 'Reason', 'Cancelled by', 'On', 'Value lost']}
          empty="Nothing cancelled in this range."
          rows={rows.map((x) => [
            <span key="r" className="font-mono font-bold">{x.ref}</span>,
            x.kind, x.date,
            <span key="c" className="font-bold text-maroon-950">{x.customer}</span>,
            x.phone, x.artist,
            <span key="b" className={x.by.includes('declined') ? 'text-rose-700 font-bold' : ''}>{x.by}</span>,
            <span key="rs" className={x.reason ? 'block max-w-[18rem]' : 'italic text-gray-400'}>
              {x.reason || 'not recorded'}
            </span>,
            x.who, x.when || '—', money(x.value),
          ])}
          footer={['Total', '', '', '', '', '', '', '', '', '', money(lost)]}
        />
      </div>
    </>
  );
}

/* ------------------------------------------------- R-21 Rental Reg ------- */

export function RentalRegister({ ctx }: { ctx: Ctx }) {
  const { d, inRange, matches, statusFilter } = ctx;
  const today = todayISO();

  const rows = useMemo(
    () => d.rentals
      .filter((r) => inRange(r.start_date))
      .filter((r) => statusFilter === 'all' || r.status === statusFilter)
      .filter((r) => matches(r.customer_name, r.customer_phone, r.artist_name, r.city, r.pincode, shortRef(r.id))),
    [d.rentals, inRange, matches, statusFilter]
  );

  const t = rows.reduce((a, r) => ({
    rent: a.rent + Number(r.rent_amount ?? 0),
    deposit: a.deposit + Number(r.deposit_amount ?? 0),
    total: a.total + Number(r.total_amount ?? 0),
    balance: a.balance + Number(r.balance_amount ?? 0),
  }), { rent: 0, deposit: 0, total: 0, balance: 0 });

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Rentals" value={rows.length} />
        <Stat label="Rent value" value={money(t.rent)} />
        <Stat label="Deposits held" value={money(t.deposit)} />
        <Stat label="Balance due" value={money(t.balance)} tone={t.balance ? 'warn' : 'plain'} />
      </div>
      <Table
        headers={['Ref', 'Customer', 'Mobile', 'Out', 'Due back', 'Days', 'Safas', 'City', 'Artist', 'Rent', 'Deposit', 'Total', 'Balance', 'Status']}
        empty="No rentals in this range."
        rows={rows.map((r) => {
          const overdue = ['dispatched', 'active'].includes(r.status) && r.end_date < today;
          return [
            <span key="r" className="font-mono font-bold">RT-{shortRef(r.id)}</span>,
            <span key="c" className="font-bold text-maroon-950">{r.customer_name}</span>,
            r.customer_phone, r.start_date,
            <span key="e" className={overdue ? 'font-black text-rose-700' : ''}>{r.end_date}{overdue ? ' ⚠' : ''}</span>,
            r.rental_days, r.safa_count, r.city ?? r.pincode, r.artist_name ?? '—',
            money(r.rent_amount), money(r.deposit_amount), money(r.total_amount), money(r.balance_amount),
            <span key="s" className="capitalize font-bold">{r.status}</span>,
          ];
        })}
        footer={['Total', '', '', '', '', '', '', '', '', money(t.rent), money(t.deposit), money(t.total), money(t.balance), '']}
      />
    </>
  );
}

/* ------------------------------------------------- R-22 Return Pending --- */

export function ReturnPending({ ctx }: { ctx: Ctx }) {
  const { d, matches } = ctx;
  const today = todayISO();

  const rows = useMemo(
    () => d.rentals
      .filter((r) => ['dispatched', 'active', 'confirmed'].includes(r.status))
      .filter((r) => matches(r.customer_name, r.customer_phone, r.city, shortRef(r.id)))
      .map((r) => ({ r, late: daysSince(r.end_date), overdue: r.end_date < today }))
      .sort((a, b) => b.late - a.late),
    [d.rentals, today, matches]
  );

  const overdue = rows.filter((x) => x.overdue);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Out with customers" value={rows.length} />
        <Stat label="Overdue" value={overdue.length} tone={overdue.length ? 'bad' : 'good'} />
        <Stat label="Safas out" value={rows.reduce((s, x) => s + x.r.safa_count, 0)} />
        <Stat label="Deposits held" value={money(rows.reduce((s, x) => s + Number(x.r.deposit_amount ?? 0), 0))} />
      </div>
      <Caveat>
        Damage and loss on a return (<b>R-23</b>) are not recorded anywhere yet, so this report
        tracks what is out and what is late, but cannot tell you what came back broken.
      </Caveat>
      <Table
        headers={['Ref', 'Customer', 'Mobile', 'Out on', 'Due back', 'Days late', 'Safas', 'Deposit', 'Status']}
        empty="Nothing is out with a customer right now."
        rows={rows.map(({ r, late, overdue: od }) => [
          <span key="r" className="font-mono font-bold">RT-{shortRef(r.id)}</span>,
          <span key="c" className="font-bold text-maroon-950">{r.customer_name}</span>,
          <a key="p" href={`tel:${r.customer_phone}`} className="underline">{r.customer_phone}</a>,
          r.start_date,
          <span key="e" className={od ? 'font-black text-rose-700' : ''}>{r.end_date}</span>,
          od ? <span key="l" className="font-black text-rose-700">{late}</span> : '—',
          r.safa_count, money(r.deposit_amount),
          <span key="s" className="capitalize font-bold">{r.status}</span>,
        ])}
      />
    </>
  );
}

/* ------------------------------------------------------ Address labels --- */

export function AddressLabels({ ctx }: { ctx: Ctx }) {
  const { d, inRange, matches } = ctx;

  const labels = useMemo(() => {
    const mapsLink = (lat: number | null, lng: number | null) =>
      lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null;

    const fromRentals = d.rentals
      .filter((r) => inRange(r.start_date) && !DEAD.includes(r.status))
      .map((r) => ({
        ref: `RT-${shortRef(r.id)}`, name: r.customer_name, phone: r.customer_phone,
        address: r.venue_address || r.city || '—', pincode: r.pincode,
        landmark: r.location_note ?? '', kind: r.needs_artist ? 'Rental + Artist' : 'Safa Rental',
        date: r.start_date, time: '', qty: `${r.safa_count} safas`, returnBy: r.end_date,
        maps: mapsLink(r.customer_lat, r.customer_lng),
      }));

    const fromBookings = d.bookings
      .filter((b) => inRange(b.event_date) && !DEAD.includes(b.status))
      .map((b) => ({
        ref: `BK-${shortRef(b.id)}`, name: b.customer_name, phone: b.customer_phone,
        address: b.venue_address || cleanVenue(b.city_venue), pincode: pinFromVenue(b.city_venue),
        landmark: b.location_note ?? '', kind: `Safa Tying · ${b.safa_style}`,
        date: b.event_date, time: b.booking_start_time ?? b.event_time ?? '',
        qty: `${countFromVenue(b.city_venue)} safas`, returnBy: '',
        maps: mapsLink(b.customer_lat, b.customer_lng),
      }));

    return [...fromRentals, ...fromBookings]
      .filter((l) => matches(l.name, l.phone, l.ref, l.address))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [d, inRange, matches]);

  if (labels.length === 0) {
    return <p className="py-14 text-center text-sm font-bold text-maroon-900/40">Nothing to dispatch in this range.</p>;
  }

  return (
    <>
      <p className="text-[11px] text-gray-500 mb-4 no-print">
        One label per parcel or job. Print, cut along the dashed lines, stick on the box.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {labels.map((l) => (
          <div key={l.ref} className="border-2 border-dashed border-maroon-300 rounded-2xl p-4 break-inside-avoid">
            <div className="flex items-start justify-between gap-2 pb-2 mb-2 border-b border-amber-200">
              <div>
                <p className="font-display font-black text-sm text-maroon-950">SAFAKING</p>
                <p className="text-[9px] uppercase tracking-widest text-gray-500">safaking.in</p>
              </div>
              <p className="font-mono font-black text-[11px] text-maroon-900">{l.ref}</p>
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Deliver to</p>
            <p className="font-black text-[15px] text-maroon-950 leading-tight mt-0.5">{l.name}</p>
            <p className="text-[12px] text-gray-800 leading-snug mt-1">{l.address}</p>
            {l.pincode && <p className="text-[12px] font-bold text-maroon-900 mt-1">PIN {l.pincode}</p>}
            <p className="text-[12px] font-bold text-maroon-900">📞 {l.phone}</p>
            {l.landmark && <p className="text-[11px] text-gray-600 mt-0.5">Landmark: {l.landmark}</p>}
            <div className="mt-2 pt-2 border-t border-amber-200 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-gray-600">
              <span><b>{l.kind}</b></span>
              <span>Date: <b>{l.date}</b></span>
              {l.time && <span>Time: <b>{l.time}</b></span>}
              <span>Qty: <b>{l.qty}</b></span>
              {l.returnBy && <span>Return by: <b>{l.returnBy}</b></span>}
            </div>
            {l.maps && (
              <a href={l.maps} target="_blank" rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-royal-700 underline no-print">
                <MapPin size={10} /> Open pinned location
              </a>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
