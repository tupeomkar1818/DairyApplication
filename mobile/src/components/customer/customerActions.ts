import { shiftYmd, todayYmd } from '@/src/components/admin/dashboardMetrics';
import { addOnDateYmd } from '@/src/domain/customers/addOns';
import {
  dayEditability,
  dayEditabilityForCustomer,
  MAX_DAY_QUANTITY,
  usualQuantity,
  type DayChangeActor,
} from '@/src/domain/customers/daySchedule';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { Offer } from '@/src/domain/offers/entities';
import { comboListTotal, customerHasOffer, offerCoversDay, priceOfferForPack } from '@/src/domain/offers/offers';
import type { ProductResponse } from '@/src/domain/products/dtos';
import type { ProductPack } from '@/src/domain/products/entities';
import { packPrice } from '@/src/domain/products/packs';
import { strings } from '@/src/i18n/strings';

/**
 * Everything written onto a customer's day-to-day record: add-ons, skipped days, quantity changes and subscription
 * lines — by the customer in their app, or by the admin on their behalf (`actor`), through the same rules.
 *
 * All of it is expressed as a patch for `useUpdateCustomer`, built from the record as it stands — no screen edits
 * these arrays by hand, so the rules (a locked day cannot change, a price is snapshotted at order time, a skip and
 * a subscription line never contradict) live in one place.
 */

export class DayLockedError extends Error {
  /** True when the evening cut-off closed the day: the dairy can still change it, so the app points there. */
  readonly contactAdmin: boolean;

  constructor(reason: string, options?: { contactAdmin?: boolean }) {
    super(reason);
    this.name = 'DayLockedError';
    this.contactAdmin = !!options?.contactAdmin;
  }
}

type ExtraOrder = NonNullable<CustomerResponse['extraOrders']>[number];
type Exception = NonNullable<CustomerResponse['subscriptionExceptions']>[number];
type Plan = NonNullable<CustomerResponse['subscriptionPlans']>[number];

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

/** True when the catalog is offering this product to customers today. */
export function isOrderableByCustomer(product: ProductResponse): boolean {
  return product.isActive !== false && product.isVisibleToCustomer !== false;
}

/**
 * Adds a one-off order for a day. With `offers`, the best price offer the customer has on this pack for that day sets
 * the price, and the order remembers the offer.
 *
 * @throws DayLockedError when that day is past the cut-off or already delivered.
 */
export function placeAddOnOrder(
  customer: CustomerResponse,
  input: {
    product: ProductResponse;
    pack: ProductPack;
    numberOfItems: number;
    dateYmd: string;
    actor?: DayChangeActor;
    now?: Date;
    nowIso?: string;
    offers?: readonly Offer[];
  },
): { extraOrders: ExtraOrder[]; order: ExtraOrder } {
  const editable = dayEditability(customer, input.dateYmd, input.actor ?? 'customer', input.now ?? new Date());
  if (!editable.editable) throw new DayLockedError(editable.reason, { contactAdmin: editable.contactAdmin });

  const nowIso = input.nowIso ?? new Date().toISOString();
  const items = Math.max(1, Math.floor(Number(input.numberOfItems) || 1));
  const listPrice = packPrice(input.pack);
  const deal = input.offers
    ? priceOfferForPack(
        input.offers,
        customer,
        { packId: input.pack.id, productName: input.product.name, packLabel: input.pack.label },
        input.dateYmd,
      )
    : null;
  const onOffer = deal && deal.item.offerPrice < listPrice ? deal : null;
  const order: ExtraOrder = {
    id: newId('extra'),
    orderDate: input.dateYmd,
    deliveryDate: input.dateYmd,
    productName: input.product.name,
    quantityLabel: input.pack.label,
    unit: input.pack.unit,
    numberOfItems: items,
    packId: input.pack.id,
    // Snapshot of this pack's price: the bill must not move when the catalog (or the offer) does.
    price: onOffer ? Math.round(onOffer.item.offerPrice) : listPrice,
    ...(onOffer
      ? { offer: { offerId: onOffer.offer.id, kind: 'price' as const, title: onOffer.offer.title, listPrice } }
      : null),
    status: 'Pending',
    placedBy: input.actor ?? 'customer',
    createdAt: nowIso,
    updatedAt: nowIso,
  } as ExtraOrder;

  return { extraOrders: [...(customer.extraOrders ?? []), order], order };
}

