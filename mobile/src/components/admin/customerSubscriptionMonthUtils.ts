import { toIsoYmdFromFlexibleDate } from '@/src/components/admin/customerFormDates';
import type { CustomerSubscriptionItemDto, CustomerSubscriptionPlanDto } from '@/src/domain/customers/dtos';
import { milkLineDuplicateKey } from '@/src/domain/customers/milkLineDuplicate';

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
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const d = new Date(yyyy, mm - 1, 1);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
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

function addDaysIsoYmd(ymd: string, deltaDays: number): string {
  const [yy, mm, dd] = ymd.slice(0, 10).split('-').map((x) => Number(x));
  const d = new Date(yy, mm - 1, dd);
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function minIsoYmd(a: string, b: string): string {
  return a <= b ? a : b;
}

function maxIsoYmd(a: string, b: string): string {
  return a >= b ? a : b;
}

export function subscriptionPlanActiveSegments(p: CustomerSubscriptionPlanDto): Array<[string, string]> {
  const start = toIsoYmdFromFlexibleDate(p.startDate as string);
  if (!start) return [];
  const endParsed = toIsoYmdFromFlexibleDate(p.endDate as string);
  const end = endParsed ?? '9999-12-31';

  const ps = toIsoYmdFromFlexibleDate(p.pauseStartDate as string) ?? '';
  if (!ps || ps > end) {
    return [[start, end]];
  }

  const pe = toIsoYmdFromFlexibleDate(p.pauseEndDate as string) ?? '';
  const res = toIsoYmdFromFlexibleDate(p.resumeDate as string) ?? '';

  const dayBeforePause = addDaysIsoYmd(ps, -1);
  const out: Array<[string, string]> = [];
  const preEnd = minIsoYmd(end, dayBeforePause);
  if (start <= preEnd) out.push([start, preEnd]);

  let activeAgainFrom = '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(res)) activeAgainFrom = res;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(pe)) activeAgainFrom = addDaysIsoYmd(pe, 1);
  if (activeAgainFrom && activeAgainFrom <= end) {
    const segStart = maxIsoYmd(activeAgainFrom, start);
    if (segStart <= end) out.push([segStart, end]);
  }

  return out.length ? out : [[start, end]];
}

/** True when the plan delivers / is active on the given calendar day (YYYY-MM-DD). */
export function subscriptionPlanActiveOnDateYmd(p: CustomerSubscriptionPlanDto, ymd: string): boolean {
  const kind = p.subscriptionKind ?? 'Monthly';
  if (kind === 'Daily') {
    const dd = toIsoYmdFromFlexibleDate(p.deliveryDate as string);
    return !!dd && dd === ymd;
  }
  for (const [a, b] of subscriptionPlanActiveSegments(p)) {
    if (ymd >= a && ymd <= b) return true;
  }
  return false;
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
};

/**
 * Subscription-aligned, delivery-based days: a date counts only when `deliveries` has **Delivered** for the same
 * product + quantity label, the plan is active that day, and this plan wins duplicate-key attribution.
 * Per-day quantity is the sum of matching daily order lines (calendar) for that plan/day, or 1 if none (subscription-only mark).
 */
export function billableDeliveredDatesForPlan(
  planIndex: number,
  plans: CustomerSubscriptionPlanDto[],
  dailyOrderLines: BillableDeliveryLineInput[],
  deliveries: CustomerDeliveryRowInput[],
  monthYyyyMm?: string,
): Map<string, number> {
  const plan = plans[planIndex];
  const byDate = new Map<string, number>();
  if (!plan) return byDate;

  const pn = String(plan.productName ?? '').trim();
  const ql = normQtyLabel(plan.quantityLabel);
  if (!pn || !ql) return byDate;

  for (const d of deliveries) {
    if (d.status !== 'Delivered') continue;
    if (String(d.productName ?? '').trim() !== pn) continue;
    if (normQtyLabel(d.quantityLabel) !== ql) continue;
    const ymd = toIsoYmdFromFlexibleDate(d.deliveryDate);
    if (!ymd) continue;
    if (monthYyyyMm && !ymdInMonth(ymd, monthYyyyMm)) continue;
    if (!subscriptionPlanActiveOnDateYmd(plan, ymd)) continue;
    if (!subscriptionPlanWinsDeliveryAttributionAtYmd(planIndex, ymd, plans)) continue;

    let q = 0;
    for (const l of dailyOrderLines) {
      if (l.dateYmd !== ymd) continue;
      if (String(l.productName ?? '').trim() !== pn) continue;
      if (normQtyLabel(l.quantityLabel) !== ql) continue;
      if (!subscriptionPlanActiveOnDateYmd(plan, l.dateYmd)) continue;
      if (!subscriptionPlanWinsDeliveryAttributionAtYmd(planIndex, l.dateYmd, plans)) continue;
      q += Math.max(1, Math.floor(Number(l.quantity ?? 1)));
    }
    if (q <= 0) q = 1;
    byDate.set(ymd, q);
  }

  return byDate;
}

/** Month total: sum over subscription plan lines of (delivered billable days in month × `planLineTotal`). */
export function computeSubscriptionBillingTotalForMonth(
  monthYyyyMm: string,
  subscriptionPlans: CustomerSubscriptionPlanDto[],
  dailyOrderLines: BillableDeliveryLineInput[],
  deliveries: CustomerDeliveryRowInput[],
): number {
  let total = 0;
  for (let i = 0; i < subscriptionPlans.length; i += 1) {
    const plan = subscriptionPlans[i]!;
    const byDate = billableDeliveredDatesForPlan(i, subscriptionPlans, dailyOrderLines, deliveries, monthYyyyMm);
    total += Math.round(byDate.size * planLineTotal(plan));
  }
  return Math.round(total);
}

/**
 * When several plan rows share the same milk duplicate key and overlap on a calendar day, attribute that day to the
 * segment with the latest start date (and latest index on tie) so delivery-based amounts do not double-count.
 */
export function subscriptionPlanWinsDeliveryAttributionAtYmd(
  planIndex: number,
  ymd: string,
  plans: CustomerSubscriptionPlanDto[],
): boolean {
  if (planIndex < 0 || planIndex >= plans.length) return false;
  const key = milkLineDuplicateKey(plans[planIndex]!);
  let bestIdx = -1;
  let bestStart = '';
  for (let j = 0; j < plans.length; j++) {
    if (milkLineDuplicateKey(plans[j]!) !== key) continue;
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

/** Roll-up line total for a subscription plan row (used for temporary/permanent charge summaries). */
export function planLineTotal(p: CustomerSubscriptionPlanDto): number {
  const items = Math.max(1, Number(p.numberOfItems ?? 1));
  const base = Number(p.originalPrice ?? 0);
  const disc = Number(p.discountedPrice ?? 0);
  const unit = disc > 0 && disc < base ? disc : base;
  if ((p.subscriptionKind ?? 'Monthly') === 'Daily' && p.dailyCost != null && Number.isFinite(Number(p.dailyCost))) {
    return Math.round(Number(p.dailyCost) * items);
  }
  return Math.round(items * unit);
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
  return `${p.productName} ${p.quantityLabel}${u} · Quantity ${q}`;
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
    out.push(`${s.productName} ${s.quantityLabel} · Quantity 1`);
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
