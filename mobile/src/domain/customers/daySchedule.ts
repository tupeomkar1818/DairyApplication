import type {
  Customer,
  CustomerSubscriptionException,
  CustomerSubscriptionPlan,
} from '@/src/domain/customers/entities';
import { subscriptionPlanActiveOnDateYmd } from '@/src/domain/customers/planSchedule';
import { dairyTimeLabel } from '@/src/domain/shared/dairyClock';
import type { Lang } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';

/**
 * What is actually deliverable to a customer on a given day, how many of each, and how late they may still change it.
 *
 * A subscription line runs on a day when its own schedule says so, no skip covers that day, and its quantity for
 * the day is above zero. Day changes are the one mechanism behind "no milk tomorrow", "we're away next week",
 * "pause for a year" and "3 packets on the 15th" — one rule for the run sheet, the admin's day view, the customer's
 * calendar and the bill.
 */

/** Deliveries go out early, so a day is locked at 9 pm the evening before. */
export const ORDER_CUTOFF_HOUR = 21;

/** Most packs a customer can ask for in one day. */
export const MAX_DAY_QUANTITY = 20;

type PlanLike = Pick<CustomerSubscriptionPlan, 'id' | 'numberOfItems'> & Parameters<typeof subscriptionPlanActiveOnDateYmd>[0];

function isYmd(value: string | undefined | null): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isSkip(exception: Pick<CustomerSubscriptionException, 'kind'>): boolean {
  return (exception.kind ?? 'skip') === 'skip';
}

/** True when this day change covers the given day for the given plan line. */
export function exceptionCoversDay(
  exception: Pick<CustomerSubscriptionException, 'fromYmd' | 'toYmd' | 'planId'>,
  ymd: string,
  planId?: string,
): boolean {
  const from = String(exception.fromYmd ?? '').slice(0, 10);
  const to = String(exception.toYmd ?? from).slice(0, 10);
  if (!isYmd(from) || !isYmd(to)) return false;
  if (ymd < from || ymd > to) return false;
  // A skip without a plan id covers the whole day, whatever is subscribed.
  const scoped = String(exception.planId ?? '').trim();
  return !scoped || scoped === planId;
}

/** True when a skip (not a quantity change) covers the day — for the plan line, when one is given. */
export function isDaySkipped(
  exceptions: readonly CustomerSubscriptionException[] | undefined,
  ymd: string,
  planId?: string,
): boolean {
  return (exceptions ?? []).some((ex) => isSkip(ex) && exceptionCoversDay(ex, ymd, planId));
}

/** The line's usual packs per day (1 when unset). */
export function usualQuantity(plan: Pick<CustomerSubscriptionPlan, 'numberOfItems'>): number {
  const n = Math.floor(Number(plan.numberOfItems ?? 1));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** The quantity change in force for this line on this day, if any: the newest one covering it. */
export function quantityChangeOn(
  plan: Pick<CustomerSubscriptionPlan, 'id'>,
  ymd: string,
  exceptions: readonly CustomerSubscriptionException[] | undefined,
): CustomerSubscriptionException | null {
  const planId = String(plan.id ?? '').trim();
  if (!planId) return null;
  const covering = (exceptions ?? []).filter(
    (ex) => ex.kind === 'quantity' && String(ex.planId ?? '').trim() === planId && exceptionCoversDay(ex, ymd, planId),
  );
  if (!covering.length) return null;
  return covering.reduce((latest, ex) =>
    String(ex.createdAt ?? '') >= String(latest.createdAt ?? '') ? ex : latest,
  );
}

/**
 * How many packs of this line go out on this day: 0 when the line is not running or is skipped, the newest
 * quantity change when one covers the day, and the usual quantity otherwise.
 */
export function planQuantityOn(
  plan: PlanLike,
  ymd: string,
  exceptions: readonly CustomerSubscriptionException[] | undefined,
): number {
  if (!subscriptionPlanActiveOnDateYmd(plan, ymd)) return 0;
  if (isDaySkipped(exceptions, ymd, plan.id)) return 0;
  const change = quantityChangeOn(plan, ymd, exceptions);
  if (change) {
    const n = Math.floor(Number(change.numberOfItems ?? 0));
    return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_DAY_QUANTITY) : 0;
  }
  return usualQuantity(plan);
}

