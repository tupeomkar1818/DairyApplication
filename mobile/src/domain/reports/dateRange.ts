import { strings } from '@/src/i18n/strings';

/**
 * Date ranges for reports.
 *
 * Every report reads one inclusive range of local calendar days (yyyy-mm-dd), counted on the phone's calendar —
 * the same day the rest of the app shows ("today" on the run sheet is "today" in a report).
 */

export type ReportRange = { fromYmd: string; toYmd: string };

export type ReportPresetKey =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'last7'
  | 'thisMonth'
  | 'lastMonth'
  | 'tomorrow'
  | 'next7'
  | 'custom';

/** Preset chips in order; the words come from `presetLabel` when shown. */
export const REPORT_PRESETS: readonly { key: ReportPresetKey }[] = [
  { key: 'today' },
  { key: 'yesterday' },
  { key: 'thisWeek' },
  { key: 'last7' },
  { key: 'thisMonth' },
  { key: 'lastMonth' },
  { key: 'custom' },
];

/** For reports that look ahead (the load sheet): what has to go out, rather than what went. */
export const UPCOMING_PRESETS: readonly { key: ReportPresetKey }[] = [
  { key: 'today' },
  { key: 'tomorrow' },
  { key: 'next7' },
  { key: 'yesterday' },
  { key: 'thisWeek' },
  { key: 'custom' },
];

export function presetLabel(key: ReportPresetKey): string {
  const labels = strings('reports').presets;
  return labels[key] ?? labels.custom;
}

/** A year and a day: long enough for a financial year, short enough to stay quick on a phone. */
export const MAX_REPORT_DAYS = 366;

const pad2 = (n: number) => String(n).padStart(2, '0');

export function ymdOfDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** yyyy-mm-dd → local Date, or null when it is not a real day. */
export function dateOfYmd(ymd: string): Date | null {
  const m = String(ymd ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime()) || ymdOfDate(d) !== ymd) return null;
  return d;
}

export function addDays(ymd: string, days: number): string {
  const d = dateOfYmd(ymd);
  if (!d) return ymd;
  return ymdOfDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

/** The day part of any stored date: "2026-09-05", "2026-09-05T…" (local day of the timestamp) or "05/09/2026". */
export function dayOf(value: string | null | undefined): string {
  const v = String(value ?? '').trim();
  const dmy = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return ymdOfDate(d);
  }
  return v.slice(0, 10);
}

export function presetRange(key: Exclude<ReportPresetKey, 'custom'>, now: Date = new Date()): ReportRange {
  const today = ymdOfDate(now);
  switch (key) {
    case 'today':
      return { fromYmd: today, toYmd: today };
    case 'tomorrow': {
      const t = addDays(today, 1);
      return { fromYmd: t, toYmd: t };
    }
    case 'next7':
      return { fromYmd: today, toYmd: addDays(today, 6) };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { fromYmd: y, toYmd: y };
    }
    case 'thisWeek': {
      // Weeks start on Monday.
      const back = (now.getDay() + 6) % 7;
      return { fromYmd: addDays(today, -back), toYmd: today };
    }
    case 'last7':
      return { fromYmd: addDays(today, -6), toYmd: today };
    case 'lastMonth': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { fromYmd: ymdOfDate(first), toYmd: ymdOfDate(last) };
    }
    case 'thisMonth':
    default:
      return { fromYmd: ymdOfDate(new Date(now.getFullYear(), now.getMonth(), 1)), toYmd: today };
  }
}

