import { strings } from '@/src/i18n/strings';

/**
 * Subscription plan start/end boundaries — domain-only parsing for Zod and shared rules.
 * Accepts DD/MM/YYYY (UI) or YYYY-MM-DD (stored / API-shaped).
 */

function parseDdMmYyyy(s: string): Date | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
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

function parseIsoYmd(s: string): Date | null {
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

export function parsePlanBoundaryToDate(value: string | undefined | null): Date | null {
  const t = String(value ?? '').trim();
  if (!t) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) return parseDdMmYyyy(t);
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return parseIsoYmd(t);
  return null;
}

/** Local-calendar YYYY-MM-DD for a Date (never via `toISOString`, which shifts to UTC). */
export function formatLocalIsoYmd(d: Date): string {
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** DD/MM/YYYY or YYYY-MM-DD… → validated YYYY-MM-DD, else null. */
export function planBoundaryToIsoYmd(value: string | undefined | null): string | null {
  const d = parsePlanBoundaryToDate(value);
  return d ? formatLocalIsoYmd(d) : null;
}

export function formatPlanBoundaryAsDdMmYyyy(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export function endOfMonthForDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Last calendar day of the month for a valid DD/MM/YYYY string. */
export function endOfMonthDdMmYyyy(ddmmyyyy: string): string | null {
  const d = parseDdMmYyyy(ddmmyyyy);
  if (!d) return null;
  return formatPlanBoundaryAsDdMmYyyy(endOfMonthForDate(d));
}

export function expectedEndDdMmYyyyForPlanStart(startRaw: string): string | null {
  const start = parsePlanBoundaryToDate(startRaw);
  if (!start) return null;
  return formatPlanBoundaryAsDdMmYyyy(endOfMonthForDate(start));
}

export type PlanStartEndIssuePath = 'startDate' | 'endDate';

export function planStartEndMonthRuleIssues(
  startRaw: string,
  endRaw: string | undefined,
): { path: PlanStartEndIssuePath; message: string }[] {
  const issues: { path: PlanStartEndIssuePath; message: string }[] = [];
  const start = parsePlanBoundaryToDate(startRaw);
  if (!start) {
    issues.push({ path: 'startDate', message: strings('customer').planDates.startInvalid });
    return issues;
  }
  const end = parsePlanBoundaryToDate(endRaw ?? '');
  if (!end) {
    issues.push({ path: 'endDate', message: strings('customer').planDates.endRequired });
    return issues;
  }
  if (end.getTime() < start.getTime()) {
    issues.push({
      path: 'endDate',
      message: strings('customer').planDates.endBeforeStart,
    });
  }
  return issues;
}

export function isPlanStartEndMonthRuleOk(startRaw: string, endRaw: string | undefined): boolean {
  return planStartEndMonthRuleIssues(startRaw, endRaw).length === 0;
}

/**
 * For duplicate-line closure: end the existing line the day **before** the new line’s start so the two lines never
 * overlap (a shared day would be billed twice). Never earlier than the existing line’s own start, so end ≥ start
 * still holds (same-day replacement leaves a one-day overlap that delivery attribution resolves to the newer line).
 */
export function duplicateClosureEndDdMmYyyy(startRaw: string, newLineStartDdMmYyyy: string): string {
  const start = parsePlanBoundaryToDate(startRaw);
  const newStart = parsePlanBoundaryToDate(newLineStartDdMmYyyy);
  if (!newStart) return newLineStartDdMmYyyy.trim();
  const dayBefore = new Date(newStart.getFullYear(), newStart.getMonth(), newStart.getDate() - 1);
  if (!start || dayBefore.getTime() >= start.getTime()) return formatPlanBoundaryAsDdMmYyyy(dayBefore);
  return formatPlanBoundaryAsDdMmYyyy(start);
}
