import { addOnLineTotal, addOnsForDate } from '@/src/domain/customers/addOns';
import {
  dayEditabilityForCustomer,
  isDaySkipped,
  planQuantityOn,
  quantityChangeOn,
  usualQuantity,
} from '@/src/domain/customers/daySchedule';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { planLineTotal, subscriptionPlanActiveOnDateYmd } from '@/src/domain/customers/planSchedule';

/**
 * The customer's "My days" list: for each day, what the subscription brings (and how many), the one-off orders,
 * what it will cost, and whether it can still be changed.
 */

export type MyDayState =
  /** The van has been and delivered. */
  | 'delivered'
  /** The van has been and could not deliver. */
  | 'missed'
  /** Nothing is coming: the whole day is skipped, or every line is set to zero. */
  | 'skipped'
  /** The subscription is skipped but one-off orders still come. */
  | 'extras'
  /** Something is coming. */
  | 'planned'
  /** No subscription runs and nothing was ordered. */
  | 'nothing';

export type MyDayLine = {
  planId: string;
  productName: string;
  packLabel: string;
  /** Packs coming this day (0 when skipped or set to zero). */
  quantity: number;
  /** The line's normal packs per day. */
  usual: number;
  /** Price of one pack. */
  unitPrice: number;
  /** A quantity change (not the usual quantity) is in force for this day. */
  changed: boolean;
};

export type MyDayRow = {
  ymd: string;
  state: MyDayState;
  /** Subscription lines running on this day by their dates, including ones set to zero. */
  lines: MyDayLine[];
  addOns: NonNullable<CustomerResponse['extraOrders']>;
  /** What the day costs if delivered: packs coming × pack price, plus one-off orders. */
  amount: number;
  /** The whole-day skip covering this day, when there is one (so it can be undone). */
  wholeDaySkipId?: string;
  editable: boolean;
  lockedReason?: string;
  /** Closed by the evening cut-off — the dairy can still change it. */
  contactAdmin?: boolean;
};

export function daysOfMonth(yyyyMm: string): string[] {
  const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return [];
  const count = new Date(Number(m[1]), Number(m[2]), 0).getDate();
  return Array.from({ length: count }, (_, i) => `${yyyyMm}-${String(i + 1).padStart(2, '0')}`);
}

export function buildMyDayRow(customer: CustomerResponse, ymd: string, now: Date = new Date()): MyDayRow {
  const exceptions = customer.subscriptionExceptions ?? [];

  const lines: MyDayLine[] = (customer.subscriptionPlans ?? [])
    .filter((plan) => subscriptionPlanActiveOnDateYmd(plan, ymd))
    .map((plan) => {
      const usual = usualQuantity(plan);
      return {
        planId: String(plan.id ?? ''),
        productName: String(plan.productName ?? '').trim(),
        packLabel: String(plan.quantityLabel ?? '').trim(),
        quantity: planQuantityOn(plan, ymd, exceptions),
        usual,
        unitPrice: Math.round(planLineTotal(plan) / usual),
        changed: !!quantityChangeOn(plan, ymd, exceptions),
      };
    });

  const addOns = addOnsForDate(customer, ymd);
  const deliveries = (customer.deliveries ?? []).filter((d) => String(d.deliveryDate ?? '').slice(0, 10) === ymd);
  const delivered = deliveries.some((d) => d.status === 'Delivered');
  const missed = deliveries.some((d) => d.status === 'Missed');
  const wholeDaySkip = exceptions.find(
    (ex) =>
      (ex.kind ?? 'skip') === 'skip' &&
      !String(ex.planId ?? '').trim() &&
      ymd >= String(ex.fromYmd).slice(0, 10) &&
      ymd <= String(ex.toYmd || ex.fromYmd).slice(0, 10),
  );
  const packsComing = lines.reduce((sum, l) => sum + l.quantity, 0);

  let state: MyDayState;
  if (delivered) state = 'delivered';
  else if (missed) state = 'missed';
  else if (packsComing > 0) state = 'planned';
  else if (addOns.length) state = lines.length || isDaySkipped(exceptions, ymd) ? 'extras' : 'planned';
  else state = lines.length || wholeDaySkip ? 'skipped' : 'nothing';

  const editability = dayEditabilityForCustomer(customer, ymd, now);

  return {
    ymd,
    state,
    lines,
    addOns,
    amount: lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0) + addOns.reduce((sum, o) => sum + addOnLineTotal(o), 0),
    wholeDaySkipId: wholeDaySkip?.id,
    editable: editability.editable,
    lockedReason: editability.editable ? undefined : editability.reason,
    contactAdmin: !editability.editable && !!editability.contactAdmin,
  };
}

/** A month of days. The current month starts at today: past days there are history, and the list is a plan. */
export function buildMyDayRows(
  customer: CustomerResponse,
  monthYyyyMm: string,
  todayYmd: string,
  now: Date = new Date(),
): MyDayRow[] {
  const days = daysOfMonth(monthYyyyMm);
  const shown = monthYyyyMm === todayYmd.slice(0, 7) ? days.filter((d) => d >= todayYmd) : days;
  return shown.map((ymd) => buildMyDayRow(customer, ymd, now));
}

/**
 * What the month will cost if everything planned is delivered: each day's subscription packs at their pack price
 * (after skips and quantity changes, within each line's own dates) plus its one-off orders. A day already marked
 * not delivered counts nothing.
 */
export function estimateMonthTotal(customer: CustomerResponse, monthYyyyMm: string): number {
  let total = 0;
  for (const ymd of daysOfMonth(monthYyyyMm)) {
    const row = buildMyDayRow(customer, ymd);
    if (row.state !== 'missed') total += row.amount;
  }
  return Math.round(total);
}
