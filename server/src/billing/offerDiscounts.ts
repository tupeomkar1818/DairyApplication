import { addOnDateYmd, addOnLineTotal, subscriptionCharges } from '@/billing/charges';
import type { Customer } from '@/customers/mapping';
import type { Row } from '@/customers/selfService';
import type { Offer } from '@/offers/mapping';

/**
 * What the dairy's offers take off a month's bill.
 *
 * A port of `mobile/src/domain/offers/offers.ts` (`offerDiscountsForMonth`), and it must stay in step with it:
 *
 * 1. Each delivered subscription day gets the single best of — a price offer that includes regular deliveries, or a
 *    subscription reward. One-off orders already carry their offer price, so they get nothing here.
 * 2. The best bill offer then comes off what was delivered in its dates, once a month.
 *
 * Only offers covering the delivery day count, and only for customers who have them: no code, or the code typed.
 */

export type OfferDiscountLine = { offerId: string; kind: string; title: unknown; amount: number };

const norm = (value: unknown): string => String(value ?? '').trim().toLowerCase();

function coversDay(offer: Offer, ymd: string): boolean {
  return ymd >= String(offer.startYmd) && (!offer.endYmd || ymd <= String(offer.endYmd));
}

/** Without a code everyone has the offer; with one, only the customers who typed it. */
function customerHasOffer(offer: Offer, customer: Customer): boolean {
  const code = String(offer.code ?? '').replace(/\s+/g, '').toUpperCase();
  if (!code) return true;
  return ((customer.offerClaims as Row[]) ?? []).some((claim) => claim.offerId === offer.id);
}

function samePack(item: Row, pack: { packId?: unknown; productName: string; packLabel: string }): boolean {
  if (item.packId && pack.packId) return item.packId === pack.packId;
  return !!norm(item.productName) && norm(item.productName) === norm(pack.productName) && norm(item.packLabel) === norm(pack.packLabel);
}

export function offerDiscountsForMonth(customer: Customer, month: string, offers: readonly Offer[]): OfferDiscountLine[] {
  if (!offers.length) return [];
  const eligible = offers.filter((offer) => customerHasOffer(offer, customer));
  if (!eligible.length) return [];

  const plans = ((customer.subscriptionPlans as Row[]) ?? []) as Row[];
  const byOffer = new Map<string, number>();
  const add = (offerId: string, amount: number) => byOffer.set(offerId, (byOffer.get(offerId) ?? 0) + amount);

  // What was delivered each day after the item discounts — the base a bill offer comes off.
  const chargedByDay = new Map<string, number>();
  const charge = (ymd: string, amount: number) => chargedByDay.set(ymd, (chargedByDay.get(ymd) ?? 0) + amount);

  const itemOffers = eligible.filter((offer) => (offer.kind === 'price' && offer.includeRegular) || offer.kind === 'subscription');
  const rewardCaps = new Map<string, number>();

  for (const c of subscriptionCharges(customer)) {
    if (c.ymd.slice(0, 7) !== month) continue;
    const packs = Math.max(0, c.packs);
    const amount = Math.max(0, c.amount);
    const unit = packs > 0 ? amount / packs : 0;
    const plan = plans[c.planIndex];
    const pack = { packId: plan?.packId, productName: c.productName, packLabel: c.packLabel };

    let best: { offerId: string; off: number } | null = null;
    for (const offer of itemOffers) {
      if (!coversDay(offer, c.ymd)) continue;
      let off = 0;
      if (offer.kind === 'price') {
        const item = ((offer.priceItems as Row[]) ?? []).find((i) => samePack(i, pack));
        if (item && unit > Number(item.offerPrice)) off = (unit - Number(item.offerPrice)) * packs;
      } else {
        const products = (offer.rewardProducts as { productName?: string }[]) ?? [];
        const discount = offer.discount as { type?: string; value?: number; maxDiscount?: number } | undefined;
        const productOk = products.length === 0 || products.some((p) => norm(p.productName) === norm(c.productName));
        const packsOk = packs >= Math.max(0, Math.floor(Number(offer.minPacksPerDay) || 0));
        if (productOk && packsOk && discount) {
          off = discount.type === 'percent' ? (amount * Number(discount.value)) / 100 : Number(discount.value) * packs;
        }
      }
      off = Math.min(amount, Math.max(0, off));
      if (off > 0 && (!best || off > best.off)) best = { offerId: offer.id, off };
    }

    if (best) {
      const offer = itemOffers.find((o) => o.id === best!.offerId)!;
      const discount = offer.discount as { type?: string; maxDiscount?: number } | undefined;
      // A percent reward may cap what one month can take off.
      const cap = offer.kind === 'subscription' && discount?.type === 'percent' ? discount.maxDiscount : undefined;
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

  for (const order of ((customer.extraOrders as Row[]) ?? []) as Row[]) {
    if (order.status !== 'Delivered') continue;
    const ymd = addOnDateYmd(order);
    if (ymd.slice(0, 7) !== month) continue;
    charge(ymd, addOnLineTotal(order));
  }

  // One bill offer a month: the one that takes off the most.
  let bestBill: { offerId: string; off: number } | null = null;
  for (const offer of eligible) {
    const discount = offer.discount as { type?: string; value?: number; maxDiscount?: number } | undefined;
    if (offer.kind !== 'bill' || !discount) continue;
    let base = 0;
    for (const [ymd, amount] of chargedByDay) if (coversDay(offer, ymd)) base += amount;
    if (base <= 0) continue;
    let off = discount.type === 'percent' ? (base * Number(discount.value)) / 100 : Number(discount.value);
    if (discount.type === 'percent' && discount.maxDiscount != null && discount.maxDiscount >= 0) {
      off = Math.min(off, discount.maxDiscount);
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

export function offerDiscountTotalForMonth(customer: Customer, month: string, offers: readonly Offer[]): number {
  return offerDiscountsForMonth(customer, month, offers).reduce((sum, line) => sum + line.amount, 0);
}
