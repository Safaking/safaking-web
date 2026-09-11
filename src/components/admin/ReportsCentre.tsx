'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Loader2, AlertCircle, Printer, Download, RefreshCw, Search, X, Info,
} from 'lucide-react';
import { AnalyticsPanel } from '@/components/admin/AnalyticsPanel';
import { REPORTS, GROUPS, type ReportId } from './reports/registry';
import { useReportData } from './reports/useReportData';
import type { Ctx } from './reports/ctx';
import {
  Stat, Table, SectionTitle, money, monthStart, todayISO, dayOf, shortRef,
  countFromVenue, cleanVenue, downloadCSV, DEAD,
} from './reports/shared';
import {
  DailyControl, Exceptions, AssignmentSheet, BookingRegister, Upcoming,
  PendingBookings, Cancellations, RentalRegister, ReturnPending, AddressLabels,
} from './reports/bodies-ops';
import {
  Collection, Receivable, Payable, Refunds, RevenueSummary, ServiceRevenue,
  SalesRegister, ProfitLoss, Commission,
} from './reports/bodies-money';
import {
  ArtistPerformance, RatingsComplaints, CustomerMaster, RepeatRetention,
  LeadSource, Funnel, AuditLog, CustomerHistory, useArtistStats,
} from './reports/bodies-people';
import { OwnerDashboard, MISPack, AnnualReview, NotBuilt } from './reports/bodies-owner';
import { ArtistQuality } from './reports/bodies-quality';

/**
 * The SafaKing reporting centre.
 *
 * Built to the Report Master document: reports are grouped by who reads them
 * (owner, operations, finance, people, audit), every one carries the standard
 * print header, and every one can be filtered, printed and exported. Each
 * report also shows the R-number it answers, so this screen and that document
 * can be checked against each other.
 */