export class OfferNotAvailableError extends Error {
  constructor() {
    super('offer not available');
    this.name = 'OfferNotAvailableError';
  }
}

/**
 * Orders combos for a day: one order line holding the combo's packs, at the combo price, on the monthly bill.
 *
 * @throws OfferNotAvailableError when the combo is ended, does not cover that day, or needs a code the customer has not typed.
 * @throws DayLockedError when that day is past the cut-off or already delivered.
 */
export function placeComboOrder(
  customer: CustomerResponse,
  input: {
    offer: Offer;
    numberOfItems: number;
    dateYmd: string;
    actor?: DayChangeActor;
    now?: Date;
    nowIso?: string;
  },
): { extraOrders: ExtraOrder[]; order: ExtraOrder } {
  const { offer } = input;
  if (
    offer.kind !== 'combo' ||
    offer.endedAt ||
    !offerCoversDay(offer, input.dateYmd) ||
    !customerHasOffer(offer, customer) ||
    !(Number(offer.comboPrice) > 0)
  ) {
    throw new OfferNotAvailableError();
  }
  const editable = dayEditability(customer, input.dateYmd, input.actor ?? 'customer', input.now ?? new Date());
  if (!editable.editable) throw new DayLockedError(editable.reason, { contactAdmin: editable.contactAdmin });

  const nowIso = input.nowIso ?? new Date().toISOString();
  const order: ExtraOrder = {
    id: newId('extra'),
    orderDate: input.dateYmd,
    deliveryDate: input.dateYmd,
    // The saved names are English, like every order; screens show the offer title in the reader's language.
    productName: offer.title.en,
    quantityLabel: strings('offers', 'en').comboLabel,
    numberOfItems: Math.max(1, Math.floor(Number(input.numberOfItems) || 1)),
    price: Math.round(Number(offer.comboPrice)),
    offer: { offerId: offer.id, kind: 'combo', title: offer.title, listPrice: comboListTotal(offer) },
    comboItems: (offer.comboItems ?? []).map((i) => ({
      productName: i.productName,
      packLabel: i.packLabel,
      quantity: Math.max(1, Math.floor(i.quantity) || 1),
    })),
    status: 'Pending',
    placedBy: input.actor ?? 'customer',
    createdAt: nowIso,
    updatedAt: nowIso,
  } as ExtraOrder;

  return { extraOrders: [...(customer.extraOrders ?? []), order], order };
}

/**
 * Cancels a one-off order the customer placed.
 *
 * @throws DayLockedError when the day it was for can no longer be changed.
 */
export function cancelAddOnOrder(
  customer: CustomerResponse,
  orderId: string,
  options?: { actor?: DayChangeActor; now?: Date; nowIso?: string },
): { extraOrders: ExtraOrder[]; order: ExtraOrder | null } {
  const existing = (customer.extraOrders ?? []).find((o) => o.id === orderId) ?? null;
  if (!existing) return { extraOrders: customer.extraOrders ?? [], order: null };

  const editable = dayEditability(customer, addOnDateYmd(existing), options?.actor ?? 'customer', options?.now ?? new Date());
  if (!editable.editable) throw new DayLockedError(editable.reason, { contactAdmin: editable.contactAdmin });

  const nowIso = options?.nowIso ?? new Date().toISOString();
  return {
    extraOrders: (customer.extraOrders ?? []).map((o) =>
      o.id === orderId ? ({ ...o, status: 'Cancelled', updatedAt: nowIso } as ExtraOrder) : o,
    ),
    order: existing,
  };
}

/**
 * Stops delivery for a day or a stretch of days. A single day and a year-long break are the same row.
 *
 * @throws DayLockedError when the first day can no longer be changed.
 */