export function rangeDayCount(range: ReportRange): number {
  const a = dateOfYmd(range.fromYmd);
  const b = dateOfYmd(range.toYmd);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

/** Why a range cannot be run, or null when it is fine. */
export function validateRange(range: ReportRange): string | null {
  const t = strings('reports').range;
  if (!dateOfYmd(range.fromYmd) || !dateOfYmd(range.toYmd)) return t.chooseDates;
  if (range.fromYmd > range.toYmd) return t.startAfterEnd;
  if (rangeDayCount(range) > MAX_REPORT_DAYS) return t.tooLong(MAX_REPORT_DAYS);
  return null;
}

/** Every day of the range, oldest first (empty for an invalid range). */
export function daysOfRange(range: ReportRange): string[] {
  if (validateRange(range)) return [];
  const out: string[] = [];
  for (let d = range.fromYmd; d <= range.toYmd; d = addDays(d, 1)) out.push(d);
  return out;
}

export function inRange(ymd: string, range: ReportRange): boolean {
  return !!ymd && ymd >= range.fromYmd && ymd <= range.toYmd;
}

/** The same number of days immediately before the range — what "vs previous period" compares with. */
export function previousRange(range: ReportRange): ReportRange {
  const n = rangeDayCount(range);
  return { fromYmd: addDays(range.fromYmd, -n), toYmd: addDays(range.fromYmd, -1) };
}

/** yyyy-mm months the range touches, oldest first. */
export function monthsOfRange(range: ReportRange): string[] {
  if (validateRange(range)) return [];
  const out: string[] = [];
  let y = Number(range.fromYmd.slice(0, 4));
  let m = Number(range.fromYmd.slice(5, 7));
  const endKey = range.toYmd.slice(0, 7);
  for (;;) {
    const key = `${y}-${pad2(m)}`;
    out.push(key);
    if (key >= endKey) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Short month names in the app language. */
function monthShort(index: number): string {
  return strings('common').dates.monthsShort[index] ?? '';
}

function shortDay(ymd: string, withYear: boolean): string {
  const d = dateOfYmd(ymd);
  if (!d) return ymd;
  return `${pad2(d.getDate())} ${monthShort(d.getMonth())}${withYear ? ` ${d.getFullYear()}` : ''}`;
}

/** "05 Sep 2026" for one day, "01 Sep – 17 Sep 2026" within a year, "15 Dec 2025 – 10 Jan 2026" across years. */
export function formatRange(range: ReportRange): string {
  if (range.fromYmd === range.toYmd) return shortDay(range.fromYmd, true);
  const sameYear = range.fromYmd.slice(0, 4) === range.toYmd.slice(0, 4);
  return `${shortDay(range.fromYmd, !sameYear)} – ${shortDay(range.toYmd, true)}`;
}

/** The preset a range matches today, so a shared link or a reopened screen shows the right chip. */
export function matchPreset(
  range: ReportRange,
  now: Date = new Date(),
  presets: readonly { key: ReportPresetKey }[] = REPORT_PRESETS,
): ReportPresetKey {
  for (const p of presets) {
    if (p.key === 'custom') continue;
    const r = presetRange(p.key, now);
    if (r.fromYmd === range.fromYmd && r.toYmd === range.toYmd) return p.key;
  }
  return 'custom';
}

/**
 * Buckets for a trend chart: one per day up to ~6 weeks, then one per week (starting Monday), then one per month —
 * so a year never draws 365 bars on a phone.
 */
export function trendBuckets(range: ReportRange): { key: string; label: string; fromYmd: string; toYmd: string }[] {
  const days = daysOfRange(range);
  if (days.length === 0) return [];
  if (days.length <= 45) {
    return days.map((d) => ({ key: d, label: shortDay(d, false), fromYmd: d, toYmd: d }));
  }
  if (days.length <= 120) {
    const out: { key: string; label: string; fromYmd: string; toYmd: string }[] = [];
    let start = days[0]!;
    for (const d of days) {
      const date = dateOfYmd(d)!;
      const isLast = d === days[days.length - 1];
      if (date.getDay() === 0 || isLast) {
        out.push({ key: start, label: shortDay(start, false), fromYmd: start, toYmd: d });
        start = addDays(d, 1);
      }
    }
    return out;
  }
  return monthsOfRange(range).map((mk) => {
    const first = `${mk}-01`;
    const d = dateOfYmd(first)!;
    const last = ymdOfDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    return {
      key: mk,
      label: `${monthShort(d.getMonth())} ${String(d.getFullYear()).slice(2)}`,
      fromYmd: first < range.fromYmd ? range.fromYmd : first,
      toYmd: last > range.toYmd ? range.toYmd : last,
    };
  });
}
