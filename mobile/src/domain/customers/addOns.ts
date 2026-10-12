import type { Customer, CustomerExtraOrder } from '@/src/domain/customers/entities';
import { getLanguage, type Lang } from '@/src/i18n/language';

/**
 * One-off orders (`extraOrders` on the customer).
 *
 * This is the single source for "what else is going to this house today": the customer app writes here, the run
 * sheet reads here, and the bill counts the ones that were delivered. The delivery boy marking a day Delivered is
 * what flips an order to Delivered, so an add-on bills on exactly the same rule as a subscription day.
 */

function ymdOf(value: string | undefined): string {
  return String(value ?? '').slice(0, 10);
}

/** The day this order is for: its delivery date when set, otherwise the day it was placed for. */
export function addOnDateYmd(order: Pick<CustomerExtraOrder, 'orderDate' | 'deliveryDate'>): string {
  return ymdOf(order.deliveryDate) || ymdOf(order.orderDate);
}

/** Packs ordered on this line; anything missing or unreadable counts as one. */
export function addOnItemCount(order: Pick<CustomerExtraOrder, 'numberOfItems'>): number {
  const raw = Math.floor(Number(order.numberOfItems ?? 1));
  return Number.isFinite(raw) && raw > 1 ? raw : 1;
}

/** Line total for one add-on: the price snapshot times the number of packs. */
export function addOnLineTotal(order: Pick<CustomerExtraOrder, 'price' | 'numberOfItems'>): number {
  const items = addOnItemCount(order);
  const price = Number(order.price ?? 0);
  return Math.round((Number.isFinite(price) ? price : 0) * items);
}

/** Add-ons still standing for a day (cancelled ones are not going anywhere). */
export function addOnsForDate(
  customer: Pick<Customer, 'extraOrders'>,
  ymd: string,
): CustomerExtraOrder[] {
  return (customer.extraOrders ?? []).filter((o) => addOnDateYmd(o) === ymd && o.status !== 'Cancelled');
}

/**
 * Label for a stop card, bill or load sheet, e.g. "Paneer · 200 gram" or "Paneer · 200 gram × 2". A combo reads as
 * its offer name (in `lang`) with what is in it: "Diwali box (Ghee · 500 ml, Paneer · 200 g × 2) × 2".
 */
export function addOnLabel(
  order: Pick<CustomerExtraOrder, 'productName' | 'quantityLabel' | 'numberOfItems' | 'offer' | 'comboItems'>,
  lang: Lang = getLanguage(),
): string {
  const items = addOnItemCount(order);
  let base: string;
  if (order.comboItems?.length) {
    const title = order.offer?.title;
    const name = (lang === 'mr' ? String(title?.mr ?? '').trim() : '') || String(title?.en ?? order.productName ?? '').trim();
    const contents = order.comboItems
      .map((i) => {
        const pack = [i.productName, i.packLabel].map((x) => String(x ?? '').trim()).filter(Boolean).join(' · ');
        return i.quantity > 1 ? `${pack} × ${i.quantity}` : pack;
      })
      .join(', ');
    base = `${name} (${contents})`;
  } else {
    base = [order.productName, order.quantityLabel].map((x) => String(x ?? '').trim()).filter(Boolean).join(' · ');
  }
  return items > 1 ? `${base} × ${items}` : base;
}

/** What goes on the van for an order: its own pack, or each pack of a combo times the combos ordered. */
export function addOnPacks(
  order: Pick<CustomerExtraOrder, 'productName' | 'quantityLabel' | 'numberOfItems' | 'comboItems'>,
): { productName: string; packLabel: string; count: number }[] {
  const items = addOnItemCount(order);
  if (order.comboItems?.length) {
    return order.comboItems.map((i) => ({
      productName: String(i.productName ?? '').trim(),
      packLabel: String(i.packLabel ?? '').trim(),
      count: Math.max(1, Math.floor(i.quantity) || 1) * items,
    }));
  }
  return [{ productName: String(order.productName ?? '').trim(), packLabel: String(order.quantityLabel ?? '').trim(), count: items }];
}

/** What the delivered add-ons in a month add up to — the add-on half of the bill. */
export function deliveredAddOnTotalForMonth(customer: Pick<Customer, 'extraOrders'>, monthYyyyMm: string): number {
  let total = 0;
  for (const order of customer.extraOrders ?? []) {
    if (order.status !== 'Delivered') continue;
    if (addOnDateYmd(order).slice(0, 7) !== monthYyyyMm) continue;
    total += addOnLineTotal(order);
  }
  return Math.round(total);
}

/** Delivered add-ons in a month, oldest first — the add-on lines on a bill. */
export function deliveredAddOnsForMonth(
  customer: Pick<Customer, 'extraOrders'>,
  monthYyyyMm: string,
): CustomerExtraOrder[] {
  return (customer.extraOrders ?? [])
    .filter((o) => o.status === 'Delivered' && addOnDateYmd(o).slice(0, 7) === monthYyyyMm)
    .sort((a, b) => addOnDateYmd(a).localeCompare(addOnDateYmd(b)));
}
