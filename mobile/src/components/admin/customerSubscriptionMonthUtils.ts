import { toIsoYmdFromFlexibleDate } from '@/src/components/admin/customerFormDates';
import { deliveredAddOnTotalForMonth } from '@/src/domain/customers/addOns';
import type { CustomerSubscriptionItemDto, CustomerSubscriptionPlanDto } from '@/src/domain/customers/dtos';
import type { Customer } from '@/src/domain/customers/entities';
import {
  planLineTotal,
  subscriptionPlanActiveOnDateYmd,
  subscriptionPlanActiveSegments,
} from '@/src/domain/customers/planSchedule';
import { strings } from '@/src/i18n/strings';

/** Plan calendar rules live in the domain layer (also used by the mock service); re-exported for existing UI imports. */
export { planLineTotal, subscriptionPlanActiveOnDateYmd, subscriptionPlanActiveSegments };

export function daysInMonth(yyyyMm: string): number {
  const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return 31;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return new Date(y, mo, 0).getDate();
}

export function shiftMonth(yyyyMm: string, deltaMonths: number): string {
  const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return yyyyMm;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const d = new Date(yyyy, mm - 1, 1);
  d.setMonth(d.getMonth() + deltaMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(yyyyMm: string): string {
  const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return yyyyMm;
  const mm = Number(m[2]);
  if (mm < 1 || mm > 12) return yyyyMm;
  // "Sep 2026" — month names follow the app language, not the phone's locale.
  return `${strings('common').dates.monthsShort[mm - 1]} ${m[1]}`;
}

/** Display label for a stored enum value (the value itself when it has no label). */
function enumLabel(labels: Record<string, string>, value: string | undefined | null): string {
  const v = String(value ?? '');
  return Object.prototype.hasOwnProperty.call(labels, v) ? labels[v]! : v;
}

/** A line's delivery frequency ("Daily", "Alternate Day", …) in the app language. */
export function frequencyLabel(value: string | undefined | null): string {
  return enumLabel(strings('subscriptionEditor').enums.frequency, value);
}

/** "Morning", "Evening", "Both" in the app language. */
export function deliveryTimeLabel(value: string | undefined | null): string {
  return enumLabel(strings('subscriptionEditor').enums.deliveryTime, value);
}

/** A plan line's status ("Active", "Paused", …) in the app language. */
export function planStatusLabel(value: string | undefined | null): string {
  return enumLabel(strings('subscriptionEditor').enums.planStatus, value);
}

export function monthIndex(yyyyMm: string): number {
  const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return Number.NEGATIVE_INFINITY;
  return Number(m[1]) * 12 + (Number(m[2]) - 1);
}

export function parseSubscriptionMonthKey(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  const iso = s.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const ddmmyyyy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}`;
  return '';
}

function normQtyLabel(s: string | undefined): string {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function ymdInMonth(ymd: string, monthYyyyMm: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) && ymd.slice(0, 7) === monthYyyyMm;
}

export type BillableDeliveryLineInput = {
  dateYmd: string;
  productName: string;
  quantityLabel: string;
  quantity: number;
};

export type CustomerDeliveryRowInput = {
  deliveryDate: string;
  productName: string;
  quantityLabel: string;
  status: string;
  /** Packs of the subscription delivered that day; absent on rows written before per-day quantities existed. */
  subscriptionItems?: number;
};

type DeliveredPlanDay = {
  /** Quantity shown for the day: delivered subscription packs, else the calendar's day quantity, else 1. */
  quantity: number;
  /** Delivered subscription packs recorded on the row, when the row has them. */
  subscriptionItems?: number;
};

/**
 * Subscription-aligned, delivery-based days: a date counts only when `deliveries` has **Delivered** for the same
 * product + quantity label, the plan is active that day, and this plan wins duplicate-key attribution.
 * Per-day quantity is the subscription packs recorded on the delivery row; for older rows, the sum of matching daily
 * order lines (calendar) for that plan/day, or 1 if none (subscription-only mark).
 */
export function billableDeliveredDatesForPlan(
  planIndex: number,
  plans: CustomerSubscriptionPlanDto[],
  dailyOrderLines: BillableDeliveryLineInput[],
  deliveries: CustomerDeliveryRowInput[],
  monthYyyyMm?: string,
): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const [ymd, day] of deliveredPlanDays(planIndex, plans, dailyOrderLines, deliveries, monthYyyyMm)) {
    byDate.set(ymd, day.quantity);
  }
  return byDate;
}

function deliveredPlanDays(
  planIndex: number,
  plans: CustomerSubscriptionPlanDto[],
  dailyOrderLines: BillableDeliveryLineInput[],
  deliveries: CustomerDeliveryRowInput[],
  monthYyyyMm?: string,
): Map<string, DeliveredPlanDay> {
  const plan = plans[planIndex];
  const byDate = new Map<string, DeliveredPlanDay>();
  if (!plan) return byDate;

  const pn = String(plan.productName ?? '').trim();
  const ql = normQtyLabel(plan.quantityLabel);
  if (!pn || !ql) return byDate;

  // Index dailyOrderLines by date for O(1) lookup
  const dailyOrdersByDate = new Map<string, number>();
  for (const l of dailyOrderLines) {
    if (monthYyyyMm && !ymdInMonth(l.dateYmd, monthYyyyMm)) continue;
    if (String(l.productName ?? '').trim() !== pn) continue;
    if (normQtyLabel(l.quantityLabel) !== ql) continue;
    if (!subscriptionPlanActiveOnDateYmd(plan, l.dateYmd)) continue;
    if (!subscriptionPlanWinsDeliveryAttributionAtYmd(planIndex, l.dateYmd, plans)) continue;

    const qty = Math.max(1, Math.floor(Number(l.quantity ?? 1)));
    dailyOrdersByDate.set(l.dateYmd, (dailyOrdersByDate.get(l.dateYmd) ?? 0) + qty);
  }

  for (const d of deliveries) {
    if (d.status !== 'Delivered') continue;
    if (String(d.productName ?? '').trim() !== pn) continue;
    if (normQtyLabel(d.quantityLabel) !== ql) continue;
    const ymd = toIsoYmdFromFlexibleDate(d.deliveryDate);
    if (!ymd) continue;
    if (monthYyyyMm && !ymdInMonth(ymd, monthYyyyMm)) continue;
    if (!subscriptionPlanActiveOnDateYmd(plan, ymd)) continue;
    if (!subscriptionPlanWinsDeliveryAttributionAtYmd(planIndex, ymd, plans)) continue;

    const recorded = d.subscriptionItems;
    if (recorded !== undefined && recorded !== null) {
      const items = Math.floor(Number(recorded));
      // The row exists for a one-off order of the same pack; none of the subscription went that day.
      if (!Number.isFinite(items) || items <= 0) continue;
      byDate.set(ymd, { quantity: items, subscriptionItems: items });
      continue;
    }
    byDate.set(ymd, { quantity: dailyOrdersByDate.get(ymd) ?? 1 });
  }

  return byDate;
}

/**
 * What one pack of a line costs. `planLineTotal` prices the line's usual quantity, so a day with a different
 * quantity is charged per pack.
 */
function planUnitPrice(plan: CustomerSubscriptionPlanDto): number {
  const usual = Math.max(1, Math.floor(Number(plan.numberOfItems ?? 1)) || 1);
  return planLineTotal(plan) / usual;
}

/**
 * Month total for the subscription: for every delivered day, the packs of the subscription that were delivered times
 * the pack price. A day recorded before per-day quantities existed bills at the line's usual quantity, so older bills
 * come out exactly as they did.
 */
export function computeSubscriptionBillingTotalForMonth(
  monthYyyyMm: string,
  subscriptionPlans: CustomerSubscriptionPlanDto[],
  dailyOrderLines: BillableDeliveryLineInput[],
  deliveries: CustomerDeliveryRowInput[],
): number {
  let total = 0;
  for (let i = 0; i < subscriptionPlans.length; i += 1) {
    const plan = subscriptionPlans[i]!;
    const lineTotal = planLineTotal(plan);
    const unit = planUnitPrice(plan);
    for (const day of deliveredPlanDays(i, subscriptionPlans, dailyOrderLines, deliveries, monthYyyyMm).values()) {
      total += day.subscriptionItems !== undefined ? day.subscriptionItems * unit : lineTotal;
    }
  }
  return Math.round(total);
}

export type DeliveredSubscriptionCharge = {
  ymd: string;
  planIndex: number;
  productName: string;
  packLabel: string;
  /** Subscription packs billed that day (the line's usual quantity for rows written before per-day quantities). */
  packs: number;
  /** Unrounded rupees; a month's charges add up to `computeSubscriptionBillingTotalForMonth` once rounded. */
  amount: number;
};

/**
 * Every delivered subscription day the bill charges for, one entry per line and day — the per-day form of
 * `computeSubscriptionBillingTotalForMonth`, so reports over any date range count exactly what the bills count.
 */
export function deliveredSubscriptionCharges(
  subscriptionPlans: CustomerSubscriptionPlanDto[],
  deliveries: CustomerDeliveryRowInput[],
  dailyOrderLines: BillableDeliveryLineInput[] = [],
): DeliveredSubscriptionCharge[] {
  const out: DeliveredSubscriptionCharge[] = [];
  for (let i = 0; i < subscriptionPlans.length; i += 1) {
    const plan = subscriptionPlans[i]!;
    const lineTotal = planLineTotal(plan);
    const unit = planUnitPrice(plan);
    const usual = Math.max(1, Math.floor(Number(plan.numberOfItems ?? 1)) || 1);
    for (const [ymd, day] of deliveredPlanDays(i, subscriptionPlans, dailyOrderLines, deliveries)) {
      const recorded = day.subscriptionItems !== undefined;
      out.push({
        ymd,
        planIndex: i,
        productName: String(plan.productName ?? '').trim(),
        packLabel: String(plan.quantityLabel ?? '').trim(),
        packs: recorded ? day.subscriptionItems! : usual,
        amount: recorded ? day.subscriptionItems! * unit : lineTotal,
      });
    }
  }
  return out.sort((a, b) => a.ymd.localeCompare(b.ymd) || a.productName.localeCompare(b.productName));
}

/**
 * What a customer owes for a month: delivered subscription days plus delivered one-off orders.
 *
 * Both halves bill on the same rule — the delivery boy marked it delivered — so a skipped day, a paused line and a
 * cancelled add-on all simply never appear.
 */
export function computeCustomerMonthBillTotal(
  customer: Pick<Customer, 'subscriptionPlans' | 'deliveries' | 'extraOrders'>,
  monthYyyyMm: string,
  dailyOrderLines: BillableDeliveryLineInput[] = [],
): number {
  const subscription = computeSubscriptionBillingTotalForMonth(
    monthYyyyMm,
    (customer.subscriptionPlans ?? []) as CustomerSubscriptionPlanDto[],
    dailyOrderLines,
    (customer.deliveries ?? []) as CustomerDeliveryRowInput[],
  );
  return Math.round(subscription + deliveredAddOnTotalForMonth(customer, monthYyyyMm));
}

/**
 * Grouping key for delivery attribution. Must match how deliveries are matched to plans (product name + normalized
 * pack label — see `billableDeliveredDatesForPlan`); a finer key would let one Delivered row bill two plans.
 */
function deliveryAttributionKey(p: CustomerSubscriptionPlanDto): string {
  return `${String(p.productName ?? '').trim()}\u{1F}${normQtyLabel(p.quantityLabel)}`;
}

/**
 * When several plan rows share the same product + pack and overlap on a calendar day, attribute that day to the
 * segment with the latest start date (and latest index on tie) so delivery-based amounts do not double-count.
 */
export function subscriptionPlanWinsDeliveryAttributionAtYmd(
  planIndex: number,
  ymd: string,
  plans: CustomerSubscriptionPlanDto[],
): boolean {
  if (planIndex < 0 || planIndex >= plans.length) return false;
  const key = deliveryAttributionKey(plans[planIndex]!);
  let bestIdx = -1;
  let bestStart = '';
  for (let j = 0; j < plans.length; j++) {
    if (deliveryAttributionKey(plans[j]!) !== key) continue;
    if (!subscriptionPlanActiveOnDateYmd(plans[j]!, ymd)) continue;
    const sy = toIsoYmdFromFlexibleDate(plans[j]!.startDate as string) ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sy)) continue;
    if (bestIdx < 0 || sy > bestStart || (sy === bestStart && j > bestIdx)) {
      bestIdx = j;
      bestStart = sy;
    }
  }
  return bestIdx === planIndex;
}

export function subscriptionPlanShowsInCalendarMonth(yyyyMm: string, p: CustomerSubscriptionPlanDto): boolean {
  const kind = p.subscriptionKind ?? 'Monthly';
  if (kind === 'Daily') {
    const dd = toIsoYmdFromFlexibleDate(p.deliveryDate as string);
    if (dd) return dd.slice(0, 7) === yyyyMm;
  }

  const dim = daysInMonth(yyyyMm);
  const monthEnd = `${yyyyMm}-${String(dim).padStart(2, '0')}`;
  const monthStart = `${yyyyMm}-01`;
  for (const [a, b] of subscriptionPlanActiveSegments(p)) {
    if (a <= monthEnd && b >= monthStart) return true;
  }
  return false;
}

/** Sum of temporary add-on line totals that fall in the given calendar month (YYYY-MM). */
export function extraTemporaryChargesForCalendarMonth(
  yyyyMm: string,
  plans: CustomerSubscriptionPlanDto[] | undefined,
): number {
  return (plans ?? [])
    .filter((p) => subscriptionPlanShowsInCalendarMonth(yyyyMm, p) && p.productAdditionTag === 'Temporary')
    .reduce((s, p) => s + planLineTotal(p), 0);
}

/** One-line label for UI (e.g. base subscription card example). */
export function formatSubscriptionPlanAsOrderExample(p: CustomerSubscriptionPlanDto): string {
  const u = p.unitType ? ` (${p.unitType})` : '';
  const q = Math.max(1, Number(p.numberOfItems ?? 1));
  return strings('subscriptionEditor').orderExample(p.productName, `${p.quantityLabel}${u}`, q);
}

/**
 * Prefer active Daily-frequency plans, then Daily subscription kind, then any active plan, then legacy `subscription[]`.
 */
export function pickDailySubscriptionExamples(
  plans: CustomerSubscriptionPlanDto[] | undefined,
  subscriptionItems: CustomerSubscriptionItemDto[] | undefined,
  maxExamples = 4,
): string[] {
  const out: string[] = [];
  const pl = plans ?? [];
  const dailyFreq = pl.filter((p) => p.status === 'Active' && p.frequency === 'Daily');
  for (const p of dailyFreq.slice(0, maxExamples)) out.push(formatSubscriptionPlanAsOrderExample(p));
  if (out.length) return out;
  const dailyKind = pl.filter((p) => p.status === 'Active' && (p.subscriptionKind ?? 'Monthly') === 'Daily');
  for (const p of dailyKind.slice(0, maxExamples)) out.push(formatSubscriptionPlanAsOrderExample(p));
  if (out.length) return out;
  const active = pl.filter((p) => p.status === 'Active');
  for (const p of active.slice(0, maxExamples)) out.push(formatSubscriptionPlanAsOrderExample(p));
  if (out.length) return out;
  for (const s of (subscriptionItems ?? []).slice(0, maxExamples)) {
    out.push(strings('subscriptionEditor').orderExample(s.productName, s.quantityLabel, 1));
  }
  return out;
}

export function buildSubscriptionMonthOptions(subscriptionStartIso: string | undefined, monthKey: string): string[] {
  const startMonth = parseSubscriptionMonthKey(subscriptionStartIso);
  const lowerBound = shiftMonth(monthKey, -6);
  const minMonth = startMonth && monthIndex(startMonth) > monthIndex(lowerBound) ? startMonth : lowerBound;
  const out: string[] = [];
  let cursor = monthKey;
  while (monthIndex(cursor) >= monthIndex(minMonth)) {
    out.push(cursor);
    const next = shiftMonth(cursor, -1);
    if (next === cursor) break;
    cursor = next;
  }
  return out;
}
