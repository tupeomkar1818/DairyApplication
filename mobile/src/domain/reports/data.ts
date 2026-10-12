import {
  deliveredSubscriptionCharges,
  type CustomerDeliveryRowInput,
} from '@/src/components/admin/customerSubscriptionMonthUtils';
import { addOnDateYmd, addOnItemCount, addOnLabel, addOnLineTotal } from '@/src/domain/customers/addOns';
import type { CustomerResponse, CustomerSubscriptionPlanDto } from '@/src/domain/customers/dtos';
import { customerBelongsToBoy } from '@/src/domain/deliveryBoys/assignment';
import type { DeliveryBoyResponse } from '@/src/domain/deliveryBoys/dtos';
import type { AppNotification } from '@/src/domain/notifications/entities';
import type { Offer } from '@/src/domain/offers/entities';
import { offerDiscountsForMonth, offerText, orderSavings, type OfferDiscountLine } from '@/src/domain/offers/offers';
import type { ProductResponse } from '@/src/domain/products/dtos';
import { packUnitFamily, parsePackQuantity } from '@/src/domain/products/packs';
import { inRange, type ReportRange } from '@/src/domain/reports/dateRange';
import { ALL, type ReportFilterDef, type ReportFilterValues } from '@/src/domain/reports/model';
import { strings } from '@/src/i18n/strings';

/** Everything a report may read. Each app passes only what its user may see (its own customers, its own record). */
export type ReportData = {
  customers: readonly CustomerResponse[];
  boys: readonly DeliveryBoyResponse[];
  products: readonly ProductResponse[];
  notifications: readonly AppNotification[];
  /** Every offer the dairy ran — bills take their discounts off, so report totals match the bills customers see. */
  offers: readonly Offer[];
  /** Today on the phone's calendar (yyyy-mm-dd). */
  today: string;
  nowIso: string;
};

/** Route filter value for customers without a route (the label is worded in the app language). */
export const NO_ROUTE = '__no_route__';

const text = (value: unknown) => String(value ?? '').trim();

/** The customer's route as shown in a report ("No route" in the app language when there is none). */
export function routeOf(c: Pick<CustomerResponse, 'routeName'>): string {
  return text(c.routeName) || strings('reports').filters.noRoute;
}

/** The route a filter compares against: the name, or `NO_ROUTE`, so a chosen filter survives a language change. */
function routeKeyOf(routeName: string | null | undefined): string {
  return text(routeName) || NO_ROUTE;
}

/** The delivery boy currently serving the customer (the same rule the delivery app uses to list stops). */
export function boyForCustomer(
  c: CustomerResponse,
  boys: readonly DeliveryBoyResponse[],
): DeliveryBoyResponse | null {
  return boys.find((b) => customerBelongsToBoy(c, b)) ?? null;
}

export function boyNameForCustomer(c: CustomerResponse, boys: readonly DeliveryBoyResponse[]): string {
  return text(boyForCustomer(c, boys)?.fullName) || strings('reports').filters.unassigned;
}

/** One delivered, billed line: a subscription day or a delivered one-off order. */
export type DeliveredLine = {
  ymd: string;
  customerId: string;
  productName: string;
  packLabel: string;
  packs: number;
  /** Unrounded rupees, on the bill's rules. */
  amount: number;
  kind: 'subscription' | 'addon';
  /** One-off orders: what the line reads as ("Diwali box (Ghee · 500 ml, Paneer · 200 g × 2)"), without the count. */
  label?: string;
  /** One-off orders placed under an offer: the offer, its name in the app language, and what the customer saved. */
  offerId?: string;
  offerTitle?: string;
  savings?: number;
};

/** An order's item wording without its count — a combo with what is in it, in the app language. */
export function orderItemLabel(order: Parameters<typeof addOnLabel>[0]): string {
  return addOnLabel({ ...order, numberOfItems: 1 });
}

/** Everything a customer was billed for, day by day — the lines their monthly bills add up. */
export function deliveredLinesForCustomer(c: CustomerResponse): DeliveredLine[] {
  const subscription = deliveredSubscriptionCharges(
    (c.subscriptionPlans ?? []) as CustomerSubscriptionPlanDto[],
    (c.deliveries ?? []) as CustomerDeliveryRowInput[],
  ).map<DeliveredLine>((ch) => ({
    ymd: ch.ymd,
    customerId: c.id,
    productName: ch.productName,
    packLabel: ch.packLabel,
    packs: ch.packs,
    amount: ch.amount,
    kind: 'subscription',
  }));

  const addOns = (c.extraOrders ?? [])
    .filter((o) => o.status === 'Delivered')
    .map<DeliveredLine>((o) => ({
      ymd: addOnDateYmd(o),
      customerId: c.id,
      // A combo reads as its offer name in the app language; orders under an offer are already at the offer price.
      productName: (o.comboItems?.length ? offerText(o.offer?.title) : '') || text(o.productName),
      packLabel: text(o.quantityLabel),
      packs: addOnItemCount(o),
      amount: addOnLineTotal(o),
      kind: 'addon',
      label: orderItemLabel(o),
      ...(o.offer ? { offerId: o.offer.offerId, offerTitle: offerText(o.offer.title), savings: orderSavings(o) } : {}),
    }));

  return [...subscription, ...addOns].sort((a, b) => a.ymd.localeCompare(b.ymd) || a.productName.localeCompare(b.productName));
}