/** The plan runs on this day: its schedule says so, nothing skips it, and at least one pack is due. */
export function isPlanDeliverableOn(
  plan: PlanLike,
  ymd: string,
  exceptions: readonly CustomerSubscriptionException[] | undefined,
): boolean {
  return planQuantityOn(plan, ymd, exceptions) > 0;
}

/** The customer's subscription lines that actually go out on this day. */
export function deliverablePlansOn<T extends PlanLike>(
  customer: Pick<Customer, 'subscriptionExceptions'> & { subscriptionPlans?: T[] },
  ymd: string,
): T[] {
  return (customer.subscriptionPlans ?? []).filter((p) => isPlanDeliverableOn(p, ymd, customer.subscriptionExceptions));
}

/** Each line going out on this day with its quantity for the day. */
export function plannedLinesOn<T extends PlanLike>(
  customer: Pick<Customer, 'subscriptionExceptions'> & { subscriptionPlans?: T[] },
  ymd: string,
): { plan: T; quantity: number }[] {
  const out: { plan: T; quantity: number }[] = [];
  for (const plan of customer.subscriptionPlans ?? []) {
    const quantity = planQuantityOn(plan, ymd, customer.subscriptionExceptions);
    if (quantity > 0) out.push({ plan, quantity });
  }
  return out;
}

export type DayEditability =
  | { editable: true }
  | {
      editable: false;
      reason: string;
      /** Closed by the evening cut-off, not by a delivery: only the dairy can still change it, so point the customer there. */
      contactAdmin?: true;
    };

/** "9 pm" / "रात्री 9" — the cut-off in `lang` (the app's language by default). Read it when the text is shown. */
export function orderCutoffLabel(lang?: Lang): string {
  return dairyTimeLabel(ORDER_CUTOFF_HOUR, 0, lang);
}

/** When the customer's changes for a day close: 9 pm on the evening before, by the phone's own clock and time zone. */
export function customerCutoffFor(ymd: string): Date {
  return new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)) - 1, ORDER_CUTOFF_HOUR, 0, 0, 0);
}

/** Who is changing a customer's day: the customer in their app, or the dairy on their behalf. */
export type DayChangeActor = 'customer' | 'admin';

/**
 * Whether this person may still change the day.
 *
 * Both are locked out once the day has been marked delivered or not delivered. The customer is also held to the
 * evening cut-off; the admin is not — they sit with the delivery boy and can still change what goes on the van,
 * and the run sheet picks the change up straight away.
 */
export function dayEditability(
  customer: Pick<Customer, 'deliveries'>,
  ymd: string,
  actor: DayChangeActor,
  now: Date = new Date(),
): DayEditability {
  if (actor === 'customer') return dayEditabilityForCustomer(customer, ymd, now);
  if (!isYmd(ymd)) return { editable: false, reason: strings('customer').dayRules.invalidDate };
  const marked = (customer.deliveries ?? []).some((d) => String(d.deliveryDate ?? '').slice(0, 10) === ymd);
  if (marked) return { editable: false, reason: strings('customer').dayRules.markedByDeliveryBoy };
  return { editable: true };
}

/**
 * Whether the customer may still skip a day or order for it.
 *
 * Locked once the day has been delivered or marked not delivered (the van has been), and otherwise from the
 * cut-off on the evening before — tomorrow can be changed until 9 pm today (phone time), and from 9 pm only the dairy
 * can change it, because a later change would not reach the person loading the crates.
 */
export function dayEditabilityForCustomer(
  customer: Pick<Customer, 'deliveries'>,
  ymd: string,
  now: Date = new Date(),
): DayEditability {
  if (!isYmd(ymd)) return { editable: false, reason: strings('customer').dayRules.invalidDate };

  const marked = (customer.deliveries ?? []).some((d) => String(d.deliveryDate ?? '').slice(0, 10) === ymd);
  if (marked) return { editable: false, reason: strings('customer').dayRules.delivered };

  if (now.getTime() >= customerCutoffFor(ymd).getTime()) {
    return {
      editable: false,
      reason: strings('customer').dayRules.closed(orderCutoffLabel()),
      contactAdmin: true,
    };
  }
  return { editable: true };
}
