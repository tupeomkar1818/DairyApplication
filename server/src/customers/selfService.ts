import { ApiError } from '@/http';

/**
 * What a customer may change on their own record from the customer app, and nothing more.
 *
 * The apps send a whole list back when anything in it changes (`mobile/src/domain/customers/entities.ts`). From the
 * dairy's own screens that is fine — the dairy owns the record. From a customer it is not: a replaced list could
 * drop an order they have had, re-price one, or approve their own payment. So a customer's patch is never written
 * as it arrives. Each list is rebuilt here from what is stored, taking only the changes a customer is allowed to
 * make, and anything else is refused with a reason the app can show.
 *
 * The rules are the ones the customer app already works by (`mobile/src/components/customer/customerActions.ts`,
 * `subscriptionActions.ts`), checked again here because a phone cannot be trusted to check them:
 *
 * - **The cut-off.** A day can be changed until 9 pm the evening before, dairy time, and never once the van has
 *   been (a delivery is marked). Today is never orderable — it was loaded this morning.
 * - **Money.** An order's price must be the catalog's price for that pack, or the price of an offer this customer
 *   has on that day. Nothing a customer sends sets a price of its own.
 * - **History stays.** Orders, payment requests and delivered days are never removed or re-dated; an order is
 *   cancelled, a request withdrawn — both of which leave the row in place.
 */

export type Row = Record<string, unknown>;
export type Customer = Record<string, unknown> & { id: string };

/** A pack as the catalog has it, for checking what an order may cost. */
export type CatalogPack = { productName: string; packLabel: string; price: number; discountPrice: number | null };

/** The parts of an offer a price check needs. */
export type OfferForOrder = Record<string, unknown> & { id: string; kind: string; startYmd: string };

export type SelfServiceContext = {
  now: Date;
  /** The catalog, by pack id. */
  packs: Map<string, CatalogPack>;
  /** Every offer, by id. */
  offers: Map<string, OfferForOrder>;
  /** The offers whose code this customer has typed. */
  claimedOfferIds: Set<string>;
};

/** The lists a customer may send; anything else on the record is the dairy's. */
export const SELF_SERVICE_KEYS = [
  'subscriptionPlans',
  'subscriptionExceptions',
  'extraOrders',
  'paymentRequests',
  'deliveries',
] as const;

/** The most packs of one thing a customer can ask for in a day — the same cap the app's steppers have. */
const MAX_DAY_QUANTITY = 20;
/** Orders stop at 9 pm the evening before, dairy time. */
const CUTOFF_HOUR = 21;
const INDIA_OFFSET_MS = 5.5 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

const ymdOf = (value: unknown): string => String(value ?? '').slice(0, 10);
const money = (value: unknown): number => Math.round(Number(value) || 0);
const isYmd = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

function refuse(code: string, message: string, details?: Record<string, unknown>): never {
  throw ApiError.badRequest(code, message, details);
}

// -----------------------------------------------------------------------------------------------------------------
// Days
// -----------------------------------------------------------------------------------------------------------------