export function deliveredLinesInRange(customers: readonly CustomerResponse[], range: ReportRange): DeliveredLine[] {
  const out: DeliveredLine[] = [];
  for (const c of customers) {
    for (const line of deliveredLinesForCustomer(c)) if (inRange(line.ymd, range)) out.push(line);
  }
  return out;
}

/** One offer's discount on one customer's bill for one month. */
export type OfferDiscountEntry = OfferDiscountLine & { customerId: string; month: string };

/** What offers took off each customer's bill in these bill months, one entry per customer, month and offer. */
export function offerDiscountEntries(
  customers: readonly CustomerResponse[],
  months: readonly string[],
  offers: readonly Offer[],
): OfferDiscountEntry[] {
  if (!offers.length) return [];
  const out: OfferDiscountEntry[] = [];
  for (const c of customers) {
    for (const month of months) {
      for (const line of offerDiscountsForMonth(c, month, offers)) out.push({ ...line, customerId: c.id, month });
    }
  }
  return out;
}

export function sum<T>(items: readonly T[], pick: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += Number(pick(item)) || 0;
  return total;
}

/** Groups items by a key, keeping first-seen order. */
export function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}

/** How big one pack is, in ml / gram / items — from the product's own pack when listed, else read from the label. */
export function packSize(
  productName: string,
  packLabel: string,
  products: readonly ProductResponse[],
): { family: 'volume' | 'weight' | 'count'; quantity: number } {
  const product = products.find((p) => text(p.name).toLowerCase() === text(productName).toLowerCase());
  const pack = product?.packs?.find((pk) => text(pk.label).toLowerCase() === text(packLabel).toLowerCase());
  if (pack) return { family: packUnitFamily(pack.unit), quantity: Math.max(0, Number(pack.quantity) || 0) };
  const parsed = parsePackQuantity(packLabel, product?.unit ?? 'Packet');
  return { family: packUnitFamily(parsed.unit), quantity: parsed.quantity };
}

// ── Filters ──────────────────────────────────────────────────────────────────────────────────────────────────────

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);

export function routeFilterDef(customers: readonly CustomerResponse[]): ReportFilterDef {
  const t = strings('reports').filters;
  const routes = Array.from(new Set(customers.map((c) => routeKeyOf(c.routeName))));
  return {
    key: 'route',
    label: t.route,
    options: [
      { value: ALL, label: t.allRoutes },
      ...routes.map((r) => ({ value: r, label: r === NO_ROUTE ? t.noRoute : r })).sort(byLabel),
    ],
  };
}

export function boyFilterDef(boys: readonly DeliveryBoyResponse[]): ReportFilterDef {
  const t = strings('reports').filters;
  return {
    key: 'boy',
    label: t.deliveryBoy,
    options: [
      { value: ALL, label: t.allBoys },
      ...boys.map((b) => ({ value: b.id, label: text(b.fullName) || b.mobileNumber })).sort(byLabel),
    ],
  };
}

export function customerFilterDef(customers: readonly CustomerResponse[], allLabel?: string): ReportFilterDef {
  const t = strings('reports').filters;
  return {
    key: 'customer',
    label: t.customer,
    options: [
      { value: ALL, label: allLabel ?? t.allCustomers },
      ...customers
        .map((c) => ({ value: c.id, label: `${text(c.name)}${c.mobile ? ` · ${c.mobile}` : ''}` }))
        .sort(byLabel),
    ],
  };
}

export function productFilterDef(products: readonly ProductResponse[], customers: readonly CustomerResponse[]): ReportFilterDef {
  const names = new Set<string>();
  for (const p of products) if (text(p.name)) names.add(text(p.name));
  for (const c of customers) for (const plan of c.subscriptionPlans ?? []) if (text(plan.productName)) names.add(text(plan.productName));
  const t = strings('reports').filters;
  return {
    key: 'product',
    label: t.product,
    options: [{ value: ALL, label: t.allProducts }, ...Array.from(names).map((n) => ({ value: n, label: n })).sort(byLabel)],
  };
}

export function filterValue(filters: ReportFilterValues, key: string): string {
  const v = filters[key];
  return v && v !== ALL ? v : ALL;
}

/** Customers left after the route / delivery boy / customer filters. */
export function filterCustomers(
  customers: readonly CustomerResponse[],
  boys: readonly DeliveryBoyResponse[],
  filters: ReportFilterValues,
): CustomerResponse[] {
  const route = filterValue(filters, 'route');
  const boyId = filterValue(filters, 'boy');
  const customerId = filterValue(filters, 'customer');
  const boy = boyId === ALL ? null : boys.find((b) => b.id === boyId) ?? null;
  return customers.filter((c) => {
    if (customerId !== ALL && c.id !== customerId) return false;
    if (route !== ALL && routeKeyOf(c.routeName) !== route) return false;
    if (boyId !== ALL && !customerBelongsToBoy(c, boy)) return false;
    return true;
  });
}

export function filterBoys(boys: readonly DeliveryBoyResponse[], filters: ReportFilterValues): DeliveryBoyResponse[] {
  const boyId = filterValue(filters, 'boy');
  const route = filterValue(filters, 'route');
  return boys.filter((b) => {
    if (boyId !== ALL && b.id !== boyId) return false;
    if (route !== ALL && routeKeyOf(b.primaryRouteName) !== route) return false;
    return true;
  });
}

/** Change against the previous period as a signed whole percent, or null when there is nothing to compare with. */
export function changePercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function changeHint(current: number, previous: number): string | undefined {
  const pct = changePercent(current, previous);
  if (pct === null) return undefined;
  return strings('reports').data.changeVsPrevious(`${pct >= 0 ? '+' : ''}${pct}%`);
}
