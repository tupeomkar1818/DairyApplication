import { shiftYmd } from '@/src/components/admin/dashboardMetrics';
import { isOrderableByCustomer, nextOrderableDayYmd } from '@/src/components/customer/customerActions';
import { addOnDateYmd } from '@/src/domain/customers/addOns';
import { dayEditabilityForCustomer } from '@/src/domain/customers/daySchedule';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { Offer, PriceOfferItem } from '@/src/domain/offers/entities';
import {
  comboListTotal,
  comboSavings,
  normalizeOfferCode,
  offerCoversDay,
  offerText,
  type OfferDiscountLine,
} from '@/src/domain/offers/offers';
import type { ProductResponse } from '@/src/domain/products/dtos';
import type { ProductPack } from '@/src/domain/products/entities';
import { orderablePacks } from '@/src/domain/products/packs';
import type { Lang } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';
import { formatDay, formatMoney } from '@/src/utils/format';

/**
 * What the customer's offer cards say, worked out without React so the words and numbers can be tested: the headline
 * of an offer, how a bill or subscription offer applies, which packs can still be ordered, and the days an offer order
 * can be placed for.
 */

export type OfferHeadline = {
  title: string;
  description: string;
  kindName: string;
  /** "Valid till 30 Sep", or "Until the dairy ends it". */
  validity: string;
  /** The code the customer typed to get it, when it needs one. */
  code: string | null;
};

export function offerHeadline(offer: Offer, lang: Lang): OfferHeadline {
  const o = strings('offers', lang);
  const code = normalizeOfferCode(offer.code);
  return {
    title: offerText(offer.title, lang),
    description: offerText(offer.description, lang),
    kindName: o.kinds[offer.kind],
    validity: offer.endYmd ? o.validTill(formatDay(offer.endYmd, { lang })) : o.untilEnded,
    code: code || null,
  };
}

/**
 * How a bill discount or a subscription reward applies, one line each: "10% off your bill, up to ₹100", "₹2 off per
 * pack on regular deliveries", "On days with 2+ packs", "On Cow Milk, Buffalo Milk". Nothing for other kinds.
 */
export function offerRuleLines(offer: Offer, lang: Lang): string[] {
  const t = strings('offerCustomer', lang).card;
  const o = strings('offers', lang);
  const rule = offer.discount;
  if (!rule || (offer.kind !== 'bill' && offer.kind !== 'subscription')) return [];
  const lines: string[] = [];
  const max = rule.type === 'percent' && rule.maxDiscount != null && rule.maxDiscount > 0 ? formatMoney(rule.maxDiscount) : null;
  if (offer.kind === 'bill') {
    lines.push(
      rule.type === 'flat'
        ? t.billFlat(formatMoney(rule.value))
        : max
          ? t.billPercentUpTo(rule.value, max)
          : t.billPercent(rule.value),
    );
  } else {
    lines.push(
      rule.type === 'flat'
        ? t.rewardFlat(formatMoney(rule.value))
        : max
          ? t.rewardPercentUpTo(rule.value, max)
          : t.rewardPercent(rule.value),
    );
    const minPacks = Math.floor(Number(offer.minPacksPerDay) || 0);
    if (minPacks > 1) lines.push(o.minPacks(minPacks));
    const names = (offer.rewardProducts ?? []).map((p) => String(p.productName ?? '').trim()).filter(Boolean);
    lines.push(names.length ? t.onlyProducts(names.join(', ')) : o.allProducts);
  }
  return lines;
}

export type PriceOfferRow = {
  item: PriceOfferItem;
  save: number;
  /** The catalog product and pack to order, or null when the pack is no longer on sale. */
  product: ProductResponse | null;
  pack: ProductPack | null;
};

