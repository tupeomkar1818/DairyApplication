import type { Customer } from '@/customers/mapping';
import type { Row } from '@/customers/selfService';
import { planRunsOn } from '@/jobs/schedule';

/**
 * What a month's deliveries come to, before any discount.
 *
 * A port of the apps' own billing (`mobile/src/components/admin/customerSubscriptionMonthUtils.ts` and
 * `mobile/src/domain/customers/addOns.ts`). Both halves bill on one rule — the delivery boy marked it delivered —
 * so a skipped day, a paused line and a cancelled order simply never appear.
 *
 * Keep it in step with those files: a difference here is a bill that does not match the one the customer is reading.
 */

const normPack = (value: unknown): string => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const ymdOf = (value: unknown): string => String(value ?? '').slice(0, 10);
const isYmd = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** What one delivery of a line costs, and what one pack of it costs. */
export function planLineTotal(plan: Row): number {
  const items = Math.max(1, Number(plan.numberOfItems ?? 1));
  const base = Number(plan.originalPrice ?? 0);
  const discounted = Number(plan.discountedPrice ?? 0);
  const unit = discounted > 0 && discounted < base ? discounted : base;
  return Math.round(items * (Number.isFinite(unit) ? unit : 0));
}

function planUnitPrice(plan: Row): number {
  const usual = Math.max(1, Math.floor(Number(plan.numberOfItems ?? 1)) || 1);
  return planLineTotal(plan) / usual;
}

/** How a delivery is matched to a line: the product and the pack, however the label was typed. */
function attributionKey(plan: Row): string {
  return `${String(plan.productName ?? '').trim()}\u{1F}${normPack(plan.quantityLabel)}`;
}

/**
 * With two lines for the same pack overlapping on a day, the day belongs to the one that started latest (the later
 * row on a tie) — so one delivered row never bills twice.
 */
function winsDay(planIndex: number, ymd: string, plans: readonly Row[]): boolean {
  const plan = plans[planIndex];
  if (!plan) return false;
  const key = attributionKey(plan);
  let bestIndex = -1;
  let bestStart = '';
  plans.forEach((other, index) => {
    if (attributionKey(other) !== key || !planRunsOn(other, ymd)) return;
    const start = ymdOf(other.startDate);
    if (!isYmd(start)) return;
    if (bestIndex < 0 || start > bestStart || (start === bestStart && index > bestIndex)) {
      bestIndex = index;
      bestStart = start;
    }
  });
  return bestIndex === planIndex;
}

type DeliveredDay = { quantity: number; subscriptionItems?: number };

/** The days this line was delivered on, and how many packs each day billed for. */
function deliveredDays(planIndex: number, plans: readonly Row[], deliveries: readonly Row[], month?: string): Map<string, DeliveredDay> {
  const days = new Map<string, DeliveredDay>();
  const plan = plans[planIndex];
  if (!plan) return days;
  const productName = String(plan.productName ?? '').trim();
  const packLabel = normPack(plan.quantityLabel);
  if (!productName || !packLabel) return days;

  for (const delivery of deliveries) {
    if (delivery.status !== 'Delivered') continue;
    if (String(delivery.productName ?? '').trim() !== productName) continue;
    if (normPack(delivery.quantityLabel) !== packLabel) continue;
    const ymd = ymdOf(delivery.deliveryDate);
    if (!isYmd(ymd)) continue;
    if (month && ymd.slice(0, 7) !== month) continue;
    if (!planRunsOn(plan, ymd) || !winsDay(planIndex, ymd, plans)) continue;

    const recorded = delivery.subscriptionItems;
    if (recorded !== undefined && recorded !== null) {
      const items = Math.floor(Number(recorded));
      // The row is there for a one-off order of the same pack: none of the subscription went that day.
      if (!Number.isFinite(items) || items <= 0) continue;
      days.set(ymd, { quantity: items, subscriptionItems: items });
      continue;
    }
    // A day recorded before per-day quantities existed bills at the line's usual quantity.
    days.set(ymd, { quantity: 1 });
  }
  return days;
}

export type SubscriptionCharge = {
  ymd: string;
  planIndex: number;
  productName: string;
  packLabel: string;
  packs: number;
  /** Unrounded rupees; a month's charges add up to `subscriptionTotalForMonth` once rounded. */
  amount: number;
};

/** Every delivered subscription day a bill charges for, one entry per line and day. */
export function subscriptionCharges(customer: Customer, month?: string): SubscriptionCharge[] {
  const plans = ((customer.subscriptionPlans as Row[]) ?? []) as Row[];
  const deliveries = ((customer.deliveries as Row[]) ?? []) as Row[];
  const out: SubscriptionCharge[] = [];

  plans.forEach((plan, index) => {
    const lineTotal = planLineTotal(plan);
    const unit = planUnitPrice(plan);
    const usual = Math.max(1, Math.floor(Number(plan.numberOfItems ?? 1)) || 1);
    for (const [ymd, day] of deliveredDays(index, plans, deliveries, month)) {
      const recorded = day.subscriptionItems !== undefined;
      out.push({
        ymd,
        planIndex: index,
        productName: String(plan.productName ?? '').trim(),
        packLabel: String(plan.quantityLabel ?? '').trim(),
        packs: recorded ? day.subscriptionItems! : usual,
        amount: recorded ? day.subscriptionItems! * unit : lineTotal,
      });
    }
  });
  return out;
}

export function subscriptionTotalForMonth(customer: Customer, month: string): number {
  return Math.round(subscriptionCharges(customer, month).reduce((sum, charge) => sum + charge.amount, 0));
}

/** What one one-off order comes to. */
export function addOnLineTotal(order: Row): number {
  const items = Math.max(1, Math.floor(Number(order.numberOfItems ?? 1)) || 1);
  const price = Number(order.price ?? 0);
  return Math.round((Number.isFinite(price) ? price : 0) * items);
}

export function addOnDateYmd(order: Row): string {
  return ymdOf(order.deliveryDate || order.orderDate);
}

/** The one-off orders a month bills for: the ones that were delivered. */
export function deliveredAddOns(customer: Customer, month: string): Row[] {
  return ((customer.extraOrders as Row[]) ?? [])
    .filter((order) => order.status === 'Delivered' && addOnDateYmd(order).slice(0, 7) === month)
    .sort((a, b) => addOnDateYmd(a).localeCompare(addOnDateYmd(b)));
}

export function addOnTotalForMonth(customer: Customer, month: string): number {
  return Math.round(deliveredAddOns(customer, month).reduce((sum, order) => sum + addOnLineTotal(order), 0));
}

/** A month's charges: the delivered subscription days plus the delivered one-off orders. */
export function monthCharges(customer: Customer, month: string): number {
  return Math.round(subscriptionTotalForMonth(customer, month) + addOnTotalForMonth(customer, month));
}