export function skipDays(
  customer: CustomerResponse,
  input: {
    fromYmd: string;
    toYmd?: string;
    planId?: string;
    reason?: string;
    actor?: DayChangeActor;
    now?: Date;
    nowIso?: string;
  },
): { subscriptionExceptions: Exception[]; skip: Exception } {
  const toYmd = input.toYmd && input.toYmd >= input.fromYmd ? input.toYmd : input.fromYmd;
  const editable = dayEditability(customer, input.fromYmd, input.actor ?? 'customer', input.now ?? new Date());
  if (!editable.editable) throw new DayLockedError(editable.reason, { contactAdmin: editable.contactAdmin });

  const nowIso = input.nowIso ?? new Date().toISOString();
  const skip: Exception = {
    id: newId('skip'),
    fromYmd: input.fromYmd,
    toYmd,
    planId: input.planId,
    reason: input.reason,
    createdBy: input.actor ?? 'customer',
    createdAt: nowIso,
    updatedAt: nowIso,
  } as Exception;

  return { subscriptionExceptions: [...(customer.subscriptionExceptions ?? []), skip], skip };
}

/**
 * Undoes a skip — "actually, do come".
 *
 * @throws DayLockedError when the day can no longer be changed.
 */
export function unskipDay(
  customer: CustomerResponse,
  skipId: string,
  options?: { actor?: DayChangeActor; now?: Date },
): { subscriptionExceptions: Exception[] } {
  const existing = (customer.subscriptionExceptions ?? []).find((s) => s.id === skipId);
  if (!existing) return { subscriptionExceptions: customer.subscriptionExceptions ?? [] };

  const editable = dayEditability(customer, existing.fromYmd, options?.actor ?? 'customer', options?.now ?? new Date());
  if (!editable.editable) throw new DayLockedError(editable.reason, { contactAdmin: editable.contactAdmin });

  return {
    subscriptionExceptions: (customer.subscriptionExceptions ?? []).filter((s) => s.id !== skipId),
  };
}

/** Starts a daily subscription for a product. The admin's pricing fields are filled from the catalog. */
export function subscribeToProduct(
  customer: CustomerResponse,
  input: {
    product: ProductResponse;
    pack: ProductPack;
    numberOfItems: number;
    startYmd: string;
    endYmd?: string;
    deliveryTime?: Plan['deliveryTime'];
    nowIso?: string;
  },
): { subscriptionPlans: Plan[]; plan: Plan } {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const unit = packPrice(input.pack);
  const plan: Plan = {
    id: newId('sub'),
    productName: input.product.name,
    quantityLabel: input.pack.label,
    unitType: input.pack.unit,
    packId: input.pack.id,
    numberOfItems: Math.max(1, Math.floor(Number(input.numberOfItems) || 1)),
    subscriptionKind: 'Monthly',
    deliveryTime: input.deliveryTime ?? customer.deliveryTime ?? 'Morning',
    frequency: 'Daily',
    startDate: input.startYmd,
    endDate: input.endYmd || undefined,
    // No end date chosen means "until I stop" — never the end of the start month.
    openEnded: !input.endYmd,
    status: 'Active',
    productAdditionTag: 'Regular',
    originalPrice: Math.round(Number(input.pack.price ?? 0)),
    discountedPrice: Math.round(Number(input.pack.discountPrice ?? 0)),
    effectiveFinalPrice: unit,
    createdAt: nowIso,
    updatedAt: nowIso,
  } as Plan;

  return { subscriptionPlans: [...(customer.subscriptionPlans ?? []), plan], plan };
}

/**
 * The first day a customer can still order for: tomorrow, or the day after once tonight's cut-off has passed.
 * The catalog's "Add" button uses this, so tapping Add never lands on a day the app would then refuse.
 */
export function nextOrderableDayYmd(customer: CustomerResponse, now: Date = new Date()): string {
  let ymd = shiftYmd(todayYmd(now), 1);
  // A handful of hops at most: the cut-off pushes one day, a delivered row another.
  for (let i = 0; i < 7; i += 1) {
    if (dayEditabilityForCustomer(customer, ymd, now).editable) return ymd;
    ymd = shiftYmd(ymd, 1);
  }
  return ymd;
}

/** The customer's open order for this product and pack on a day, if they already placed one. */
export function findPendingAddOn(
  customer: CustomerResponse,
  ymd: string,
  productName: string,
  pack: Pick<ProductPack, 'id' | 'label'>,
): ExtraOrder | null {
  return (
    (customer.extraOrders ?? []).find((o) => {
      if (o.status !== 'Pending' || addOnDateYmd(o) !== ymd) return false;
      if (String(o.productName ?? '').trim() !== productName.trim()) return false;
      return o.packId ? o.packId === pack.id : String(o.quantityLabel ?? '').trim() === pack.label.trim();
    }) ?? null
  );
}

