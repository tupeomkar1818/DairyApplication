import { shiftYmd, todayYmd } from '@/src/components/admin/dashboardMetrics';
import {
  DayLockedError,
  nextOrderableDayYmd,
  SubscriptionDateError,
} from '@/src/components/customer/customerActions';
import {
  MAX_DAY_QUANTITY,
  planQuantityOn,
  quantityChangeOn,
  usualQuantity,
} from '@/src/domain/customers/daySchedule';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { planLineTotal, subscriptionPlanActiveOnDateYmd } from '@/src/domain/customers/planSchedule';
import { strings } from '@/src/i18n/strings';
import { formatDay } from '@/src/utils/format';

/**
 * Changes a customer makes to a subscription as a whole: the everyday quantity, the end date, stopping it, and
 * undoing a day change. Every one of them respects the cut-off — days already arranged for delivery stay as they were.
 */

type Plan = NonNullable<CustomerResponse['subscriptionPlans']>[number];
type Exception = NonNullable<CustomerResponse['subscriptionExceptions']>[number];
type Delivery = NonNullable<CustomerResponse['deliveries']>[number];

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function ymdOf(value: string | undefined): string {
  return String(value ?? '').slice(0, 10);
}

function readableDay(ymd: string): string {
  return formatDay(ymd);
}

function findPlan(customer: CustomerResponse, planId: string): Plan | null {
  return (customer.subscriptionPlans ?? []).find((p) => p.id === planId) ?? null;
}

/** The last day whose delivery is already arranged: the day before the first day a change can still reach. */
export function lastArrangedDayYmd(customer: CustomerResponse, now: Date = new Date()): string {
  return shiftYmd(nextOrderableDayYmd(customer, now), -1);
}

/**
 * Changes how many packs come every day, from the first day a change can reach.
 *
 * The past keeps its quantity: delivered days that never recorded a pack count are stamped with the old quantity
 * (so their bill does not change), and days already arranged but not yet delivered are held at the old quantity.
 */
export function changeDailyQuantity(
  customer: CustomerResponse,
  input: { planId: string; numberOfItems: number; now?: Date; nowIso?: string },
): {
  subscriptionPlans: Plan[];
  subscriptionExceptions: Exception[];
  deliveries: Delivery[];
  fromYmd: string;
} {
  const now = input.now ?? new Date();
  const nowIso = input.nowIso ?? now.toISOString();
  const plans = customer.subscriptionPlans ?? [];
  const exceptions = customer.subscriptionExceptions ?? [];
  const deliveries = customer.deliveries ?? [];
  const fromYmd = nextOrderableDayYmd(customer, now);

  const plan = findPlan(customer, input.planId);
  const wanted = Math.max(1, Math.min(MAX_DAY_QUANTITY, Math.floor(Number(input.numberOfItems) || 1)));
  if (!plan) return { subscriptionPlans: plans, subscriptionExceptions: exceptions, deliveries, fromYmd };

  const old = usualQuantity(plan);
  if (wanted === old) return { subscriptionPlans: plans, subscriptionExceptions: exceptions, deliveries, fromYmd };

  const product = String(plan.productName ?? '').trim();
  const pack = String(plan.quantityLabel ?? '').trim();
  const matches = (d: Delivery) =>
    String(d.productName ?? '').trim() === product && String(d.quantityLabel ?? '').trim() === pack;

  // Delivered days before the change keep billing at the old quantity.
  const nextDeliveries = deliveries.map((d) => {
    const ymd = ymdOf(d.deliveryDate);
    if (d.status !== 'Delivered' || !matches(d) || ymd >= fromYmd) return d;
    if (d.subscriptionItems !== undefined && d.subscriptionItems !== null) return d;
    if (!subscriptionPlanActiveOnDateYmd(plan, ymd)) return d;
    return { ...d, subscriptionItems: old, numberOfItems: d.numberOfItems ?? old } as Delivery;
  });

  // Days already arranged but not yet delivered stay at the old quantity.
  const held: Exception[] = [];
  for (let ymd = todayYmd(now); ymd < fromYmd; ymd = shiftYmd(ymd, 1)) {
    if (!subscriptionPlanActiveOnDateYmd(plan, ymd)) continue;
    if (deliveries.some((d) => ymdOf(d.deliveryDate) === ymd && matches(d))) continue;
    if (quantityChangeOn(plan, ymd, exceptions)) continue;
    held.push({
      id: newId('qty'),
      kind: 'quantity',
      planId: plan.id,
      fromYmd: ymd,
      toYmd: ymd,
      numberOfItems: old,
      reason: 'Kept at the old quantity: already arranged when the daily quantity changed',
      createdBy: 'customer',
      createdAt: nowIso,
      updatedAt: nowIso,
    } as Exception);
  }

  return {
    subscriptionPlans: plans.map((p) => (p.id === plan.id ? ({ ...p, numberOfItems: wanted, updatedAt: nowIso } as Plan) : p)),
    subscriptionExceptions: [...exceptions, ...held],
    deliveries: nextDeliveries,
    fromYmd,
  };
}