export function ReportsCentre({ adminName, role }: { adminName: string; role: string }) {
  const d = useReportData();
  const isAdmin = role === 'admin';

  const visible = useMemo(() => REPORTS.filter((r) => isAdmin || !r.adminOnly), [isAdmin]);

  const [report, setReport] = useState<ReportId>('dashboard');
  const [onDate, setOnDate] = useState(todayISO());
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [artistDetail, setArtistDetail] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);

  const def = visible.find((r) => r.id === report) ?? visible[0];

  const inRange = useCallback(
    (iso: string | null | undefined) => !!iso && iso >= from && iso <= to,
    [from, to]
  );

  const matches = useCallback(
    (...fields: (string | null | undefined)[]) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return fields.some((f) => (f ?? '').toLowerCase().includes(q));
    },
    [search]
  );

  const goTo = useCallback((id: ReportId) => {
    setReport(id);
    setSearch('');
    setStatusFilter('all');
    setArtistDetail(null);
    setCustomerDetail(null);
  }, []);

  const ctx: Ctx = {
    d, from, to, onDate, search, statusFilter, inRange, matches, goTo,
    openArtist: setArtistDetail,
    openCustomer: setCustomerDetail,
  };

  const artistStats = useArtistStats(ctx);
  const detail = artistDetail ? artistStats.find((a) => a.artistId === artistDetail) : null;

  /* ------------------------------------------------------------ exports */

  const exportCSV = () => {
    const stamp = def.filter === 'day' ? onDate : def.filter === 'none' ? todayISO() : `${from}_to_${to}`;
    const name = `safaking-${def.code.replace(/[^\w]+/g, '')}-${def.id}-${stamp}.csv`;

    // A table's own rows are React nodes, so exports are rebuilt from the
    // source data — which also keeps the CSV free of the badges and links
    // that make the on-screen version readable but the file unusable.
    if (report === 'bookings') {
      downloadCSV(name,
        ['Booking ID', 'Booked On', 'Event Date', 'Time', 'Customer', 'Mobile', 'Venue', 'Landmark', 'Service', 'Safas', 'Artist', 'Approved', 'Total', 'Advance', 'Balance', 'Payment', 'Status', 'Lead Source'],
        d.bookings.filter((b) => inRange(b.event_date))
          .filter((b) => statusFilter === 'all' || b.status === statusFilter)
          .filter((b) => matches(b.customer_name, b.customer_phone, b.artist_name, b.city_venue, shortRef(b.id)))
          .map((b) => [`BK-${shortRef(b.id)}`, dayOf(b.created_at), b.event_date,
            b.booking_start_time ?? b.event_time ?? '', b.customer_name, b.customer_phone,
            b.venue_address || cleanVenue(b.city_venue), b.location_note ?? '', b.safa_style,
            countFromVenue(b.city_venue), b.artist_name ?? '', b.assignment_approved_at ? 'Yes' : 'No',
            b.amount, b.advance_amount ?? 0, b.balance_amount ?? 0, b.payment_status ?? '', b.status,
            b.lead_source ?? '']));
      return;
    }

    if (report === 'rentals' || report === 'returns') {
      downloadCSV(name,
        ['Ref', 'Customer', 'Mobile', 'Out', 'Due back', 'Days', 'Safas', 'City', 'Artist', 'Rent', 'Deposit', 'Total', 'Advance', 'Balance', 'Payment', 'Status'],
        d.rentals
          .filter((r) => (report === 'returns'
            ? ['dispatched', 'active', 'confirmed'].includes(r.status)
            : inRange(r.start_date) && (statusFilter === 'all' || r.status === statusFilter)))
          .map((r) => [`RT-${shortRef(r.id)}`, r.customer_name, r.customer_phone, r.start_date,
            r.end_date, r.rental_days, r.safa_count, r.city ?? r.pincode, r.artist_name ?? '',
            r.rent_amount, r.deposit_amount, r.total_amount, r.advance_amount, r.balance_amount,
            r.payment_status, r.status]));
      return;
    }

    if (report === 'artists' || report === 'ratings') {
      downloadCSV(name,
        ['Artist', 'City', 'KYC', 'Rating', 'Reviews', 'Jobs', 'Completed', 'Lost', 'Hours', 'Utilisation %', 'Complaints', 'Open Complaints', 'Customer Revenue', 'Earned', 'SafaKing Earned', 'Paid', 'Payable'],
        artistStats.map((x) => [x.name, x.city ?? '', x.kyc ?? '', x.avgRating ?? '', x.reviewCount,
          x.jobs, x.completed, x.lost, x.hours, x.utilisation, x.complaints, x.openComplaints,
          x.customerRevenue, x.earned, x.platform, x.paid, x.payable]));
      return;
    }

    if (report === 'sales') {
      downloadCSV(name,
        ['Order ID', 'Date', 'Customer', 'Mobile', 'Ship to', 'Total', 'Paid', 'Balance', 'Payment', 'Status'],
        d.orders.filter((o) => inRange(dayOf(o.created_at)))
          .map((o) => [`OR-${shortRef(o.id)}`, dayOf(o.created_at), o.customer_name, o.customer_phone,
            o.shipping_address ?? '', o.total_amount, o.advance_amount ?? 0, o.balance_amount ?? 0,
            o.payment_status ?? '', o.status]));
      return;
    }

    if (report === 'audit') {
      downloadCSV(name,
        ['When', 'Who', 'Role', 'Table', 'Record', 'Action', 'Changed'],
        d.audit.filter((a) => inRange(dayOf(a.created_at)))
          .map((a) => [a.created_at, d.nameOf(a.actor_id), a.actor_role ?? '', a.table_name,
            a.record_id ?? '', a.action,
            Object.entries(a.changed ?? {}).map(([k, v]) => `${k}: ${String(v.from)} → ${String(v.to)}`).join(' | ')]));
      return;
    }

    if (report === 'labels' || report === 'ops' || report === 'upcoming' || report === 'pending') {
      downloadCSV(name,
        ['Ref', 'Date', 'Time', 'Customer', 'Mobile', 'Venue', 'Landmark', 'Service', 'Safas', 'Artist', 'Artist Mobile', 'Approved', 'Payment', 'Status'],
        [
          ...d.bookings
            .filter((b) => !DEAD.includes(b.status))
            .filter((b) => report === 'ops' ? b.event_date === onDate
              : report === 'upcoming' ? b.event_date >= todayISO()
              : report === 'pending' ? (!b.artist_id || !b.assignment_approved_at) && b.status !== 'completed'
              : inRange(b.event_date))
            .map((b) => [`BK-${shortRef(b.id)}`, b.event_date, b.booking_start_time ?? b.event_time ?? '',
              b.customer_name, b.customer_phone, b.venue_address || cleanVenue(b.city_venue),
              b.location_note ?? '', b.safa_style, countFromVenue(b.city_venue),
              b.artist_name ?? 'UNASSIGNED', d.phoneOf(b.artist_id),
              b.assignment_approved_at ? 'Yes' : 'No', b.payment_status ?? '', b.status]),
        ]);
      return;
    }

    // Aggregate reports export their own shape; a generic dump of the source
    // rows would not match what is on screen, so these say so instead.
    downloadCSV(name, ['Report', 'Note'], [[
      `${def.code} · ${def.label}`,
      'This is an aggregate view — use Print for the formatted sheet, or export the register it summarises.',
    ]]);
  };

  /* -------------------------------------------------------------- render */

  if (d.loading) {
    return (
      <div className="bg-white rounded-3xl border border-amber-200/60 p-12 text-center">
        <Loader2 size={26} className="animate-spin mx-auto mb-3 text-amber-500" />
        <p className="text-sm font-bold text-gray-600">Building your reports…</p>
      </div>
    );
  }

  const periodLabel =
    def.filter === 'day'
      ? new Date(`${onDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : def.filter === 'none' ? 'All time'
      : `${from} to ${to}`;

  const body = () => {
    switch (report) {
      case 'dashboard': return <OwnerDashboard ctx={ctx} />;
      case 'mis': return <MISPack ctx={ctx} />;
      case 'annual': return <AnnualReview ctx={ctx} />;
      case 'control': return <DailyControl ctx={ctx} />;
      case 'exceptions': return <Exceptions ctx={ctx} />;
      case 'ops': return <AssignmentSheet ctx={ctx} />;
      case 'bookings': return <BookingRegister ctx={ctx} />;
      case 'upcoming': return <Upcoming ctx={ctx} />;
      case 'pending': return <PendingBookings ctx={ctx} />;
      case 'cancellations': return <Cancellations ctx={ctx} />;
      case 'rentals': return <RentalRegister ctx={ctx} />;
      case 'returns': return <ReturnPending ctx={ctx} />;
      case 'labels': return <AddressLabels ctx={ctx} />;
      case 'collection': return <Collection ctx={ctx} />;
      case 'receivable': return <Receivable ctx={ctx} />;
      case 'payable': return <Payable ctx={ctx} />;
      case 'refunds': return <Refunds ctx={ctx} />;
      case 'revenue': return <RevenueSummary ctx={ctx} />;
      case 'services': return <ServiceRevenue ctx={ctx} />;
      case 'sales': return <SalesRegister ctx={ctx} />;
      case 'pnl': return <ProfitLoss ctx={ctx} />;
      case 'platform': return <Commission ctx={ctx} />;
      case 'artists': return <ArtistPerformance ctx={ctx} />;
      case 'ratings': return <RatingsComplaints ctx={ctx} />;
      case 'quality': return <ArtistQuality ctx={ctx} />;
      case 'customers': return <CustomerMaster ctx={ctx} />;
      case 'repeat': return <RepeatRetention ctx={ctx} />;
      case 'sources': return <LeadSource ctx={ctx} />;
      case 'funnel': return <Funnel ctx={ctx} />;
      case 'audit': return <AuditLog ctx={ctx} />;
      case 'analytics': return <AnalyticsPanel />;
      default: return null;
    }
  };

  const overlayOpen = !!detail || !!customerDetail;

  return (
    <div className="space-y-5">
      {d.error && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 no-print">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{d.error}</p>
        </div>
      )}

      {d.missing.length > 0 && (
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 no-print">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            Not installed yet: <b>{d.missing.join(', ')}</b>. The reports that use them will be
            empty until the matching SQL file is run.
          </p>
        </div>
      )}

      {/* Report picker, grouped the way the master list groups them */}
      <div className="space-y-3 no-print">
        {GROUPS.map((group) => {
          const items = visible.filter((r) => r.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-maroon-900/40 mb-1.5">{group}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {items.map((r) => {
                  const Icon = r.icon;
                  const on = report === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => goTo(r.id)}
                      className={`group text-left p-3 rounded-2xl border transition-all duration-150 ${
                        on ? 'bg-maroon-950 border-maroon-950 shadow-lg shadow-maroon-950/20'
                           : 'bg-white border-amber-200/70 hover:border-royal-300 hover:shadow-sm'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          on ? 'bg-royal-400/20 text-royal-300' : 'bg-royal-50 text-royal-600 group-hover:bg-royal-100'
                        }`}>
                          <Icon size={14} />
                        </span>
                        <span className={`font-mono text-[9px] font-bold ${on ? 'text-royal-300/70' : 'text-maroon-900/30'}`}>
                          {r.code}
                        </span>
                      </span>
                      <p className={`font-bold text-[11.5px] mt-1.5 leading-tight ${on ? 'text-royal-100' : 'text-maroon-950'}`}>
                        {r.label}
                      </p>
                      <p className={`text-[10px] mt-0.5 leading-snug ${on ? 'text-royal-200/60' : 'text-gray-500'}`}>
                        {r.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <button onClick={() => setShowMissing((v) => !v)}
          className="text-[11px] font-bold text-maroon-900/50 hover:text-maroon-900 flex items-center gap-1.5">
          <Info size={12} /> {showMissing ? 'Hide' : 'Which reports from the master list are not here?'}
        </button>
        {showMissing && (
          <div className="p-4 rounded-2xl bg-white border border-amber-200/70">
            <NotBuilt />
          </div>
        )}
      </div>

      {/* Universal filters — spec §4 */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-2xl bg-white border border-amber-200/70 no-print">
        {def.filter === 'day' && (
          <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">
            Date
            <input type="date" value={onDate} onChange={(e) => setOnDate(e.target.value)}
              className="block mt-1 px-3 py-2 rounded-xl border border-amber-200/70 text-xs font-bold text-maroon-950" />
          </label>
        )}

        {def.filter === 'range' && (
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
            <div className="flex gap-1.5">
              {([
                ['Today', () => { setFrom(todayISO()); setTo(todayISO()); }],
                ['This month', () => { setFrom(monthStart()); setTo(todayISO()); }],
                ['This year', () => { setFrom(`${new Date().getFullYear()}-01-01`); setTo(todayISO()); }],
              ] as const).map(([label, fn]) => (
                <button key={label} onClick={fn}
                  className="px-2.5 py-2 rounded-xl bg-royal-50 hover:bg-royal-100 text-[10px] font-bold text-maroon-900 uppercase tracking-wider">
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {def.searchable && (
          <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 flex-1 min-w-[12rem]">
            Search
            <span className="relative block mt-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Customer, phone, artist, venue…"
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-amber-200/70 text-xs font-medium text-maroon-950" />
            </span>
          </label>
        )}

        {def.statuses && (
          <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="block mt-1 px-3 py-2 rounded-xl border border-amber-200/70 text-xs font-bold text-maroon-950">
              <option value="all">All</option>
              {def.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={d.reload} title="Reload data"
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
      <div
        id={overlayOpen ? undefined : 'report-print-area'}
        className="bg-white rounded-3xl border border-amber-200/60 shadow-sm overflow-hidden print:border-0 print:shadow-none print:rounded-none"
      >
        {/* Standard print header — spec §5 */}
        <div className="relative px-7 py-6 bg-gradient-to-r from-maroon-950 via-maroon-900 to-maroon-950 overflow-hidden">
          <span className="absolute inset-0 pattern-diamond opacity-[0.07] pointer-events-none" />
          <div className="relative flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-royal-400/70">
                SafaKing · safaking.in
              </p>
              <h2 className="font-display font-black text-2xl text-royal-100 mt-1">
                {def.label}
                <span className="ml-2 font-sans font-bold text-[11px] text-royal-300/60 align-middle">{def.code}</span>
              </h2>
              <p className="text-[11px] text-royal-200/60 mt-1">{def.hint}</p>
            </div>
            <div className="text-right text-[11px] leading-relaxed">
              <p className="font-bold text-royal-200">Period: {periodLabel}</p>
              <p className="text-royal-200/50">Branch: All</p>
              <p className="text-royal-200/50">Generated {d.generatedAt} · {adminName} ({role})</p>
            </div>
          </div>
        </div>

        <div className="p-6">{body()}</div>
      </div>

      {/* ------------------------------------------------- artist sheet */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-maroon-950/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div id="report-print-area" className="bg-white rounded-3xl w-full max-w-4xl my-6 shadow-2xl overflow-hidden">
            <div className="relative px-7 py-6 bg-gradient-to-r from-maroon-950 via-maroon-900 to-maroon-950">
              <span className="absolute inset-0 pattern-diamond opacity-[0.07] pointer-events-none" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-royal-400/70">SafaKing · Artist Sheet</p>
                  <h3 className="font-display font-black text-2xl text-royal-100 mt-1">{detail.name}</h3>
                  <p className="text-[11px] text-royal-200/70 mt-1">
                    {detail.city ?? 'No city set'} · {d.phoneOf(detail.artistId)} ·{' '}
                    {detail.kyc === 'verified' ? 'KYC verified' : 'KYC not verified'}
                  </p>
                  <p className="text-[10px] text-royal-200/50 mt-1">
                    {from} to {to} · generated {d.generatedAt} by {adminName}
                  </p>
                </div>
                <div className="flex items-center gap-2 no-print">
                  <button onClick={() => window.print()}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-royal-100 text-[11px] font-bold flex items-center gap-1.5">
                    <Printer size={13} /> Print
                  </button>
                  <button onClick={() => setArtistDetail(null)}
                    className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-7 space-y-7">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Jobs" value={detail.jobs} note={`${detail.completed} completed`} />
                <Stat label="Hours worked" value={detail.hours > 0 ? `${detail.hours} h` : '—'} />
                <Stat label="Earned" value={money(detail.earned)} tone="good" note={`${money(detail.paid)} paid`} />
                <Stat label="Still payable" value={money(detail.payable)} tone={detail.payable ? 'warn' : 'plain'} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Rating" value={detail.avgRating != null ? `${detail.avgRating.toFixed(1)} ★` : 'New'}
                  note={`${detail.reviewCount} reviews`} />
                <Stat label="Cancelled / declined" value={detail.lost} tone={detail.lost ? 'warn' : 'plain'} />
                <Stat label="Complaints" value={detail.complaints}
                  tone={detail.openComplaints ? 'bad' : 'plain'} note={`${detail.openComplaints} open`} />
                <Stat label="SafaKing earned" value={money(detail.platform)} />
              </div>

              <div>
                <SectionTitle>Work, most recent first</SectionTitle>
                <Table
                  headers={['Ref', 'Date', 'Time', 'Customer', 'Where', 'Service', 'Safas', 'Total', 'Their Payout', 'Status', 'Paid']}
                  empty="No jobs in this range."
                  rows={d.bookings
                    .filter((b) => b.artist_id === detail.artistId && inRange(b.event_date))
                    .sort((a, b) => b.event_date.localeCompare(a.event_date))
                    .map((b) => [
                      <span key="r" className="font-mono font-bold">BK-{shortRef(b.id)}</span>,
                      b.event_date, b.booking_start_time ?? b.event_time ?? '—',
                      <span key="c" className="font-bold text-maroon-950">{b.customer_name}</span>,
                      cleanVenue(b.city_venue), b.safa_style, countFromVenue(b.city_venue),
                      money(b.amount), money(b.artist_payout_amount ?? b.amount),
                      <span key="s" className="capitalize font-bold">{b.status}</span>,
                      b.payment_release_status === 'released'
                        ? <span key="p" className="text-emerald-700 font-bold">Released</span>
                        : <span key="p" className="text-amber-700 font-bold">Pending</span>,
                    ])}
                />
              </div>

              {d.complaints.filter((c) => c.artist_id === detail.artistId).length > 0 && (
                <div>
                  <SectionTitle>Complaints</SectionTitle>
                  <Table
                    headers={['Date', 'Subject', 'Severity', 'Status']}
                    empty="None."
                    rows={d.complaints.filter((c) => c.artist_id === detail.artistId).map((c) => [
                      dayOf(c.created_at),
                      <span key="s" className="font-bold text-maroon-950">{c.subject}</span>,
                      <span key="v" className={c.severity === 'high' ? 'text-rose-700 font-black uppercase' : 'capitalize'}>{c.severity}</span>,
                      <span key="t" className="capitalize font-bold">{c.status.replace(/_/g, ' ')}</span>,
                    ])}
                  />
                </div>
              )}

              {d.reviews.filter((r) => r.subject_id === detail.artistId && r.visible).length > 0 && (
                <div>
                  <SectionTitle>What customers said</SectionTitle>
                  <div className="space-y-2">
                    {d.reviews.filter((r) => r.subject_id === detail.artistId && r.visible).map((r) => (
                      <div key={r.id} className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200">
                        <p className="text-[11px] font-black text-amber-800">
                          {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                          <span className="text-gray-400 font-normal"> · {dayOf(r.created_at)}</span>
                        </p>
                        {r.comment && <p className="text-[13px] text-gray-800 mt-1 leading-relaxed">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------- customer history */}
      {customerDetail && (
        <div className="fixed inset-0 z-50 bg-maroon-950/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div id="report-print-area" className="bg-white rounded-3xl w-full max-w-4xl my-6 shadow-2xl overflow-hidden">
            <div className="relative px-7 py-6 bg-gradient-to-r from-maroon-950 via-maroon-900 to-maroon-950">
              <span className="absolute inset-0 pattern-diamond opacity-[0.07] pointer-events-none" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-royal-400/70">
                    SafaKing · Customer History · R-12
                  </p>
                  <h3 className="font-display font-black text-2xl text-royal-100 mt-1">{customerDetail}</h3>
                  <p className="text-[10px] text-royal-200/50 mt-1">
                    All time · generated {d.generatedAt} by {adminName}
                  </p>
                </div>
                <div className="flex items-center gap-2 no-print">
                  <button onClick={() => window.print()}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-royal-100 text-[11px] font-bold flex items-center gap-1.5">
                    <Printer size={13} /> Print
                  </button>
                  <button onClick={() => setCustomerDetail(null)}
                    className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="p-7">
              <CustomerHistory ctx={ctx} customerKey={customerDetail} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
