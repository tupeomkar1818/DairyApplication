/** DD/MM/YYYY helpers shared by customer forms and subscription editor. */

export function fmtDdMmYyyy(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export function dobToDate(value: string): Date | null {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

export function dateToDob(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export function dobToIsoDate(value: string): string | null {
  const d = dobToDate(value);
  if (!d) return null;
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function isoDateToDob(value: string): string | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  return dateToDob(d);
}

/** Last calendar day of the month for a valid DD/MM/YYYY string. */
export { endOfMonthDdMmYyyy } from '@/src/domain/shared/planBoundaryDates';

/** Accept ISO YYYY-MM-DD… or DD/MM/YYYY for subscription plan boundaries. */
export function toIsoYmdFromFlexibleDate(value: string | undefined | null): string | null {
  const t = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) return dobToIsoDate(t);
  return null;
}

/**
 * Any stored date shape → DD/MM/YYYY for form fields ('' when empty/unparseable).
 * Accepts DD/MM/YYYY, YYYY-MM-DD and full ISO timestamps (timestamps use the local calendar day, not the UTC one).
 */
export function toDdMmYyyyFromFlexibleDate(value: string | undefined | null): string {
  const v = String(value ?? '').trim();
  if (!v) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return dobToDate(v) ? v : '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return dateToDob(d);
  }
  const ymd = toIsoYmdFromFlexibleDate(v);
  return ymd ? isoDateToDob(ymd) ?? '' : '';
}

/**
 * Last day of the calendar month that is `monthsAfterStartMonth` after the start date’s month
 * (e.g. start Jan + 11 → last day of December same year).
 */
export function endOfMonthAfterCalendarMonthsFromDdMmYyyy(ddmmyyyy: string, monthsAfterStartMonth: number): string | null {
  const d = dobToDate(ddmmyyyy.trim());
  if (!d) return null;
  const last = new Date(d.getFullYear(), d.getMonth() + monthsAfterStartMonth + 1, 0);
  return dateToDob(last);
}
