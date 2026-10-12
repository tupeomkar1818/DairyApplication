import { buildTodayEntries, type TodayEntry } from '@/src/components/admin/dashboardMetrics';
import { addOnItemCount, addOnPacks, addOnsForDate } from '@/src/domain/customers/addOns';
import { isDaySkipped, planQuantityOn, quantityChangeOn, usualQuantity } from '@/src/domain/customers/daySchedule';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { subscriptionPlanActiveOnDateYmd } from '@/src/domain/customers/planSchedule';
import { offerText } from '@/src/domain/offers/offers';

/**
 * One customer's order for one day, as the delivery boy opens it from the run sheet: every pack going to the door,
 * which of them are the subscription and which were ordered extra, what the customer changed for the day, and how the
 * stop was marked. Built from the same schedule rules as the run sheet, so the two never disagree.
 */

export type StopOrderLine = {
  key: string;
  productName: string;
  packLabel: string;
  /** Packs to hand over for this line. */
  count: number;
  kind: 'subscription' | 'extra';
  /** The line's usual packs when the customer changed the quantity for this day. */
  usualCount?: number;
  /** Who placed an extra order. */
  placedBy?: 'customer' | 'admin';
  /** A combo: the packs to hand over for all the combos on this line ("Ghee · 500 ml × 2, Paneer · 200 g × 4"). */
  comboPacks?: { productName: string; packLabel: string; count: number }[];
};

export type StopOrderSkip = { key: string; productName: string; packLabel: string; reason?: string };

export type StopOrderMark = {
  status: 'Delivered' | 'Not delivered';
  by?: string;
  /** ISO time the stop was marked. */
  at?: string;
  reason?: string;
};

export type StopOrder = {
  ymd: string;
  lines: StopOrderLine[];
  /** Subscription lines that would run today but the customer paused for this day. */
  skipped: StopOrderSkip[];
  totalPacks: number;
  status: TodayEntry['status'];
  mark: StopOrderMark | null;
};

const text = (value: unknown) => String(value ?? '').trim();

export function buildStopOrder(customer: CustomerResponse, ymd: string): StopOrder {
  const exceptions = customer.subscriptionExceptions;
  const lines: StopOrderLine[] = [];
  const skipped: StopOrderSkip[] = [];

  for (const plan of customer.subscriptionPlans ?? []) {
    if (!subscriptionPlanActiveOnDateYmd(plan, ymd)) continue;
    const count = planQuantityOn(plan, ymd, exceptions);
    const base = { key: `plan:${plan.id}`, productName: text(plan.productName), packLabel: text(plan.quantityLabel) };
    if (count <= 0) {
      const skip = (exceptions ?? []).find((ex) => (ex.kind ?? 'skip') === 'skip' && isDaySkipped([ex], ymd, plan.id));
      const change = quantityChangeOn(plan, ymd, exceptions);
      const reason = text(skip?.reason ?? change?.reason);
      skipped.push({ ...base, ...(reason ? { reason } : {}) });
      continue;
    }
    const usual = usualQuantity(plan);
    lines.push({ ...base, count, kind: 'subscription', ...(count !== usual ? { usualCount: usual } : {}) });
  }

  for (const order of addOnsForDate(customer, ymd)) {
    const isCombo = !!order.comboItems?.length;
    lines.push({
      key: `extra:${order.id}`,
      // A combo reads as its offer name in the app language, with the packs inside it listed to hand over.
      productName: (isCombo ? offerText(order.offer?.title) : '') || text(order.productName),
      packLabel: text(order.quantityLabel),
      count: addOnItemCount(order),
      kind: 'extra',
      ...(order.placedBy ? { placedBy: order.placedBy } : {}),
      ...(isCombo ? { comboPacks: addOnPacks(order) } : {}),
    });
  }

  const status = buildTodayEntries([customer], ymd)[0]?.status ?? 'Pending';
  const rows = (customer.deliveries ?? []).filter((d) => text(d.deliveryDate).slice(0, 10) === ymd);
  const markRow =
    status === 'Pending'
      ? undefined
      : rows
          .filter((d) => (status === 'Delivered' ? d.status === 'Delivered' : d.status === 'Missed'))
          .sort((a, b) => text(b.updatedAt).localeCompare(text(a.updatedAt)))[0];

  return {
    ymd,
    lines,
    skipped,
    // Packs handed over: a combo counts the packs inside it.
    totalPacks: lines.reduce((sum, l) => sum + (l.comboPacks ? l.comboPacks.reduce((s, p) => s + p.count, 0) : l.count), 0),
    status,
    mark:
      status === 'Pending'
        ? null
        : {
            status,
            ...(text(markRow?.deliveryBoyName) ? { by: text(markRow?.deliveryBoyName) } : {}),
            ...(text(markRow?.updatedAt) ? { at: text(markRow?.updatedAt) } : {}),
            ...(text(markRow?.missedReason) ? { reason: text(markRow?.missedReason) } : {}),
          },
  };
}
