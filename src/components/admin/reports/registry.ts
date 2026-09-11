import {
  ClipboardList, Sunrise, Calendar, CalendarRange, Crown, Users, IndianRupee,
  TrendingUp, Wallet, Megaphone, Star, Tag, Percent, Gauge, AlertTriangle,
  CalendarClock, CircleSlash, PackageCheck, Repeat, Receipt, HandCoins,
  Undo2, Filter, LayoutList, ScrollText, BookOpen, Layers,
} from 'lucide-react';

export type ReportId =
  // L1 owner
  | 'dashboard' | 'mis' | 'annual'
  // L2 operations
  | 'control' | 'ops' | 'bookings' | 'upcoming' | 'pending' | 'cancellations'
  | 'rentals' | 'returns' | 'exceptions' | 'labels'
  // L3 finance
  | 'collection' | 'receivable' | 'payable' | 'refunds' | 'revenue' | 'pnl'
  | 'sales' | 'services' | 'platform'
  // L4 people & marketing
  | 'artists' | 'ratings' | 'quality' | 'customers' | 'repeat' | 'sources' | 'funnel'
  // L5 audit
  | 'audit'
  | 'analytics';

export type FilterKind = 'day' | 'range' | 'none';

export interface ReportDef {
  id: ReportId;
  /** The ID this report carries in the Report Master document. */
  code: string;
  label: string;
  hint: string;
  group: string;
  icon: typeof ClipboardList;
  filter: FilterKind;
  /** Shown in the filter bar; reports without a list are aggregate views. */
  searchable?: boolean;
  statuses?: readonly string[];
  /** Only an admin should see the money-out and audit views. */
  adminOnly?: boolean;
}

const BOOKING_STATUSES = ['pending', 'offered', 'assigned', 'declined', 'completed', 'cancelled'] as const;
const RENTAL_STATUSES = ['pending', 'confirmed', 'dispatched', 'active', 'returned', 'completed', 'cancelled'] as const;

/**
 * The Report Master list, in the order the spec groups it — owner first,
 * because that is who opens this tab most and reads least.
 *
 * Reports the data cannot honestly support are absent rather than stubbed:
 * stock, training, branch, GST and gateway reconciliation each need tables
 * that do not exist, and a report that invents its numbers is worse than one
 * that is missing.
 */