/**
 * Changes how many packs an open order is for; dropping to zero cancels it.
 *
 * @throws DayLockedError when the day it is for can no longer be changed.
 */
export function setAddOnItems(
  customer: CustomerResponse,
  orderId: string,
  items: number,
  options?: { actor?: DayChangeActor; now?: Date; nowIso?: string },
): { extraOrders: ExtraOrder[] } {
  const existing = (customer.extraOrders ?? []).find((o) => o.id === orderId);
  if (!existing) return { extraOrders: customer.extraOrders ?? [] };

  const wanted = Math.floor(Number(items) || 0);
  if (wanted <= 0) return cancelAddOnOrder(customer, orderId, options);

  const editable = dayEditability(customer, addOnDateYmd(existing), options?.actor ?? 'customer', options?.now ?? new Date());
  if (!editable.editable) throw new DayLockedError(editable.reason, { contactAdmin: editable.contactAdmin });

  const nowIso = options?.nowIso ?? new Date().toISOString();
  return {
    extraOrders: (customer.extraOrders ?? []).map((o) =>
      o.id === orderId ? ({ ...o, numberOfItems: wanted, updatedAt: nowIso } as ExtraOrder) : o,
    ),
  };
}

export class SubscriptionDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubscriptionDateError';
  }
}

/** Checks a subscription's chosen dates: a real start, and an end (when given) on or after it. */
export function validateSubscriptionDates(startYmd: string, endYmd?: string): void {
  const t = strings('customer').subscriptionRules;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) throw new SubscriptionDateError(t.chooseStart);
  if (endYmd && !/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) throw new SubscriptionDateError(t.invalidEnd);
  if (endYmd && endYmd < startYmd) throw new SubscriptionDateError(t.endBeforeStart);
}

/**
 * Sets how many packs of one subscription line come on a day, or on every day of a range.
 *
 * Earlier quantity changes for that line falling wholly inside the range are replaced, so tapping + three times on
 * the same day leaves one change, not three. Asking for the line's usual quantity just clears the changes; 0 means
 * none of that line on those days (the rest of the day still comes).
 *
 * @throws DayLockedError when the first day can no longer be changed.
 */
export function setPlanQuantityForDays(
  customer: CustomerResponse,
  input: {
    planId: string;
    fromYmd: string;
    toYmd?: string;
    numberOfItems: number;
    actor?: DayChangeActor;
    now?: Date;
    nowIso?: string;
  },
): { subscriptionExceptions: Exception[] } {
  const plan = (customer.subscriptionPlans ?? []).find((p) => p.id === input.planId);
  const current = customer.subscriptionExceptions ?? [];
  if (!plan) return { subscriptionExceptions: current };

  const toYmd = input.toYmd && input.toYmd >= input.fromYmd ? input.toYmd : input.fromYmd;
  const editable = dayEditability(customer, input.fromYmd, input.actor ?? 'customer', input.now ?? new Date());
  if (!editable.editable) throw new DayLockedError(editable.reason, { contactAdmin: editable.contactAdmin });

  const wanted = Math.max(0, Math.min(MAX_DAY_QUANTITY, Math.floor(Number(input.numberOfItems) || 0)));

  // Changes this one supersedes: same line, quantity kind, wholly inside the new range.
  const kept = current.filter(
    (ex) =>
      !(
        ex.kind === 'quantity' &&
        ex.planId === input.planId &&
        ex.fromYmd >= input.fromYmd &&
        (ex.toYmd || ex.fromYmd) <= toYmd
      ),
  );

  if (wanted === usualQuantity(plan)) return { subscriptionExceptions: kept };

  const nowIso = input.nowIso ?? new Date().toISOString();
  const change: Exception = {
    id: newId('qty'),
    kind: 'quantity',
    fromYmd: input.fromYmd,
    toYmd,
    planId: input.planId,
    numberOfItems: wanted,
    createdBy: input.actor ?? 'customer',
    createdAt: nowIso,
    updatedAt: nowIso,
  } as Exception;

  return { subscriptionExceptions: [...kept, change] };
}