/**
 * Sets a subscription's last day, or makes it run until stopped (`endYmd` omitted). An end cannot cut off days whose
 * delivery is already arranged.
 *
 * @throws SubscriptionDateError for an end before the start or before the last arranged day.
 */
export function changeEndDate(
  customer: CustomerResponse,
  input: { planId: string; endYmd?: string; now?: Date; nowIso?: string },
): { subscriptionPlans: Plan[] } {
  const now = input.now ?? new Date();
  const nowIso = input.nowIso ?? now.toISOString();
  const plans = customer.subscriptionPlans ?? [];
  const plan = findPlan(customer, input.planId);
  if (!plan) return { subscriptionPlans: plans };

  const endYmd = input.endYmd ? ymdOf(input.endYmd) : undefined;
  if (endYmd !== undefined) {
    const t = strings('customer').subscriptionRules;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) throw new SubscriptionDateError(t.invalidEnd);
    const start = ymdOf(plan.startDate);
    if (endYmd < start) throw new SubscriptionDateError(t.endBeforeStart);
    const lastArranged = lastArrangedDayYmd(customer, now);
    if (endYmd < lastArranged && lastArranged >= start) {
      throw new SubscriptionDateError(t.earliestEnd(readableDay(lastArranged)));
    }
  }

  return {
    subscriptionPlans: plans.map((p) =>
      p.id === plan.id
        ? ({ ...p, endDate: endYmd, openEnded: endYmd === undefined, status: 'Active', updatedAt: nowIso } as Plan)
        : p,
    ),
  };
}

/**
 * Stops a subscription after the days already arranged. One that has not started delivering yet is cancelled
 * outright. Its history stays, so past bills are unaffected.
 */
export function stopSubscription(
  customer: CustomerResponse,
  input: { planId: string; now?: Date; nowIso?: string },
): { subscriptionPlans: Plan[]; lastDayYmd: string | null } {
  const now = input.now ?? new Date();
  const nowIso = input.nowIso ?? now.toISOString();
  const plans = customer.subscriptionPlans ?? [];
  const plan = findPlan(customer, input.planId);
  if (!plan) return { subscriptionPlans: plans, lastDayYmd: null };

  const lastArranged = lastArrangedDayYmd(customer, now);
  const start = ymdOf(plan.startDate);

  if (start > lastArranged) {
    return {
      subscriptionPlans: plans.map((p) => (p.id === plan.id ? ({ ...p, status: 'Inactive', updatedAt: nowIso } as Plan) : p)),
      lastDayYmd: null,
    };
  }

  const currentEnd = ymdOf(plan.endDate);
  const lastDayYmd = currentEnd && !plan.openEnded && currentEnd < lastArranged ? currentEnd : lastArranged;
  return {
    subscriptionPlans: plans.map((p) =>
      p.id === plan.id ? ({ ...p, endDate: lastDayYmd, openEnded: false, updatedAt: nowIso } as Plan) : p,
    ),
    lastDayYmd,
  };
}

/**
 * Undoes a skip, pause or quantity change. A change that has already started keeps its past days and ends before
 * the first day a change can still reach.
 *
 * @throws DayLockedError when the whole change is already in the past or arranged.
 */
export function removeDayChange(
  customer: CustomerResponse,
  input: { exceptionId: string; now?: Date; nowIso?: string },
): { subscriptionExceptions: Exception[] } {
  const now = input.now ?? new Date();
  const nowIso = input.nowIso ?? now.toISOString();
  const exceptions = customer.subscriptionExceptions ?? [];
  const change = exceptions.find((ex) => ex.id === input.exceptionId);
  if (!change) return { subscriptionExceptions: exceptions };

  const first = nextOrderableDayYmd(customer, now);
  const from = ymdOf(change.fromYmd);
  const to = ymdOf(change.toYmd || change.fromYmd);

  if (to < first) throw new DayLockedError(strings('customer').subscriptionRules.cannotUndo);
  if (from >= first) return { subscriptionExceptions: exceptions.filter((ex) => ex.id !== change.id) };

  return {
    subscriptionExceptions: exceptions.map((ex) =>
      ex.id === change.id ? ({ ...ex, toYmd: shiftYmd(first, -1), updatedAt: nowIso } as Exception) : ex,
    ),
  };
}