export const REPORTS: ReportDef[] = [
  // ---- L1 · Owner command -------------------------------------------------
  { id: 'dashboard', code: 'R-01', label: 'Owner Dashboard', hint: 'Nine numbers, each opening the report behind it', group: 'Owner command', icon: Gauge, filter: 'range' },
  { id: 'mis', code: 'R-49', label: 'Monthly MIS Pack', hint: 'One print: the whole month, twelve sections', group: 'Owner command', icon: BookOpen, filter: 'range' },
  { id: 'annual', code: 'R-50', label: 'Annual Review', hint: 'Year on year — growth, customers, artists', group: 'Owner command', icon: Layers, filter: 'none' },

  // ---- L2 · Operations ----------------------------------------------------
  { id: 'control', code: 'R-02', label: 'Daily Control Sheet', hint: 'The morning one-pager', group: 'Operations', icon: ClipboardList, filter: 'day' },
  { id: 'exceptions', code: 'R-44', label: 'Exceptions & Alerts', hint: 'Everything that needs somebody today', group: 'Operations', icon: AlertTriangle, filter: 'none' },
  { id: 'ops', code: 'R-07', label: 'Artist Assignment Sheet', hint: 'Every job on a date, with reporting time', group: 'Operations', icon: Sunrise, filter: 'day', searchable: true },
  { id: 'bookings', code: 'R-03', label: 'Booking Register', hint: 'All bookings, complete status', group: 'Operations', icon: Calendar, filter: 'range', searchable: true, statuses: BOOKING_STATUSES },
  { id: 'upcoming', code: 'R-04', label: 'Upcoming Bookings', hint: 'What is still ahead, by date', group: 'Operations', icon: CalendarClock, filter: 'none', searchable: true },
  { id: 'pending', code: 'R-05', label: 'Pending Bookings', hint: 'Unassigned, unapproved, unconfirmed', group: 'Operations', icon: LayoutList, filter: 'none', searchable: true },
  { id: 'cancellations', code: 'R-06', label: 'Cancellation Report', hint: 'What was lost, and why', group: 'Operations', icon: CircleSlash, filter: 'range', searchable: true },
  { id: 'rentals', code: 'R-21', label: 'Rental Register', hint: 'Issue, return, deposit', group: 'Operations', icon: CalendarRange, filter: 'range', searchable: true, statuses: RENTAL_STATUSES },
  { id: 'returns', code: 'R-22', label: 'Return Pending', hint: 'Out and overdue', group: 'Operations', icon: PackageCheck, filter: 'none', searchable: true },
  { id: 'labels', code: '—', label: 'Address Labels', hint: 'Print, cut, stick on the parcel', group: 'Operations', icon: Tag, filter: 'range', searchable: true },

  // ---- L3 · Finance -------------------------------------------------------
  { id: 'collection', code: 'R-29', label: 'Collection Report', hint: 'Cash, UPI, card — and day by day', group: 'Finance', icon: HandCoins, filter: 'range', adminOnly: true },
  { id: 'receivable', code: 'R-32', label: 'Receivable Ageing', hint: '0–7, 8–30, 31–60, 61+ days', group: 'Finance', icon: Receipt, filter: 'none', searchable: true, adminOnly: true },
  { id: 'payable', code: 'R-33', label: 'Artist Payable Ageing', hint: 'What we owe, and how long we have owed it', group: 'Finance', icon: Wallet, filter: 'none', searchable: true, adminOnly: true },
  { id: 'refunds', code: 'R-35', label: 'Refund Report', hint: 'Refunded bookings and deposits', group: 'Finance', icon: Undo2, filter: 'range', adminOnly: true },
  { id: 'revenue', code: 'R-16', label: 'Revenue Summary', hint: 'Month by month, by business line', group: 'Finance', icon: IndianRupee, filter: 'range' },
  { id: 'services', code: 'R-41', label: 'Service Revenue', hint: 'Which service actually earns', group: 'Finance', icon: Filter, filter: 'range' },
  { id: 'sales', code: 'R-15', label: 'Sales Register', hint: 'Shop orders, one line each', group: 'Finance', icon: Receipt, filter: 'range', searchable: true },
  { id: 'pnl', code: 'R-34', label: 'Profit & Loss', hint: 'Revenue minus expenses, by month', group: 'Finance', icon: Wallet, filter: 'range', adminOnly: true },
  { id: 'platform', code: 'R-47', label: 'Commission Report', hint: 'What SafaKing earned, artist by artist', group: 'Finance', icon: Percent, filter: 'range', adminOnly: true },

  // ---- L4 · People & marketing -------------------------------------------
  { id: 'artists', code: 'R-08 / R-09', label: 'Artist Performance', hint: 'Jobs, hours, earnings, what we owe', group: 'Artists & customers', icon: Crown, filter: 'range', searchable: true },
  { id: 'ratings', code: 'R-10', label: 'Ratings & Complaints', hint: 'Quality, standing, open cases', group: 'Artists & customers', icon: Star, filter: 'range', searchable: true },
  { id: 'quality', code: 'R-51', label: 'Artist Quality (QC)', hint: 'Rating, complaints, attendance and arrival — job by job', group: 'Artists & customers', icon: Gauge, filter: 'range', searchable: true },
  { id: 'customers', code: 'R-11 / R-13', label: 'Customer Master', hint: 'Who booked, what they owe, click for history', group: 'Artists & customers', icon: Users, filter: 'range', searchable: true },
  { id: 'repeat', code: 'R-14 / R-43', label: 'Repeat & Retention', hint: 'Who came back, and how often', group: 'Artists & customers', icon: Repeat, filter: 'none', searchable: true },
  { id: 'sources', code: 'R-36', label: 'Lead Source', hint: 'Which marketing brings bookings', group: 'Artists & customers', icon: Megaphone, filter: 'range' },
  { id: 'funnel', code: 'R-37 / R-42', label: 'Booking Funnel', hint: 'Enquiry → quote → booking → completed', group: 'Artists & customers', icon: TrendingUp, filter: 'range' },

  // ---- L5 · Audit ---------------------------------------------------------
  { id: 'audit', code: 'R-45', label: 'Activity & Audit Log', hint: 'Who changed what, and when', group: 'Audit', icon: ScrollText, filter: 'range', searchable: true, adminOnly: true },
  { id: 'analytics', code: 'R-17', label: 'Business Analytics', hint: 'Top products, top artists, trend', group: 'Audit', icon: TrendingUp, filter: 'none' },
];

export const GROUPS = ['Owner command', 'Operations', 'Finance', 'Artists & customers', 'Audit'] as const;

/** Reports the master list asks for that this data cannot honestly produce. */
export const NOT_BUILT: { codes: string; what: string; why: string }[] = [
  { codes: 'R-17 – R-20', what: 'Stock, low stock, dead stock', why: 'products carry no stock quantity, so opening/closing cannot be computed' },
  { codes: 'R-23', what: 'Rental damage & loss', why: 'nothing records damage on a return' },
  { codes: 'R-24 – R-28', what: 'Training admissions, attendance, fees, certificates', why: 'the academy captures enquiries only, not batches or attendance' },
  { codes: 'R-30', what: 'Payment gateway reconciliation', why: 'Razorpay is not connected, so there is no gateway statement to reconcile against' },
  { codes: 'R-39, R-40', what: 'Branch performance & profitability', why: 'there is one location and no branch on any record' },
  { codes: 'R-46', what: 'Discount report', why: 'no discount is captured on a booking or order' },
  { codes: 'R-48', what: 'GST working summary', why: 'no tax rate, HSN or invoice series exists yet — settle the structure with your CA first' },
];
