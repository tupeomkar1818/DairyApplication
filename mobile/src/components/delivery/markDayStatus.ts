import { addOnDateYmd, addOnItemCount } from '@/src/domain/customers/addOns';
import { plannedLinesOn } from '@/src/domain/customers/daySchedule';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { strings } from '@/src/i18n/strings';

/**
 * Marking a day Delivered / Not delivered from the delivery app.
 *
 * Shared by the run sheet and the day-orders history so the two can never write delivery rows differently: one row
 * per line that was actually due (subscription lines the customer has not skipped, plus that day's one-off orders),
 * stamped with the delivery boy's name. The same pass settles the one-off orders themselves, because a delivered
 * add-on is what puts it on the bill.
 */

export type MarkDayStatus = 'Delivered' | 'Missed';

export class NothingPlannedError extends Error {
  constructor(customerName: string) {
    super(strings('delivery').markDay.nothingPlanned(customerName));
    this.name = 'NothingPlannedError';
  }
}

/** Stored on a delivery row marked not delivered from the app. It is data; the stop screen shows it translated. */
export const DELIVERY_APP_MISSED_REASON = 'Marked not delivered by delivery app';

export type DayStatusResult = {
  deliveries: NonNullable<CustomerResponse['deliveries']>;
  /** Same rows back with this day's one-off orders settled — pass both to the update. */
  extraOrders: NonNullable<CustomerResponse['extraOrders']>;
};

function newDeliveryId(): string {
  return `del_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

/**
 * Builds the customer's updated `deliveries` and `extraOrders` for one day. Existing rows for the same day, product
 * and pack are updated in place, so marking twice never duplicates a row.
 *
 * @throws NothingPlannedError when the day has no subscription line due and no one-off order.
 */
export function buildDayStatusDeliveries(input: {
  customer: CustomerResponse;
  ymd: string;
  next: MarkDayStatus;
  actorName?: string;
  now?: string;
}): DayStatusResult {
  const { customer, ymd, next, actorName } = input;
  const now = input.now ?? new Date().toISOString();

  const planned = plannedLinesOn(customer, ymd);
  const addOns = (customer.extraOrders ?? []).filter((o) => addOnDateYmd(o) === ymd && o.status !== 'Cancelled');

  // One row per product and pack. A subscription line and a one-off order of the same pack share a row; the row
  // records both the total handed over and the subscription's share, which is all the subscription bill charges.
  const byKey = new Map<string, { productName: string; quantityLabel: string; numberOfItems: number; subscriptionItems: number }>();
  const addWanted = (productName: string, quantityLabel: string, items: number, fromSubscription: boolean) => {
    const name = String(productName ?? '').trim();
    const pack = String(quantityLabel ?? '').trim();
    const key = `${name}${pack}`;
    const current = byKey.get(key) ?? { productName: name, quantityLabel: pack, numberOfItems: 0, subscriptionItems: 0 };
    current.numberOfItems += items;
    if (fromSubscription) current.subscriptionItems += items;
    byKey.set(key, current);
  };
  for (const { plan, quantity } of planned) addWanted(plan.productName, plan.quantityLabel, quantity, true);
  for (const order of addOns) addWanted(order.productName, order.quantityLabel, addOnItemCount(order), false);

  const wanted = Array.from(byKey.values());
  if (wanted.length === 0) throw new NothingPlannedError(customer.name);

  const nextList = [...(customer.deliveries ?? [])];

  for (const w of wanted) {
    const idx = nextList.findIndex(
      (d) =>
        String(d.deliveryDate ?? '').slice(0, 10) === ymd &&
        String(d.productName ?? '').trim() === String(w.productName ?? '').trim() &&
        String(d.quantityLabel ?? '').trim() === String(w.quantityLabel ?? '').trim(),
    );
    const base = idx >= 0 ? nextList[idx]! : null;
    const row = {
      id: base?.id ?? newDeliveryId(),
      deliveryDate: ymd,
      productName: String(w.productName ?? '').trim(),
      quantityLabel: String(w.quantityLabel ?? '').trim(),
      numberOfItems: w.numberOfItems,
      subscriptionItems: w.subscriptionItems,
      deliveryBoyName: actorName ?? base?.deliveryBoyName,
      status: next,
      missedReason: next === 'Missed' ? base?.missedReason ?? DELIVERY_APP_MISSED_REASON : undefined,
      rescheduledDate: base?.rescheduledDate,
      notes: base?.notes,
      createdAt: base?.createdAt ?? now,
      updatedAt: now,
    } as NonNullable<CustomerResponse['deliveries']>[number];

    if (idx >= 0) nextList[idx] = row;
    else nextList.push(row);
  }

  // A one-off order is Delivered once it is handed over, and back to Pending if the day is later marked missed.
  const nextOrders = (customer.extraOrders ?? []).map((o) => {
    if (o.status === 'Cancelled' || addOnDateYmd(o) !== ymd) return o;
    const settled = next === 'Delivered' ? 'Delivered' : 'Pending';
    return o.status === settled ? o : { ...o, status: settled as typeof o.status, updatedAt: now };
  });

  return { deliveries: nextList, extraOrders: nextOrders };
}