export type SubscriptionCardStatus = 'active' | 'starts' | 'offToday' | 'ending' | 'ended';

export type SubscriptionCard = {
  plan: Plan;
  label: string;
  usual: number;
  unitPrice: number;
  /** Usual packs × pack price. */
  dailyValue: number;
  status: SubscriptionCardStatus;
  /** "Active", "Starts 20 Sep", "Not coming today", "Ends 30 Sep", "Ended 30 Sep". */
  statusLabel: string;
  /** "15 Sep – 30 Sep" or "From 15 Sep · no end date". */
  datesLabel: string;
  /**
   * Skips and quantity changes for this product (and whole-subscription pauses) that can still be changed. Changes
   * wholly on days already arranged are left out: there is nothing left to undo.
   */
  upcoming: Exception[];
  startYmd: string;
  endYmd?: string;
};

/** Days before the end date that a subscription counts as ending soon. */
const ENDING_SOON_DAYS = 7;

/**
 * What the My subscription screen shows for each line. Lines that ended more than a week ago, and lines cancelled
 * before they started, are left out.
 */
export function buildSubscriptionCards(
  customer: CustomerResponse,
  today: string,
  /** The first day a change can still reach (tomorrow, or later after tonight's cut-off). */
  firstChangeableYmd: string = shiftYmd(today, 1),
): SubscriptionCard[] {
  const exceptions = customer.subscriptionExceptions ?? [];
  const weekAgo = shiftYmd(today, -ENDING_SOON_DAYS);
  const t = strings('customer').subscriptionRules;

  return (customer.subscriptionPlans ?? [])
    .filter((p) => p.status !== 'Inactive')
    .filter((p) => p.openEnded || !ymdOf(p.endDate) || ymdOf(p.endDate) >= weekAgo)
    .map((plan) => {
      const usual = usualQuantity(plan);
      const unitPrice = Math.round(planLineTotal(plan) / usual);
      const startYmd = ymdOf(plan.startDate);
      const endYmd = plan.openEnded ? undefined : ymdOf(plan.endDate) || undefined;

      let status: SubscriptionCardStatus = 'active';
      let statusLabel = t.status.active;
      if (endYmd && endYmd < today) {
        status = 'ended';
        statusLabel = t.status.ended(readableDay(endYmd));
      } else if (startYmd > today) {
        status = 'starts';
        statusLabel = t.status.starts(readableDay(startYmd));
      } else if (planQuantityOn(plan, today, exceptions) === 0) {
        status = 'offToday';
        statusLabel = t.status.offToday;
      } else if (endYmd && endYmd <= shiftYmd(today, ENDING_SOON_DAYS)) {
        status = 'ending';
        statusLabel = endYmd === today ? t.status.endsToday : t.status.ends(readableDay(endYmd));
      }

      const upcoming = exceptions
        .filter((ex) => ymdOf(ex.toYmd || ex.fromYmd) >= firstChangeableYmd)
        .filter((ex) => (ex.planId ? ex.planId === plan.id : (ex.kind ?? 'skip') === 'skip'))
        .sort((a, b) => ymdOf(a.fromYmd).localeCompare(ymdOf(b.fromYmd)));

      return {
        plan,
        label: [plan.productName, plan.quantityLabel].map((x) => String(x ?? '').trim()).filter(Boolean).join(' · '),
        usual,
        unitPrice,
        dailyValue: usual * unitPrice,
        status,
        statusLabel,
        datesLabel: endYmd
          ? `${readableDay(startYmd)} – ${readableDay(endYmd)}`
          : t.datesFrom(readableDay(startYmd)),
        upcoming,
        startYmd,
        endYmd,
      };
    })
    .sort((a, b) => Number(a.status === 'ended') - Number(b.status === 'ended') || a.label.localeCompare(b.label));
}

/** "Skipped", "× 3", "None" — how a day change reads in a list. */
export function describeDayChange(change: Exception, usual: number): string {
  const t = strings('customer').subscriptionRules.change;
  if (change.kind === 'quantity') {
    const n = Math.max(0, Math.floor(Number(change.numberOfItems ?? 0)));
    if (n === 0) return t.none;
    return n === usual ? t.backTo(n) : `× ${n}`;
  }
  return change.planId ? t.skipped : t.allPaused;
}

/** "17 Sep" or "10 Sep – 12 Sep". */
export function describeDayChangeDates(change: Exception): string {
  const from = ymdOf(change.fromYmd);
  const to = ymdOf(change.toYmd || change.fromYmd);
  return from === to ? readableDay(from) : `${readableDay(from)} – ${readableDay(to)}`;
}
