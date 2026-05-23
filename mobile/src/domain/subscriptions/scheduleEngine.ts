import type { PlannedDayQuantityDto } from '@/src/domain/subscriptions/dtos';
import type { BaseMilkSubscription, SubscriptionDailyDelivery, SubscriptionModification } from '@/src/domain/subscriptions/entities';
import type { BaseSubscriptionDeliveryFrequency } from '@/src/domain/subscriptions/enums';

export function toYmd(iso: string): string {
  return String(iso ?? '').trim().slice(0, 10);
}

export function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((x) => Number(x));
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDaysYmd(ymd: string, deltaDays: number): string {
  const dt = ymdToUtcDate(ymd);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const da = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function endOfCalendarMonthYmd(ymd: string): string {
  const dt = ymdToUtcDate(ymd);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

/**
 * First billing window for a mid-month start: from `startDate` through the last day of that calendar month.
 */
export function firstMonthlyCycleEndYmd(startDateYmd: string): string {
  return endOfCalendarMonthYmd(startDateYmd);
}

export function nextFullCalendarMonthRange(afterEndYmd: string): { start: string; end: string } {
  const dt = ymdToUtcDate(afterEndYmd);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth();
  const firstNext = new Date(Date.UTC(y, m + 1, 1));
  const ny = firstNext.getUTCFullYear();
  const nm = firstNext.getUTCMonth();
  const start = `${ny}-${String(nm + 1).padStart(2, '0')}-01`;
  const end = endOfCalendarMonthYmd(start);
  return { start, end };
}

export function daysInMonthYyyyMm(yyyyMm: string): number {
  const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return 31;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return new Date(y, mo, 0).getDate();
}

export function isYmdWithinInclusive(ymd: string, fromYmd: string, toYmd: string): boolean {
  return ymd >= fromYmd && ymd <= toYmd;
}

export function diffDaysUtc(fromYmd: string, toYmd: string): number {
  const a = ymdToUtcDate(fromYmd).getTime();
  const b = ymdToUtcDate(toYmd).getTime();
  return Math.round((b - a) / 86400000);
}

export function isScheduledDeliveryDay(params: {
  frequency: BaseSubscriptionDeliveryFrequency;
  anchorStartYmd: string;
  dateYmd: string;
  customWeekdays?: number[];
}): boolean {
  const { frequency, anchorStartYmd, dateYmd, customWeekdays } = params;
  if (dateYmd < anchorStartYmd) return false;

  if (frequency === 'Daily') return true;

  if (frequency === 'AlternateDay') {
    const n = diffDaysUtc(anchorStartYmd, dateYmd);
    return n >= 0 && n % 2 === 0;
  }

  const w = ymdToUtcDate(dateYmd).getUTCDay();
  const set = new Set(customWeekdays ?? []);
  return set.has(w);
}

function modificationAppliesToDate(m: SubscriptionModification, subscriptionId: string, dateYmd: string): boolean {
  if (m.subscriptionId !== subscriptionId) return false;
  if (m.status !== 'Active') return false;
  const from = toYmd(m.effectiveFromDate);
  const to = toYmd(m.effectiveToDate);
  return isYmdWithinInclusive(dateYmd, from, to);
}

function pickWinningModification(candidates: SubscriptionModification[]): SubscriptionModification | null {
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => {
    const af = toYmd(a.effectiveFromDate);
    const bf = toYmd(b.effectiveFromDate);
    if (af !== bf) return bf.localeCompare(af);
    return b.createdAt.localeCompare(a.createdAt);
  });
  return sorted[0] ?? null;
}

/**
 * Day-wise planned litres: base default, overridden by the winning active modification window (latest effectiveFrom wins ties).
 */
export function plannedQuantityForDate(
  base: BaseMilkSubscription,
  modifications: SubscriptionModification[],
  dateYmd: string,
): PlannedDayQuantityDto {
  const subId = base.id;
  const start = toYmd(base.startDate);
  const end = toYmd(base.endDate);
  if (!isYmdWithinInclusive(dateYmd, start, end)) {
    return { date: dateYmd, plannedQuantityLitres: 0, source: 'BaseDefault' };
  }

  if (base.status === 'Paused') {
    return { date: dateYmd, plannedQuantityLitres: 0, source: 'BaseDefault' };
  }

  if (
    !isScheduledDeliveryDay({
      frequency: base.deliveryFrequency,
      anchorStartYmd: start,
      dateYmd,
      customWeekdays: base.customWeekdays,
    })
  ) {
    return { date: dateYmd, plannedQuantityLitres: 0, source: 'BaseDefault' };
  }

  const candidates = modifications.filter((m) => modificationAppliesToDate(m, subId, dateYmd));
  const winner = pickWinningModification(candidates);
  if (!winner) {
    return { date: dateYmd, plannedQuantityLitres: base.defaultQuantityLitres, source: 'BaseDefault' };
  }
  return {
    date: dateYmd,
    plannedQuantityLitres: winner.newQuantityLitres,
    source: 'Modification',
    winningModificationId: winner.id,
  };
}

export function buildMonthDayYmds(monthYyyyMm: string): string[] {
  const dim = daysInMonthYyyyMm(monthYyyyMm);
  const out: string[] = [];
  for (let d = 1; d <= dim; d += 1) {
    out.push(`${monthYyyyMm}-${String(d).padStart(2, '0')}`);
  }
  return out;
}

/**
 * Billable litres for monthly settlement: **only** what the delivery boy actually delivered,
 * once the row is in a final state. `NotDelivered` → 0. `Delivered` / `Partial` → `deliveredQuantityLitres`.
 * Mismatch rows bill **0** until admin approves (`Pending`) or if approval was **Rejected**.
 */
export function billableLitresFromDeliveryRow(row: SubscriptionDailyDelivery): number {
  if (row.adminApprovalStatus === 'Pending' || row.adminApprovalStatus === 'Rejected') return 0;
  if (row.deliveryStatus === 'NotDelivered') return 0;
  const q = Number(row.deliveredQuantityLitres ?? 0);
  if (!Number.isFinite(q) || q < 0) return 0;
  return q;
}
