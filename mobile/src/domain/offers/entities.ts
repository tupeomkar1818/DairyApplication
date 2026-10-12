import type { EntityBase } from '@/src/domain/shared/types';

/**
 * Offers the dairy runs for a while — decided on what the market is doing at the time, so the admin picks the kind
 * each time:
 *
 * - `price`: a lower price on some packs ("Shrikhand 500 g ₹180 → ₹160") for one-off orders delivered in the dates,
 *   and on the regular subscription deliveries too when `includeRegular` is on.
 * - `combo`: a set of packs sold together at one price ("Diwali box"), ordered like a one-off order.
 * - `bill`: a percent or a flat amount off the monthly bill.
 * - `subscription`: a reward on regular subscription deliveries (₹ or % off per pack), optionally only for customers
 *   taking at least a number of packs a day.
 *
 * Every offer is for all customers and has no stock or per-customer limit. With a `code`, only customers who typed
 * the code get it; without one it applies by itself. Everything goes on the monthly bill.
 *
 * Bills are worked out from the offers, so an offer that has started is never deleted or re-priced: it can only be
 * ended early (`endYmd` moves to the day it was ended). That keeps every bill that already counted it unchanged.
 */

export type OfferKind = 'price' | 'combo' | 'bill' | 'subscription';

export const OFFER_KINDS: readonly OfferKind[] = ['price', 'combo', 'bill', 'subscription'];

/** Wording the admin writes once per language; Marathi falls back to English when left empty. */
export type OfferText = { en: string; mr?: string };

/** One pack an offer is about, as the catalog had it when the offer was made. */
export type OfferPackRef = {
  productId: string;
  packId: string;
  productName: string;
  packLabel: string;
};

export type PriceOfferItem = OfferPackRef & {
  /** The pack's normal price when the offer was made (for the struck-through price and savings). */
  listPrice: number;
  /** What a pack costs during the offer. */
  offerPrice: number;
};

export type ComboOfferItem = OfferPackRef & {
  /** Packs of this in one combo. */
  quantity: number;
  /** One pack's normal price when the offer was made. */
  listPrice: number;
};

export type OfferDiscountRule =
  | { type: 'percent'; value: number; /** Largest discount on one month's bill; none when omitted. */ maxDiscount?: number }
  | { type: 'flat'; value: number };

export interface Offer extends EntityBase {
  kind: OfferKind;
  title: OfferText;
  description?: OfferText;
  /** Poster shown on the offer card (a picture URI, as announcements store them). */
  imageUri?: string;
  /** First day it applies to (YYYY-MM-DD, by delivery day). */
  startYmd: string;
  /** Last day it applies to (YYYY-MM-DD, inclusive); runs until ended when omitted. */
  endYmd?: string;
  /** Set when the admin ended it before its planned end. */
  endedAt?: string;
  /** Upper-case code the customer types to get it; the offer applies by itself when omitted. */
  code?: string;

  /** `price`: the packs and their offer prices. */
  priceItems?: PriceOfferItem[];
  /** `price`: also bill the regular subscription deliveries of these packs at the offer price. */
  includeRegular?: boolean;

  /** `combo`: what one combo holds, and its price. */
  comboItems?: ComboOfferItem[];
  comboPrice?: number;

  /** `bill` and `subscription`: how much comes off. `subscription` flat means ₹ off per pack. */
  discount?: OfferDiscountRule;
  /** `subscription`: only these products' regular deliveries (all products when empty). */
  rewardProducts?: { productId: string; productName: string }[];
  /** `subscription`: only days the customer takes at least this many packs of the line. */
  minPacksPerDay?: number;
}

/** A customer who typed an offer's code. */
export type OfferClaim = { offerId: string; code: string; claimedAt: string };

/** The offer an order was placed under, saved on the order so its bill and delivery never depend on later edits. */
export type OrderOfferSnapshot = {
  offerId: string;
  kind: Extract<OfferKind, 'price' | 'combo'>;
  title: OfferText;
  /** One pack's (or one combo's) normal price, for "you saved". */
  listPrice: number;
};
