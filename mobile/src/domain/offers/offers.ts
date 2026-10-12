import {
  deliveredSubscriptionCharges,
  type BillableDeliveryLineInput,
  type CustomerDeliveryRowInput,
} from '@/src/components/admin/customerSubscriptionMonthUtils';
import { addOnDateYmd, addOnItemCount, addOnLineTotal } from '@/src/domain/customers/addOns';
import type { Customer, CustomerExtraOrder } from '@/src/domain/customers/entities';
import type { CustomerSubscriptionPlanDto } from '@/src/domain/customers/dtos';
import type {
  Offer,
  OfferClaim,
  OfferKind,
  OfferText,
  PriceOfferItem,
} from '@/src/domain/offers/entities';
import { getLanguage, type Lang } from '@/src/i18n/language';

/**
 * The rules of offers: when one runs, who gets it, what a pack costs under it, and how much comes off a month's bill.
 * Pure functions over the offers list and a customer record, so every screen, the bill and the reports agree.
 */

export type OfferStatus = 'scheduled' | 'live' | 'ended';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function ymdOf(value: string | undefined | null): string {
  const s = String(value ?? '').slice(0, 10);
  return YMD.test(s) ? s : '';
}

/**
 * Scheduled before its first day, live from then until its last day, ended after — or at once when the admin ended it
 * (it then leaves the app and the website straight away, while bills still count it through its last day).
 */
export function offerStatus(offer: Pick<Offer, 'startYmd' | 'endYmd' | 'endedAt'>, todayYmd: string): OfferStatus {
  if (offer.endedAt) return 'ended';
  if (todayYmd < offer.startYmd) return 'scheduled';
  if (offer.endYmd && todayYmd > offer.endYmd) return 'ended';
  return 'live';
}

/** True when the offer covers this (delivery) day. */
export function offerCoversDay(offer: Pick<Offer, 'startYmd' | 'endYmd'>, ymd: string): boolean {
  return !!ymdOf(ymd) && ymd >= offer.startYmd && (!offer.endYmd || ymd <= offer.endYmd);
}