/** A price offer's packs, each matched to the catalog pack a customer can still order (by pack id). */
export function priceOfferRows(offer: Offer, products: readonly ProductResponse[]): PriceOfferRow[] {
  return (offer.priceItems ?? []).map((item) => {
    let product: ProductResponse | null = null;
    let pack: ProductPack | null = null;
    for (const p of products) {
      if (!isOrderableByCustomer(p)) continue;
      const found = orderablePacks(p).find((pk) => pk.id === item.packId);
      if (found) {
        product = p;
        pack = found;
        break;
      }
    }
    return { item, save: Math.max(0, Math.round(item.listPrice - item.offerPrice)), product, pack };
  });
}

/** A combo's price, what its packs cost normally, and the saving on one combo. */
export function comboPricing(offer: Offer): { price: number; worth: number; save: number } {
  return { price: Math.round(Number(offer.comboPrice) || 0), worth: comboListTotal(offer), save: comboSavings(offer) };
}

/**
 * The first days an offer order can be placed for: open for the customer (before the 9 pm cut-off, not delivered)
 * and covered by the offer. Empty when the offer has no such day left.
 */
export function offerOrderDays(
  customer: CustomerResponse,
  offer: Pick<Offer, 'startYmd' | 'endYmd' | 'endedAt'>,
  now: Date = new Date(),
  limit = 6,
): string[] {
  if (offer.endedAt) return [];
  const first = nextOrderableDayYmd(customer, now);
  let ymd = first < offer.startYmd ? offer.startYmd : first;
  const days: string[] = [];
  // Two months ahead is plenty to find a handful of open days.
  for (let i = 0; i < 62 && days.length < limit; i += 1) {
    if (offer.endYmd && ymd > offer.endYmd) break;
    if (offerCoversDay(offer, ymd) && dayEditabilityForCustomer(customer, ymd, now).editable) days.push(ymd);
    ymd = shiftYmd(ymd, 1);
  }
  return days;
}

/**
 * The offer lines to print on a month's bill, made to add up to what the bill actually took off (`billedTotal`, the
 * timeline row's `offerDiscount`, which can be capped at the month's charges). Lines that no longer fit are shrunk
 * from the smallest up, and dropped at zero.
 */
export function billOfferLines(lines: readonly OfferDiscountLine[], billedTotal: number): OfferDiscountLine[] {
  const target = Math.max(0, Math.round(billedTotal));
  let excess = lines.reduce((sum, l) => sum + l.amount, 0) - target;
  if (excess <= 0) return [...lines];
  const out = lines.map((l) => ({ ...l }));
  for (let i = out.length - 1; i >= 0 && excess > 0; i -= 1) {
    const cut = Math.min(out[i]!.amount, excess);
    out[i]!.amount -= cut;
    excess -= cut;
  }
  return out.filter((l) => l.amount > 0);
}

type ExtraOrder = NonNullable<CustomerResponse['extraOrders']>[number];

/**
 * The customer's open order a new one for the same day can be added to: the same pack (or the same combo) under the
 * same offer — or under no offer, when `offerId` is null. An order at another price stays a line of its own, so its
 * price and savings stay right.
 */
export function findPendingOfferOrder(
  customer: Pick<CustomerResponse, 'extraOrders'>,
  ymd: string,
  match: { offerId: string | null } & ({ comboOfferId: string } | { packId: string; productName: string; packLabel: string }),
): ExtraOrder | null {
  return (
    (customer.extraOrders ?? []).find((o) => {
      if (o.status !== 'Pending' || addOnDateYmd(o) !== ymd) return false;
      if ((o.offer?.offerId ?? null) !== match.offerId) return false;
      if ('comboOfferId' in match) return !!o.comboItems?.length && o.offer?.offerId === match.comboOfferId;
      if (o.comboItems?.length) return false;
      if (String(o.productName ?? '').trim() !== match.productName.trim()) return false;
      return o.packId ? o.packId === match.packId : String(o.quantityLabel ?? '').trim() === match.packLabel.trim();
    }) ?? null
  );
}

/** Live offers the customer should be told about: not ones they unlocked themselves by typing a code. */
export function offersToAnnounce(liveOffers: readonly Offer[]): Offer[] {
  return liveOffers.filter((o) => !normalizeOfferCode(o.code));
}
