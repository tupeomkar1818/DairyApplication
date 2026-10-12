import { addOnItemCount } from '@/src/domain/customers/addOns';
import type { Customer } from '@/src/domain/customers/entities';
import type { Offer } from '@/src/domain/offers/entities';
import { offerDiscountsForMonth, orderSavings } from '@/src/domain/offers/offers';

/**
 * How one offer is doing, worked out from the customer records: the one-off orders placed under it, and what it took
 * off bills this month and last month. The discounts go through `offerDiscountsForMonth` with every offer, so they are
 * the same numbers the bills show (an offer that lost to a better one on a day gets nothing for that day).
 */

type StatsCustomer = Pick<Customer, 'id' | 'name' | 'extraOrders' | 'offerClaims' | 'subscriptionPlans' | 'deliveries'>;

export type OfferStats = {
  /** One-off orders placed under the offer, not cancelled. */
  orders: number;
  /** Customers with at least one such order. */
  customers: number;
  /** Packs (price offer) or combos (combo offer) in those orders. */
  items: number;
  /** Price × items of those orders (pending and delivered). */
  sales: number;
  /** What customers saved on those orders against the normal price. */
  savings: number;
  /** Only for offers that come off bills (bill, subscription, or a price offer on regular deliveries). */
  discounts: { thisMonth: string; lastMonth: string; thisMonthAmount: number; lastMonthAmount: number } | null;
  /** Customers who typed the offer's code, newest first. */
  claims: { customerId: string; name: string; claimedAt: string }[];
};

/** "2026-09" → "2026-08". */
export function previousMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m) return yyyyMm;
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** True when the offer comes off monthly bills rather than setting an order's price. */
export function offerTakesOffBills(offer: Pick<Offer, 'kind' | 'includeRegular'>): boolean {
  return offer.kind === 'bill' || offer.kind === 'subscription' || (offer.kind === 'price' && !!offer.includeRegular);
}

export function buildOfferStats(
  offer: Offer,
  customers: readonly StatsCustomer[],
  allOffers: readonly Offer[],
  todayYmd: string,
): OfferStats {
  let orders = 0;
  let items = 0;
  let sales = 0;
  let savings = 0;
  const buyers = new Set<string>();
  const claims: OfferStats['claims'] = [];

  for (const c of customers) {
    for (const order of c.extraOrders ?? []) {
      if (order.offer?.offerId !== offer.id || order.status === 'Cancelled') continue;
      const count = addOnItemCount(order);
      orders += 1;
      items += count;
      sales += Math.max(0, Number(order.price) || 0) * count;
      savings += orderSavings(order);
      buyers.add(c.id);
    }
    const claim = (c.offerClaims ?? []).find((cl) => cl.offerId === offer.id);
    if (claim) claims.push({ customerId: c.id, name: c.name, claimedAt: claim.claimedAt });
  }
  claims.sort((a, b) => String(b.claimedAt).localeCompare(String(a.claimedAt)));

  let discounts: OfferStats['discounts'] = null;
  if (offerTakesOffBills(offer)) {
    const offers = allOffers.some((o) => o.id === offer.id) ? allOffers : [...allOffers, offer];
    const thisMonth = todayYmd.slice(0, 7);
    const lastMonth = previousMonth(thisMonth);
    const given = (month: string) =>
      customers.reduce(
        (sum, c) =>
          sum + offerDiscountsForMonth(c, month, offers).filter((l) => l.offerId === offer.id).reduce((s, l) => s + l.amount, 0),
        0,
      );
    discounts = { thisMonth, lastMonth, thisMonthAmount: given(thisMonth), lastMonthAmount: given(lastMonth) };
  }

  return { orders, customers: buyers.size, items, sales: Math.round(sales), savings, discounts, claims };
}
