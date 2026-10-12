import type { ReportRange } from '@/src/domain/reports/dateRange';

/**
 * The shape every report is built into.
 *
 * Report builders are pure functions from the app's records and a date range to a `ReportDocument`; the screen, the
 * PDF and the CSV all render this one document, so what is on screen is exactly what gets shared.
 */

export type ReportValueKind = 'text' | 'number' | 'money' | 'percent' | 'date' | 'quantity';

export type ReportCell = string | number | null;

export type ReportColumn = {
  key: string;
  label: string;
  kind: ReportValueKind;
  /** Shown on phones as the card title (one per table). */
  primary?: boolean;
};

export type ReportTable = {
  id: string;
  title: string;
  columns: ReportColumn[];
  rows: Record<string, ReportCell>[];
  /** Sums or averages for the table's last line. */
  totals?: Record<string, ReportCell>;
  /** Shown when there are no rows. */
  emptyText: string;
  /** A sentence under the title explaining what the table counts. */
  note?: string;
};

export type ReportTone = 'default' | 'good' | 'bad' | 'warn';

export type ReportStat = {
  label: string;
  value: number | string;
  kind: ReportValueKind;
  hint?: string;
  tone?: ReportTone;
};

export type ReportTrend = {
  title: string;
  kind: 'money' | 'number' | 'quantity';
  points: { label: string; value: number }[];
};

export type ReportDocument = {
  kind: string;
  title: string;
  /** Who or what the report is about, e.g. the customer's name on a statement. */
  subject?: string;
  range: ReportRange;
  generatedAtIso: string;
  stats: ReportStat[];
  trend?: ReportTrend;
  tables: ReportTable[];
  /** Plain-language caveats, e.g. how a figure is counted. */
  notes?: string[];
};

/** A filter a report offers (route, delivery boy, product …). `all` is always the first option. */
export type ReportFilterDef = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

export const ALL = 'all';

export type ReportFilterValues = Record<string, string>;