/** Midnight at the start of this day, dairy time, as a moment. */
function dayStartMs(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00.000Z`) - INDIA_OFFSET_MS;
}

export function indiaYmd(now: Date): string {
  return new Date(now.getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 10);
}

export function shiftYmd(ymd: string, days: number): string {
  return new Date(dayStartMs(ymd) + days * DAY_MS + INDIA_OFFSET_MS).toISOString().slice(0, 10);
}

/** The days the van has already been for; a day with a delivery is closed to the customer whatever the time is. */
function markedDays(customer: Customer): Set<string> {
  return new Set(((customer.deliveries as Row[]) ?? []).map((d) => ymdOf(d.deliveryDate)));
}

/** True while a customer can still change this day: before 9 pm the evening before, and not yet delivered. */
function dayIsOpen(ymd: string, marked: Set<string>, now: Date): boolean {
  if (!isYmd(ymd) || marked.has(ymd)) return false;
  return now.getTime() < dayStartMs(ymd) - (24 - CUTOFF_HOUR) * 60 * 60_000;
}

/** The first day a change a customer makes right now can still reach. */
export function firstOpenDay(customer: Customer, now: Date): string {
  const marked = markedDays(customer);
  let ymd = shiftYmd(indiaYmd(now), 1);
  // A handful of hops at most: the cut-off pushes one day on, a delivered row another.
  for (let i = 0; i < 7; i += 1) {
    if (dayIsOpen(ymd, marked, now)) return ymd;
    ymd = shiftYmd(ymd, 1);
  }
  return ymd;
}

// -----------------------------------------------------------------------------------------------------------------
// The lists
// -----------------------------------------------------------------------------------------------------------------

function byId(list: readonly Row[] | undefined): Map<string, Row> {
  return new Map((list ?? []).map((row) => [String(row.id ?? ''), row]));
}

/** What a pack costs today: its discounted price when there is one, otherwise its price. */
function packPrice(pack: CatalogPack): number {
  const base = money(pack.price);
  const discounted = money(pack.discountPrice);
  return discounted > 0 && discounted < base ? discounted : base;
}

function sameText(a: unknown, b: unknown): boolean {
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}

/**
 * What this order is allowed to cost — the catalog’s price for the pack, or the price of an offer this customer
 * has on that day — and the offer it was placed under, as the server holds it.
 */
function checkOrderPricing(order: Row, ctx: SelfServiceContext): { price: number; offer?: Row } {
  const ymd = ymdOf(order.deliveryDate || order.orderDate);
  const offerRef = (order.offer ?? null) as { offerId?: string } | null;

  if (offerRef?.offerId) {
    const offer = ctx.offers.get(String(offerRef.offerId));
    const covers = !!offer && !offer.endedAt && ymd >= String(offer.startYmd) && (!offer.endYmd || ymd <= String(offer.endYmd));
    const theirs = !!offer && (!offer.code || ctx.claimedOfferIds.has(offer.id));
    if (!offer || !covers || !theirs) {
      refuse('OFFER_NOT_AVAILABLE', 'This offer is not available for that day.', { orderId: order.id });
    }

    // The title and the "was" price are the dairy’s, so a bill reads the offer as the dairy wrote it.
    const asPlaced = (listPrice: number, kind: string): Row => ({
      offerId: offer.id,
      kind,
      title: offer.title,
      listPrice,
    });
    if (offer.kind === 'combo') {
      const items = (offer.comboItems as Row[]) ?? [];
      const listTotal = items.reduce((sum, i) => sum + money(i.listPrice) * Math.max(1, Math.floor(Number(i.quantity) || 1)), 0);
      return { price: money(offer.comboPrice), offer: asPlaced(listTotal, 'combo') };
    }
    if (offer.kind === 'price') {
      const items = (offer.priceItems as Row[]) ?? [];
      const item = items.find((i) =>
        order.packId && i.packId ? i.packId === order.packId : sameText(i.productName, order.productName) && sameText(i.packLabel, order.quantityLabel),
      );
      if (item) return { price: money(item.offerPrice), offer: asPlaced(money(item.listPrice), 'price') };
    }
    refuse('OFFER_NOT_AVAILABLE', 'This offer does not cover that pack.', { orderId: order.id });
  }

  const pack = ctx.packs.get(String(order.packId ?? ''));
  if (!pack) refuse('PRODUCT_NOT_FOUND', 'That pack is no longer in the catalog.', { orderId: order.id });
  // The name travels with the order, and a bill is read by it: it must be the pack that was priced.
  if (!sameText(pack.productName, order.productName) || !sameText(pack.packLabel, order.quantityLabel)) {
    refuse('ORDER_PACK_MISMATCH', 'That order does not match the pack it was priced from.', { orderId: order.id });
  }
  return { price: packPrice(pack) };
}

/**
 * One-off orders: a customer may place one for a day that is still open, change how many packs or cancel it while
 * the day stays open, and nothing else. Orders are never removed — a cancelled one stays, so the day's history and
 * the bill can still be read.
 */
function mergeExtraOrders(current: Customer, sent: Row[], ctx: SelfServiceContext): Row[] {
  const stored = byId(current.extraOrders as Row[]);
  const marked = markedDays(current);
  const seen = new Set<string>();
  const merged: Row[] = [];

  for (const order of sent) {
    const id = String(order.id ?? '');
    const existing = id ? stored.get(id) : undefined;
    seen.add(id);

    if (!existing) {
      const ymd = ymdOf(order.deliveryDate || order.orderDate);
      if (!dayIsOpen(ymd, marked, ctx.now)) {
        refuse('DAY_CLOSED', 'That day is closed for changes. Please contact the dairy.', { ymd });
      }
      const items = Math.floor(Number(order.numberOfItems ?? 1));
      if (!(items >= 1 && items <= MAX_DAY_QUANTITY)) {
        refuse('ORDER_QUANTITY_INVALID', `Order between 1 and ${MAX_DAY_QUANTITY} packs.`, { orderId: id });
      }
      const priced = checkOrderPricing(order, ctx);
      if (money(order.price) !== priced.price) {
        refuse('ORDER_PRICE_MISMATCH', 'That price is not the price of this pack today. Please try again.', { orderId: id, price: priced.price });
      }
      if (order.status !== undefined && order.status !== 'Pending') {
        refuse('ORDER_STATUS_NOT_YOURS', 'Only the dairy marks an order delivered.', { orderId: id });
      }
      merged.push({ ...order, price: priced.price, ...(priced.offer ? { offer: priced.offer } : { offer: undefined }), status: 'Pending', placedBy: 'customer' });
      continue;
    }

    // An order that is already there: the day it is for, its price and what it is never change.
    const wantsCancel = order.status === 'Cancelled' && existing.status !== 'Cancelled';
    const items = Math.floor(Number(order.numberOfItems ?? existing.numberOfItems ?? 1));
    const changesItems = items !== Math.floor(Number(existing.numberOfItems ?? 1));

    if (!wantsCancel && !changesItems) {
      merged.push(existing);
      continue;
    }
    if (existing.status !== 'Pending') {
      refuse('ORDER_ALREADY_SETTLED', 'That order has already been dealt with by the dairy.', { orderId: id });
    }
    if (!dayIsOpen(ymdOf(existing.deliveryDate || existing.orderDate), marked, ctx.now)) {
      refuse('DAY_CLOSED', 'That day is closed for changes. Please contact the dairy.', { orderId: id });
    }
    if (changesItems && !(items >= 1 && items <= MAX_DAY_QUANTITY)) {
      refuse('ORDER_QUANTITY_INVALID', `Order between 1 and ${MAX_DAY_QUANTITY} packs.`, { orderId: id });
    }
    merged.push({
      ...existing,
      ...(changesItems ? { numberOfItems: items } : {}),
      ...(wantsCancel ? { status: 'Cancelled' } : {}),
      updatedAt: order.updatedAt ?? existing.updatedAt,
    });
  }

  // Anything left out of the patch is kept: a customer's app cannot drop an order by not sending it.
  for (const [id, order] of stored) if (!seen.has(id)) merged.push(order);
  return merged;
}

/**
 * Days the customer changed: skipping a day, or taking a different number of packs on some days.
 *
 * A change can be added or undone while its days are still open. A change that reaches back into days already
 * arranged can only be shortened to the last arranged day — the crates for those days are already counted.
 */
function mergeExceptions(current: Customer, sent: Row[], ctx: SelfServiceContext): Row[] {
  const stored = byId(current.subscriptionExceptions as Row[]);
  const plans = byId(current.subscriptionPlans as Row[]);
  const marked = markedDays(current);
  const today = indiaYmd(ctx.now);
  const firstOpen = firstOpenDay(current, ctx.now);
  const lastArranged = shiftYmd(firstOpen, -1);
  const seen = new Set<string>();
  const merged: Row[] = [];

  for (const change of sent) {
    const id = String(change.id ?? '');
    const existing = id ? stored.get(id) : undefined;
    seen.add(id);

    if (!existing) {
      const from = ymdOf(change.fromYmd);
      const to = ymdOf(change.toYmd || change.fromYmd);
      const kind = change.kind === 'quantity' ? 'quantity' : 'skip';
      if (!isYmd(from) || !isYmd(to) || to < from) refuse('DAY_CHANGE_INVALID', 'Those days are not right.', { id });
      if (from < today) refuse('DAY_CLOSED', 'A day that has passed cannot be changed.', { ymd: from });

      if (kind === 'quantity') {
        const items = Math.floor(Number(change.numberOfItems ?? 0));
        if (!(items >= 1 && items <= MAX_DAY_QUANTITY)) {
          refuse('DAY_QUANTITY_INVALID', `Choose between 1 and ${MAX_DAY_QUANTITY} packs.`, { id });
        }
        const plan = plans.get(String(change.planId ?? ''));
        if (!plan) refuse('SUBSCRIPTION_NOT_FOUND', 'That subscription is no longer on the account.', { id });
        // A day already arranged may only be held at the quantity it was arranged with — that is what the app
        // writes when the everyday quantity changes, so the crates already counted stay as they were.
        if (from < firstOpen && items !== Math.floor(Number(plan.numberOfItems ?? 1))) {
          refuse('DAY_CLOSED', 'That day is closed for changes. Please contact the dairy.', { ymd: from });
        }
      } else if (!dayIsOpen(from, marked, ctx.now)) {
        refuse('DAY_CLOSED', 'That day is closed for changes. Please contact the dairy.', { ymd: from });
      }

      merged.push({ ...change, kind, createdBy: 'customer' });
      continue;
    }

    // One that is already there: only its last day may be pulled back, and never into the arranged days.
    const to = ymdOf(change.toYmd || change.fromYmd);
    const storedTo = ymdOf(existing.toYmd || existing.fromYmd);
    if (to === storedTo) {
      merged.push(existing);
      continue;
    }
    if (to > storedTo || to < ymdOf(existing.fromYmd) || to < lastArranged) {
      refuse('DAY_CHANGE_NOT_YOURS', 'That change can no longer be undone. Please contact the dairy.', { id });
    }
    merged.push({ ...existing, toYmd: to, updatedAt: change.updatedAt ?? existing.updatedAt });
  }

  // Undoing a change takes it off the list, which is allowed only while every day it covers is still open.
  for (const [id, change] of stored) {
    if (seen.has(id)) continue;
    if (ymdOf(change.fromYmd) < firstOpen) {
      refuse('DAY_CHANGE_NOT_YOURS', 'That change can no longer be undone. Please contact the dairy.', { id });
    }
  }
  return merged;
}

/** Running or stopped is the customer’s to set; a state the dairy chose (paused, cancelled) is not. */
const CUSTOMER_PLAN_STATUS = ['Active', 'Inactive'];

function planStatusFor(existing: Row, sent: Row): string {
  const stored = String(existing.status ?? 'Active');
  const wanted = String(sent.status ?? stored);
  if (wanted === stored) return stored;
  if (CUSTOMER_PLAN_STATUS.includes(wanted) && CUSTOMER_PLAN_STATUS.includes(stored)) return wanted;
  refuse('SUBSCRIPTION_STATUS_NOT_YOURS', 'Only the dairy can change this subscription. Please contact us.', { planId: existing.id });
}

/**
 * The standing order. A customer may start a new line, change how many packs come every day, set or clear its last
 * day, and stop it. What it costs comes from the catalog, and a line is never removed from the record.
 */
function mergePlans(current: Customer, sent: Row[], ctx: SelfServiceContext): Row[] {
  const stored = byId(current.subscriptionPlans as Row[]);
  const today = indiaYmd(ctx.now);
  const seen = new Set<string>();
  const merged: Row[] = [];

  for (const plan of sent) {
    const id = String(plan.id ?? '');
    const existing = id ? stored.get(id) : undefined;
    seen.add(id);

    if (!existing) {
      const pack = ctx.packs.get(String(plan.packId ?? ''));
      if (!pack) refuse('PRODUCT_NOT_FOUND', 'That pack is no longer in the catalog.', { planId: id });
      if (!sameText(pack.productName, plan.productName) || !sameText(pack.packLabel, plan.quantityLabel)) {
        refuse('ORDER_PACK_MISMATCH', 'That subscription does not match the pack it was priced from.', { planId: id });
      }
      const items = Math.floor(Number(plan.numberOfItems ?? 1));
      if (!(items >= 1 && items <= MAX_DAY_QUANTITY)) {
        refuse('DAY_QUANTITY_INVALID', `Choose between 1 and ${MAX_DAY_QUANTITY} packs.`, { planId: id });
      }
      const start = ymdOf(plan.startDate);
      if (!isYmd(start) || start < today) refuse('SUBSCRIPTION_START_INVALID', 'Pick a day from today on.', { planId: id });

      merged.push({
        ...plan,
        // The price is the catalog's, never the phone's.
        originalPrice: money(pack.price),
        discountedPrice: money(pack.discountPrice),
        effectiveFinalPrice: packPrice(pack),
        productAdditionTag: 'Regular',
      });
      continue;
    }

    // One that is already there keeps what it costs, what it is and when it started.
    const items = Math.floor(Number(plan.numberOfItems ?? existing.numberOfItems ?? 1)) || 1;
    if (!(items >= 1 && items <= MAX_DAY_QUANTITY)) {
      refuse('DAY_QUANTITY_INVALID', `Choose between 1 and ${MAX_DAY_QUANTITY} packs.`, { planId: id });
    }
    merged.push({
      ...existing,
      numberOfItems: items,
      endDate: plan.endDate,
      openEnded: plan.openEnded,
      // Running or not is the customer’s; anything else the dairy set (paused, cancelled) stays theirs.
      status: planStatusFor(existing, plan),
      updatedAt: plan.updatedAt ?? existing.updatedAt,
    });
  }

  for (const [id, plan] of stored) if (!seen.has(id)) merged.push(plan);
  return merged;
}

/**
 * Money the customer says they have sent. The dairy confirms it — until then it is a request, and a customer may
 * only add one or withdraw their own.
 */
function mergePaymentRequests(current: Customer, sent: Row[], ctx: SelfServiceContext): Row[] {
  const stored = byId(current.paymentRequests as Row[]);
  const today = indiaYmd(ctx.now);
  const seen = new Set<string>();
  const merged: Row[] = [];

  for (const request of sent) {
    const id = String(request.id ?? '');
    const existing = id ? stored.get(id) : undefined;
    seen.add(id);

    if (!existing) {
      const amount = Math.round(Number(request.amount) * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0) refuse('PAYMENT_AMOUNT_INVALID', 'Enter the amount you paid.', { id });
      const paidOn = ymdOf(request.paidOnYmd);
      if (!isYmd(paidOn) || paidOn > today) refuse('PAYMENT_DATE_INVALID', 'Pick the day you paid.', { id });
      if (request.status !== undefined && request.status !== 'Pending') {
        refuse('PAYMENT_STATUS_NOT_YOURS', 'Only the dairy confirms a payment.', { id });
      }
      // Confirming is the dairy's: a request arrives with nothing of the review on it.
      merged.push({ ...request, amount, status: 'Pending', paymentId: undefined, reviewNote: undefined, reviewedAt: undefined });
      continue;
    }

    if (request.status === existing.status) {
      merged.push(existing);
      continue;
    }
    if (request.status !== 'Cancelled') refuse('PAYMENT_STATUS_NOT_YOURS', 'Only the dairy confirms a payment.', { id });
    if (existing.status !== 'Pending') {
      refuse('PAYMENT_ALREADY_REVIEWED', 'The dairy has already dealt with that payment.', { id });
    }
    merged.push({ ...existing, status: 'Cancelled', updatedAt: request.updatedAt ?? existing.updatedAt });
  }

  for (const [id, request] of stored) if (!seen.has(id)) merged.push(request);
  return merged;
}

/**
 * Days that were delivered. A customer never writes these — the one thing their app does is record how many packs a
 * delivered day had, when the everyday quantity changes and that day never recorded one, so the old bill stands.
 */
function mergeDeliveries(current: Customer, sent: Row[]): Row[] {
  const stored = byId(current.deliveries as Row[]);
  const sentById = byId(sent);

  for (const id of sentById.keys()) {
    if (!stored.has(id)) refuse('DELIVERY_NOT_YOURS', 'Only the dairy records a delivery.', { id });
  }

  return [...stored.values()].map((delivery) => {
    const given = sentById.get(String(delivery.id ?? ''));
    const items = given?.subscriptionItems;
    const unrecorded = delivery.subscriptionItems === undefined || delivery.subscriptionItems === null;
    if (!given || !unrecorded || items === undefined || items === null) return delivery;
    const count = Math.floor(Number(items));
    if (!(count >= 1 && count <= MAX_DAY_QUANTITY)) refuse('DAY_QUANTITY_INVALID', 'That pack count is not right.', { id: delivery.id });
    return { ...delivery, subscriptionItems: count };
  });
}

// -----------------------------------------------------------------------------------------------------------------

/**
 * The patch to write for a customer changing their own record: every list rebuilt from what is stored, with only
 * the changes a customer may make.
 *
 * @throws ApiError 403 when the patch touches anything that is the dairy's, or 400 with the reason a change is not
 * allowed (the day is closed, the price is not the catalog's, the payment is already confirmed…).
 */
export function customerSelfPatch(current: Customer, patch: Record<string, unknown>, ctx: SelfServiceContext): Record<string, unknown> {
  const theirs = SELF_SERVICE_KEYS as readonly string[];
  const touched = Object.keys(patch).filter((key) => !theirs.includes(key));
  if (touched.length) {
    throw ApiError.forbidden('Only the dairy can change this. Please contact us.');
  }

  const list = (key: string): Row[] | undefined => {
    const value = patch[key];
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) refuse('BAD_REQUEST', 'That change was not readable.', { key });
    return value as Row[];
  };

  const out: Record<string, unknown> = {};
  const plans = list('subscriptionPlans');
  const exceptions = list('subscriptionExceptions');
  const orders = list('extraOrders');
  const requests = list('paymentRequests');
  const deliveries = list('deliveries');

  // Plans first: a quantity change for an arranged day is checked against the plan as it is stored, so the lists
  // are read from `current` throughout and only written at the end.
  if (plans) out.subscriptionPlans = mergePlans(current, plans, ctx);
  if (exceptions) out.subscriptionExceptions = mergeExceptions(current, exceptions, ctx);
  if (orders) out.extraOrders = mergeExtraOrders(current, orders, ctx);
  if (requests) out.paymentRequests = mergePaymentRequests(current, requests, ctx);
  if (deliveries) out.deliveries = mergeDeliveries(current, deliveries);
  return out;
}
