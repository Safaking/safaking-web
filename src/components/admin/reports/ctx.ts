import type { ReportData } from './useReportData';
import type { ReportId } from './registry';

/** What every report body is handed: the data, the filters, and the ways out. */
export interface Ctx {
  d: ReportData;
  from: string;
  to: string;
  onDate: string;
  search: string;
  statusFilter: string;
  /** Is this date inside the From–To window? */
  inRange: (iso: string | null | undefined) => boolean;
  /** Does any of these fields contain the search text? */
  matches: (...fields: (string | null | undefined)[]) => boolean;
  /** Jump to another report — how a KPI card opens the report behind it. */
  goTo: (id: ReportId) => void;
  /** Open the per-artist sheet. */
  openArtist: (artistId: string) => void;
  /** Open one customer's booking history. */
  openCustomer: (phone: string) => void;
}