/** "diwali 50" → "DIWALI50": codes are compared without case or spaces. */
export function normalizeOfferCode(code: string | undefined | null): string {
  return String(code ?? '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

/** Without a code everyone has the offer; with one, only customers who typed it. */
export function customerHasOffer(
  offer: Pick<Offer, 'id' | 'code'>,
  customer: Pick<Customer, 'offerClaims'> | null | undefined,
): boolean {
  if (!normalizeOfferCode(offer.code)) return true;
  return !!customer?.offerClaims?.some((c) => c.offerId === offer.id);
}

/** The offer's wording in `lang`, English when the Marathi was left empty. */
export function offerText(text: OfferText | undefined, lang: Lang = getLanguage()): string {
  if (!text) return '';
  const own = lang === 'mr' ? String(text.mr ?? '').trim() : '';
  return own || String(text.en ?? '').trim();
}

/** Offers a customer can see today: live, and theirs (typed code or no code). Newest first. */
export function liveOffersFor(
  offers: readonly Offer[],
  customer: Pick<Customer, 'offerClaims'> | null | undefined,
  todayYmd: string,
): Offer[] {
  return offers
    .filter((o) => offerStatus(o, todayYmd) === 'live' && customerHasOffer(o, customer))
    .sort((a, b) => b.startYmd.localeCompare(a.startYmd) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** Offers the public may see (website): live and without a code. */
export function publicLiveOffers(offers: readonly Offer[], todayYmd: string): Offer[] {
  return liveOffersFor(offers, null, todayYmd);
}

export type OfferCodeProblem = 'empty' | 'unknown' | 'ended' | 'alreadyApplied';

export class OfferCodeError extends Error {
  readonly problem: OfferCodeProblem;
  constructor(problem: OfferCodeProblem) {
    super(problem);
    this.name = 'OfferCodeError';
    this.problem = problem;
  }
}

/**
 * Applies a code the customer typed. A code for an offer that has not started yet is accepted too: it applies from
 * the offer's first day.
 *
 * @throws OfferCodeError when the code is empty, unknown, for an ended offer, or already applied.
 */
export function claimOfferCode(
  customer: Pick<Customer, 'offerClaims'>,
  offers: readonly Offer[],
  typed: string,
  todayYmd: string,
  nowIso: string = new Date().toISOString(),
): { offerClaims: OfferClaim[]; offer: Offer } {
  const code = normalizeOfferCode(typed);
  if (!code) throw new OfferCodeError('empty');
  const matching = offers.filter((o) => normalizeOfferCode(o.code) === code);
  if (matching.length === 0) throw new OfferCodeError('unknown');
  const offer = matching.find((o) => offerStatus(o, todayYmd) !== 'ended');
  if (!offer) throw new OfferCodeError('ended');
  const claims = customer.offerClaims ?? [];
  if (claims.some((c) => c.offerId === offer.id)) throw new OfferCodeError('alreadyApplied');
  return { offerClaims: [...claims, { offerId: offer.id, code, claimedAt: nowIso }], offer };
}

type PackKey = { packId?: string; productName?: string; packLabel?: string };

function samePack(item: PackKey, pack: PackKey): boolean {
  if (item.packId && pack.packId) return item.packId === pack.packId;
  const norm = (s: string | undefined) => String(s ?? '').trim().toLowerCase();
  return !!norm(item.productName) && norm(item.productName) === norm(pack.productName) && norm(item.packLabel) === norm(pack.packLabel);
}

/**
 * The best price offer this customer has on a pack for a delivery day, or null. With two offers on the same pack the
 * lower price wins — offers never stack.
 */
export function priceOfferForPack(
  offers: readonly Offer[],
  customer: Pick<Customer, 'offerClaims'> | null | undefined,
  pack: PackKey,
  ymd: string,
): { offer: Offer; item: PriceOfferItem } | null {
  let best: { offer: Offer; item: PriceOfferItem } | null = null;
  for (const offer of offers) {
    // An ended offer takes no new orders, even for a day it still covers.
    if (offer.kind !== 'price' || offer.endedAt || !offerCoversDay(offer, ymd) || !customerHasOffer(offer, customer)) continue;
    for (const item of offer.priceItems ?? []) {
      if (!samePack(item, pack) || !(item.offerPrice >= 0) || item.offerPrice >= item.listPrice) continue;
      if (!best || item.offerPrice < best.item.offerPrice) best = { offer, item };
    }
  }
  return best;
}

/** What the combo's packs cost at their normal prices. */
export function comboListTotal(offer: Pick<Offer, 'comboItems'>): number {
  return Math.round(
    (offer.comboItems ?? []).reduce((sum, i) => sum + Math.max(0, Number(i.listPrice) || 0) * Math.max(1, Math.floor(i.quantity) || 1), 0),
  );
}

/** Rupees saved on one combo. */
export function comboSavings(offer: Pick<Offer, 'comboItems' | 'comboPrice'>): number {
  return Math.max(0, comboListTotal(offer) - Math.round(Number(offer.comboPrice) || 0));
}

/** What the customer saved on a one-off order placed under an offer (price offer or combo). */
export function orderSavings(order: Pick<CustomerExtraOrder, 'offer' | 'price' | 'numberOfItems' | 'status'>): number {
  if (!order.offer || order.status === 'Cancelled') return 0;
  const each = Math.max(0, Number(order.offer.listPrice) - Number(order.price));
  return Math.round(each * addOnItemCount(order));
}

export type OfferDiscountLine = {
  offerId: string;
  kind: OfferKind;
  title: OfferText;
  /** Whole rupees off the bill. */
  amount: number;
};

type BillCustomer = Pick<Customer, 'subscriptionPlans' | 'deliveries' | 'extraOrders' | 'offerClaims'>;

/**
 * What offers take off a month's bill, one line per offer:
 *
 * 1. Each delivered subscription day gets the single best of: a price offer that includes regular deliveries, or a
 *    subscription reward. One-off orders already carry their offer price, so they get nothing here.
 * 2. The best bill offer then comes off what was delivered in its dates (a flat amount once a month).
 *
 * Only offers covering the delivery day count, and only for customers who have them (code typed, or no code).
 */
export function offerDiscountsForMonth(
  customer: BillCustomer,
  monthYyyyMm: string,
  offers: readonly Offer[],
  dailyOrderLines: BillableDeliveryLineInput[] = [],
): OfferDiscountLine[] {
  if (!offers.length) return [];
  const eligible = offers.filter((o) => customerHasOffer(o, customer));
  if (!eligible.length) return [];

  const plans = (customer.subscriptionPlans ?? []) as CustomerSubscriptionPlanDto[];
  const byOffer = new Map<string, number>();
  const add = (offerId: string, amount: number) => byOffer.set(offerId, (byOffer.get(offerId) ?? 0) + amount);

  // What was delivered each day after item discounts — the base for bill offers.
  const chargedByDay = new Map<string, number>();
  const charge = (ymd: string, amount: number) => chargedByDay.set(ymd, (chargedByDay.get(ymd) ?? 0) + amount);

  const itemOffers = eligible.filter((o) => (o.kind === 'price' && o.includeRegular) || o.kind === 'subscription');
  const rewardCaps = new Map<string, number>();

  for (const c of deliveredSubscriptionCharges(plans, (customer.deliveries ?? []) as CustomerDeliveryRowInput[], dailyOrderLines)) {
    if (c.ymd.slice(0, 7) !== monthYyyyMm) continue;
    const packs = Math.max(0, c.packs);
    const amount = Math.max(0, c.amount);
    const unit = packs > 0 ? amount / packs : 0;
    const plan = plans[c.planIndex];
    const pack: PackKey = { packId: plan?.packId, productName: c.productName, packLabel: c.packLabel };

    let best: { offerId: string; off: number } | null = null;
    for (const offer of itemOffers) {
      if (!offerCoversDay(offer, c.ymd)) continue;
      let off = 0;
      if (offer.kind === 'price') {
        const item = (offer.priceItems ?? []).find((i) => samePack(i, pack));
        if (item && unit > item.offerPrice) off = (unit - item.offerPrice) * packs;
      } else {
        const products = offer.rewardProducts ?? [];
        const productOk =
          products.length === 0 ||
          products.some((p) => String(p.productName).trim().toLowerCase() === c.productName.trim().toLowerCase());
        const packsOk = packs >= Math.max(0, Math.floor(Number(offer.minPacksPerDay) || 0));
        if (productOk && packsOk && offer.discount) {
          off = offer.discount.type === 'percent' ? (amount * offer.discount.value) / 100 : offer.discount.value * packs;
        }
      }
      off = Math.min(amount, Math.max(0, off));
      if (off > 0 && (!best || off > best.off)) best = { offerId: offer.id, off };
    }

    if (best) {
      const offer = itemOffers.find((o) => o.id === best!.offerId)!;
      // A percent reward may cap what one month can take off.
      const cap = offer.kind === 'subscription' && offer.discount?.type === 'percent' ? offer.discount.maxDiscount : undefined;
      let off = best.off;
      if (cap != null && cap >= 0) {
        const used = rewardCaps.get(offer.id) ?? 0;
        off = Math.min(off, Math.max(0, cap - used));
        rewardCaps.set(offer.id, used + off);
      }
      if (off > 0) add(offer.id, off);
      charge(c.ymd, amount - off);
    } else {
      charge(c.ymd, amount);
    }
  }

  for (const order of customer.extraOrders ?? []) {
    if (order.status !== 'Delivered') continue;
    const ymd = addOnDateYmd(order);
    if (ymd.slice(0, 7) !== monthYyyyMm) continue;
    charge(ymd, addOnLineTotal(order));
  }

  // One bill offer per month: the one that takes off the most.
  let bestBill: { offerId: string; off: number } | null = null;
  for (const offer of eligible) {
    if (offer.kind !== 'bill' || !offer.discount) continue;
    let base = 0;
    for (const [ymd, amount] of chargedByDay) if (offerCoversDay(offer, ymd)) base += amount;
    if (base <= 0) continue;
    let off =
      offer.discount.type === 'percent'
        ? (base * offer.discount.value) / 100
        : offer.discount.value;
    if (offer.discount.type === 'percent' && offer.discount.maxDiscount != null && offer.discount.maxDiscount >= 0) {
      off = Math.min(off, offer.discount.maxDiscount);
    }
    off = Math.min(base, Math.max(0, off));
    if (off > 0 && (!bestBill || off > bestBill.off)) bestBill = { offerId: offer.id, off };
  }
  if (bestBill) add(bestBill.offerId, bestBill.off);

  const lines: OfferDiscountLine[] = [];
  for (const [offerId, amount] of byOffer) {
    const offer = eligible.find((o) => o.id === offerId)!;
    const rounded = Math.round(amount);
    if (rounded > 0) lines.push({ offerId, kind: offer.kind, title: offer.title, amount: rounded });
  }
  return lines.sort((a, b) => b.amount - a.amount);
}

/** Rupees offers take off a month's bill. */
export function offerDiscountTotalForMonth(
  customer: BillCustomer,
  monthYyyyMm: string,
  offers: readonly Offer[],
  dailyOrderLines: BillableDeliveryLineInput[] = [],
): number {
  return offerDiscountsForMonth(customer, monthYyyyMm, offers, dailyOrderLines).reduce((sum, l) => sum + l.amount, 0);
}

/** Everything a customer saved through offers in a month: bill discounts plus offer prices on delivered orders. */
export function offerSavingsForMonth(customer: BillCustomer, monthYyyyMm: string, offers: readonly Offer[]): number {
  const onOrders = (customer.extraOrders ?? [])
    .filter((o) => o.status === 'Delivered' && addOnDateYmd(o).slice(0, 7) === monthYyyyMm)
    .reduce((sum, o) => sum + orderSavings(o), 0);
  return onOrders + offerDiscountTotalForMonth(customer, monthYyyyMm, offers);
}
