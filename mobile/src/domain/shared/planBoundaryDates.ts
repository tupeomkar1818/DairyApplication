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
    issues.push({ path: 'startDate', message: 'Start date must be a valid DD/MM/YYYY or YYYY-MM-DD' });
    return issues;
  }
  const end = parsePlanBoundaryToDate(endRaw ?? '');
  if (!end) {
    issues.push({ path: 'endDate', message: 'End date is required and must be a valid date' });
    return issues;
  }
  if (end.getTime() < start.getTime()) {
    issues.push({
      path: 'endDate',
      message: 'End date must be on or after the start date',
    });
  }
  return issues;
}

export function isPlanStartEndMonthRuleOk(startRaw: string, endRaw: string | undefined): boolean {
  return planStartEndMonthRuleIssues(startRaw, endRaw).length === 0;
}

/**
 * For duplicate-line closure: use the proposed end date (typically the **new** line’s start, DD/MM) when it is on or
 * after the existing line’s start; otherwise use the existing line’s start so end ≥ start still holds.
 */
export function duplicateClosureEndDdMmYyyy(startRaw: string, proposedEndDdMmYyyy: string): string {
  const start = parsePlanBoundaryToDate(startRaw);
  const act = parsePlanBoundaryToDate(proposedEndDdMmYyyy);
  if (!act) return proposedEndDdMmYyyy.trim();
  if (!start) return proposedEndDdMmYyyy.trim();
  if (act.getTime() >= start.getTime()) return proposedEndDdMmYyyy.trim();
  return formatPlanBoundaryAsDdMmYyyy(start);
}
