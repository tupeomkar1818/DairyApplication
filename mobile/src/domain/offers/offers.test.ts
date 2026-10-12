import { describe, expect, it } from 'vitest';

import { buildBillingTimeline } from '@/src/components/admin/billingTimeline';
import { DayLockedError, OfferNotAvailableError, placeAddOnOrder, placeComboOrder } from '@/src/components/customer/customerActions';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { Offer } from '@/src/domain/offers/entities';
import {
  canDeleteOffer,
  endOfferNow,
  mergeOfferEdit,
  offerPricingLocked,
  validateOffer,
} from '@/src/domain/offers/offerAdmin';
import {
  claimOfferCode,
  comboListTotal,
  liveOffersFor,
  offerDiscountsForMonth,
  OfferCodeError,
  offerSavingsForMonth,
  offerStatus,
  offerText,
  priceOfferForPack,
  publicLiveOffers,
} from '@/src/domain/offers/offers';
import type { ProductResponse } from '@/src/domain/products/dtos';
import type { ProductPack } from '@/src/domain/products/entities';

const TS = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };

type Delivery = NonNullable<CustomerResponse['deliveries']>[number];
type ExtraOrder = NonNullable<CustomerResponse['extraOrders']>[number];

/** Cow Milk 500 ml (pack_milk) at ₹30 a pack, 2 packs a day from 1 Sep. */
function customer(overrides: Partial<CustomerResponse> = {}): CustomerResponse {
  return {
    id: 'cust_1',
    name: 'Asha',
    mobile: '9876543210',
    address: 'A-1',
    societyName: 'Green View',
    deliveryTime: 'Morning',
    paymentType: 'Cash',
    status: 'Active',
    subscription: [],
    subscriptionStartDate: '2026-09-01',
    subscriptionPlans: [
      {
        id: 'sub_milk',
        productName: 'Cow Milk',
        quantityLabel: '500 ml',
        packId: 'pack_milk',
        numberOfItems: 2,
        deliveryTime: 'Morning',
        frequency: 'Daily',
        startDate: '2026-09-01',
        openEnded: true,
        originalPrice: 30,
        status: 'Active',
        ...TS,
      },
    ],
    extraOrders: [],
    subscriptionExceptions: [],
    deliveries: [],
    payments: [],
    monthlyBillAmount: 0,
    nextDeliveryDate: '2026-09-10',
    ...TS,
    ...overrides,
  } as CustomerResponse;
}

function delivered(days: number[], month = '2026-09'): Delivery[] {
  return days.map(
    (d) =>
      ({
        id: `d_${d}`,
        deliveryDate: `${month}-${String(d).padStart(2, '0')}`,
        productName: 'Cow Milk',
        quantityLabel: '500 ml',
        status: 'Delivered',
        ...TS,
      }) as Delivery,
  );
}

function offer(overrides: Partial<Offer>): Offer {
  return {
    id: 'offer_1',
    kind: 'bill',
    title: { en: 'Festival offer', mr: 'सण ऑफर' },
    startYmd: '2026-09-01',
    ...TS,
    ...overrides,
  } as Offer;
}

const shrikhand: ProductResponse = { id: 'prod_sh', name: 'Shrikhand' } as ProductResponse;
const shrikhandPack: ProductPack = { id: 'pack_sh', label: '500 g', unit: 'Gram', quantity: 500, price: 180 };

describe('offer status and visibility', () => {
  it('is scheduled, live, then ended by its dates, and ended at once when the admin ends it', () => {
    const o = offer({ startYmd: '2026-09-10', endYmd: '2026-09-20' });
    expect(offerStatus(o, '2026-09-09')).toBe('scheduled');
    expect(offerStatus(o, '2026-09-10')).toBe('live');
    expect(offerStatus(o, '2026-09-20')).toBe('live');
    expect(offerStatus(o, '2026-09-21')).toBe('ended');
    expect(offerStatus(endOfferNow(o, '2026-09-12'), '2026-09-12')).toBe('ended');
  });

  it('hides code offers until the customer types the code, and never shows them on the website', () => {
    const open = offer({ id: 'open' });
    const coded = offer({ id: 'coded', code: 'DIWALI50' });
    expect(liveOffersFor([open, coded], customer(), '2026-09-05').map((o) => o.id)).toEqual(['open']);
    const claimed = customer({ offerClaims: [{ offerId: 'coded', code: 'DIWALI50', claimedAt: TS.createdAt }] });
    expect(liveOffersFor([open, coded], claimed, '2026-09-05').map((o) => o.id).sort()).toEqual(['coded', 'open']);
    expect(publicLiveOffers([open, coded], '2026-09-05').map((o) => o.id)).toEqual(['open']);
  });

  it('shows Marathi wording when given, English otherwise', () => {
    expect(offerText({ en: 'Diwali box', mr: 'दिवाळी बॉक्स' }, 'mr')).toBe('दिवाळी बॉक्स');
    expect(offerText({ en: 'Diwali box', mr: '  ' }, 'mr')).toBe('Diwali box');
  });
});

describe('offer codes', () => {
  const coded = offer({ id: 'coded', code: 'DIWALI50', endYmd: '2026-09-30' });

  it('accepts a code without case or spaces', () => {
    const { offerClaims, offer: o } = claimOfferCode(customer(), [coded], ' diwali 50 ', '2026-09-05', 'now');
    expect(o.id).toBe('coded');
    expect(offerClaims).toEqual([{ offerId: 'coded', code: 'DIWALI50', claimedAt: 'now' }]);
  });

  it('says why a code does not work', () => {
    const problem = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return (e as OfferCodeError).problem;
      }
      return null;
    };
    expect(problem(() => claimOfferCode(customer(), [coded], '', '2026-09-05'))).toBe('empty');
    expect(problem(() => claimOfferCode(customer(), [coded], 'NOPE', '2026-09-05'))).toBe('unknown');
    expect(problem(() => claimOfferCode(customer(), [coded], 'DIWALI50', '2026-10-01'))).toBe('ended');
    const claimed = customer({ offerClaims: [{ offerId: 'coded', code: 'DIWALI50', claimedAt: 'x' }] });
    expect(problem(() => claimOfferCode(claimed, [coded], 'DIWALI50', '2026-09-05'))).toBe('alreadyApplied');
  });
});

describe('price offers on one-off orders', () => {
  const sale = offer({
    kind: 'price',
    endYmd: '2026-09-15',
    priceItems: [{ productId: 'prod_sh', packId: 'pack_sh', productName: 'Shrikhand', packLabel: '500 g', listPrice: 180, offerPrice: 160 }],
  });
  const now = new Date(2026, 8, 5, 10, 0);

  it('prices an order at the offer price when its delivery day is in the offer, and remembers the offer', () => {
    const { order } = placeAddOnOrder(customer(), {
      product: shrikhand,
      pack: shrikhandPack,
      numberOfItems: 2,
      dateYmd: '2026-09-10',
      now,
      offers: [sale],
    });
    expect(order.price).toBe(160);
    expect(order.offer).toMatchObject({ offerId: 'offer_1', kind: 'price', listPrice: 180 });
  });

  it('keeps the normal price outside the offer dates or after the offer was ended', () => {
    const outside = placeAddOnOrder(customer(), { product: shrikhand, pack: shrikhandPack, numberOfItems: 1, dateYmd: '2026-09-16', now, offers: [sale] });
    expect(outside.order.price).toBe(180);
    expect(outside.order.offer).toBeUndefined();
    const ended = placeAddOnOrder(customer(), {
      product: shrikhand,
      pack: shrikhandPack,
      numberOfItems: 1,
      dateYmd: '2026-09-10',
      now,
      offers: [endOfferNow(sale, '2026-09-05')],
    });
    expect(ended.order.price).toBe(180);
  });

  it('takes the lower price when two offers cover the same pack', () => {
    const better = offer({ ...sale, id: 'offer_2', priceItems: [{ ...sale.priceItems![0]!, offerPrice: 150 }] });
    expect(priceOfferForPack([sale, better], customer(), { packId: 'pack_sh' }, '2026-09-10')?.item.offerPrice).toBe(150);
  });
});

describe('combo orders', () => {
  const combo = offer({
    id: 'combo',
    kind: 'combo',
    title: { en: 'Diwali box', mr: 'दिवाळी बॉक्स' },
    endYmd: '2026-09-30',
    comboItems: [
      { productId: 'p1', packId: 'ghee', productName: 'Ghee', packLabel: '500 ml', quantity: 1, listPrice: 450 },
      { productId: 'p2', packId: 'paneer', productName: 'Paneer', packLabel: '200 g', quantity: 2, listPrice: 100 },
    ],
    comboPrice: 599,
  });
  const now = new Date(2026, 8, 5, 10, 0);

  it('orders a combo as one line at the combo price, with what goes in it', () => {
    expect(comboListTotal(combo)).toBe(650);
    const { order } = placeComboOrder(customer(), { offer: combo, numberOfItems: 2, dateYmd: '2026-09-10', now });
    expect(order).toMatchObject({ productName: 'Diwali box', quantityLabel: 'Combo', price: 599, numberOfItems: 2, status: 'Pending' });
    expect(order.offer).toMatchObject({ offerId: 'combo', kind: 'combo', listPrice: 650 });
    expect(order.comboItems).toEqual([
      { productName: 'Ghee', packLabel: '500 ml', quantity: 1 },
      { productName: 'Paneer', packLabel: '200 g', quantity: 2 },
    ]);
  });

  it('refuses a day outside the combo, an ended combo, a code not typed, and a locked day', () => {
    expect(() => placeComboOrder(customer(), { offer: combo, numberOfItems: 1, dateYmd: '2026-10-01', now })).toThrow(OfferNotAvailableError);
    expect(() => placeComboOrder(customer(), { offer: endOfferNow(combo, '2026-09-05'), numberOfItems: 1, dateYmd: '2026-09-10', now })).toThrow(
      OfferNotAvailableError,
    );
    expect(() => placeComboOrder(customer(), { offer: { ...combo, code: 'BOX' }, numberOfItems: 1, dateYmd: '2026-09-10', now })).toThrow(
      OfferNotAvailableError,
    );
    expect(() => placeComboOrder(customer(), { offer: combo, numberOfItems: 1, dateYmd: '2026-09-05', now })).toThrow(DayLockedError);
  });
});

describe('offer discounts on the monthly bill', () => {
  // 10 days delivered, 2 packs × ₹30 = ₹60 a day, ₹600 in all.
  const base = customer({ deliveries: delivered([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) });

  it('bills regular deliveries at the offer price only when the price offer includes them', () => {
    const priceOffer = offer({
      kind: 'price',
      startYmd: '2026-09-06',
      endYmd: '2026-09-10',
      priceItems: [{ productId: 'p', packId: 'pack_milk', productName: 'Cow Milk', packLabel: '500 ml', listPrice: 30, offerPrice: 27 }],
    });
    expect(offerDiscountsForMonth(base, '2026-09', [priceOffer])).toEqual([]);
    // 5 days × 2 packs × ₹3.
    expect(offerDiscountsForMonth(base, '2026-09', [{ ...priceOffer, includeRegular: true }])).toEqual([
      { offerId: 'offer_1', kind: 'price', title: priceOffer.title, amount: 30 },
    ]);
  });

  it('gives a subscription reward per pack, only on days with enough packs, capped for a percent', () => {
    const perPack = offer({ kind: 'subscription', discount: { type: 'flat', value: 2 }, minPacksPerDay: 2 });
    expect(offerDiscountsForMonth(base, '2026-09', [perPack])[0]?.amount).toBe(40);
    expect(offerDiscountsForMonth(base, '2026-09', [{ ...perPack, minPacksPerDay: 3 }])).toEqual([]);
    const percent = offer({ kind: 'subscription', discount: { type: 'percent', value: 10, maxDiscount: 45 } });
    expect(offerDiscountsForMonth(base, '2026-09', [percent])[0]?.amount).toBe(45);
    const otherProduct = offer({ kind: 'subscription', discount: { type: 'flat', value: 2 }, rewardProducts: [{ productId: 'x', productName: 'Buffalo Milk' }] });
    expect(offerDiscountsForMonth(base, '2026-09', [otherProduct])).toEqual([]);
  });

  it('never stacks two item offers on the same delivery: the bigger one counts', () => {
    const reward = offer({ id: 'reward', kind: 'subscription', discount: { type: 'flat', value: 1 } });
    const bigger = offer({ id: 'bigger', kind: 'subscription', discount: { type: 'flat', value: 2 } });
    expect(offerDiscountsForMonth(base, '2026-09', [reward, bigger]).map((l) => [l.offerId, l.amount])).toEqual([['bigger', 40]]);
  });

  it('takes a bill discount off what was delivered in its dates, after item discounts, once a month for a flat amount', () => {
    const billPercent = offer({ id: 'bill', kind: 'bill', startYmd: '2026-09-01', endYmd: '2026-09-05', discount: { type: 'percent', value: 10 } });
    // Days 1–5: ₹300 → 10%.
    expect(offerDiscountsForMonth(base, '2026-09', [billPercent])[0]?.amount).toBe(30);
    const flat = offer({ id: 'flat', kind: 'bill', discount: { type: 'flat', value: 50 } });
    expect(offerDiscountsForMonth(base, '2026-09', [flat])[0]?.amount).toBe(50);
    // With a ₹1/pack reward first, days 1–5 come to ₹290 → ₹29.
    const reward = offer({ id: 'reward', kind: 'subscription', discount: { type: 'flat', value: 1 } });
    const lines = offerDiscountsForMonth(base, '2026-09', [reward, billPercent]);
    expect(Object.fromEntries(lines.map((l) => [l.offerId, l.amount]))).toEqual({ reward: 20, bill: 29 });
  });

  it('counts delivered one-off orders in a bill discount, but gives them nothing more', () => {
    const order = {
      id: 'x1',
      orderDate: '2026-09-03',
      deliveryDate: '2026-09-03',
      productName: 'Shrikhand',
      quantityLabel: '500 g',
      numberOfItems: 1,
      price: 160,
      offer: { offerId: 'sale', kind: 'price', title: { en: 'Sale' }, listPrice: 180 },
      status: 'Delivered',
      ...TS,
    } as ExtraOrder;
    const withOrder = customer({ deliveries: delivered([3]), extraOrders: [order] });
    const flat = offer({ kind: 'bill', discount: { type: 'percent', value: 50 } });
    // (₹60 milk + ₹160 shrikhand) × 50%.
    expect(offerDiscountsForMonth(withOrder, '2026-09', [flat])[0]?.amount).toBe(110);
    // Savings: ₹20 on the order and ₹110 off the bill.
    expect(offerSavingsForMonth(withOrder, '2026-09', [flat])).toBe(130);
  });

  it('applies code offers only to customers who typed the code', () => {
    const coded = offer({ id: 'coded', kind: 'bill', code: 'SEPT', discount: { type: 'flat', value: 50 } });
    expect(offerDiscountsForMonth(base, '2026-09', [coded])).toEqual([]);
    const claimed = { ...base, offerClaims: [{ offerId: 'coded', code: 'SEPT', claimedAt: 'x' }] };
    expect(offerDiscountsForMonth(claimed, '2026-09', [coded])[0]?.amount).toBe(50);
  });

  it('shows the discount on the bill and keeps it after the offer is ended', () => {
    const flat = offer({ id: 'flat', kind: 'bill', discount: { type: 'flat', value: 50 } });
    const row = buildBillingTimeline(base, '2026-09', { offers: [flat] }).find((r) => r.month === '2026-09')!;
    expect(row.offerDiscount).toBe(50);
    expect(row.baseAmount).toBe(550);
    const afterEnding = buildBillingTimeline(base, '2026-09', { offers: [endOfferNow(flat, '2026-09-10')] }).find((r) => r.month === '2026-09')!;
    expect(afterEnding.baseAmount).toBe(550);
    expect(buildBillingTimeline(base, '2026-09').find((r) => r.month === '2026-09')!.baseAmount).toBe(600);
  });
});

describe('admin rules', () => {
  const today = '2026-09-10';

  it('checks a new offer', () => {
    expect(validateOffer(offer({ title: { en: '' }, startYmd: '2026-09-01', discount: { type: 'percent', value: 120 } }), today)).toEqual([
      'titleRequired',
      'startInPast',
      'percentTooHigh',
    ]);
    const combo = offer({
      kind: 'combo',
      startYmd: today,
      comboItems: [{ productId: 'p', packId: 'a', productName: 'A', packLabel: '1', quantity: 1, listPrice: 100 }],
      comboPrice: 150,
    });
    expect(validateOffer(combo, today)).toEqual(['comboItemsRequired', 'comboPriceInvalid']);
    const taken = offer({ id: 'o2', startYmd: today, code: 'diwali', discount: { type: 'flat', value: 10 } });
    expect(validateOffer(taken, today, { others: [offer({ id: 'o1', code: 'DIWALI' })] })).toEqual(['codeTaken']);
  });

  it('locks prices, code and start once an offer started, and only lets unstarted offers be deleted', () => {
    const started = offer({ discount: { type: 'flat', value: 10 }, code: 'OLD' });
    expect(offerPricingLocked(started, today)).toBe(true);
    expect(canDeleteOffer(started, today)).toBe(false);
    expect(canDeleteOffer(offer({ startYmd: '2026-09-20' }), today)).toBe(true);
    const edited = mergeOfferEdit(
      started,
      { ...started, title: { en: 'New name' }, discount: { type: 'flat', value: 99 }, code: 'NEW', endYmd: '2026-09-30' },
      today,
      'now',
    );
    expect(edited).toMatchObject({ title: { en: 'New name' }, discount: { type: 'flat', value: 10 }, code: 'OLD', endYmd: '2026-09-30' });
    // A started offer's old prices are not re-checked.
    expect(validateOffer(edited, today, { saved: started })).toEqual([]);
  });
});

describe('website offers file', () => {
  it('publishes live and upcoming offers without a code, and nothing ended', async () => {
    const { buildWebsiteOffersFeed } = await import('@/src/domain/offers/websiteFeed');
    const feed = buildWebsiteOffersFeed(
      [
        offer({ id: 'live', kind: 'bill', discount: { type: 'percent', value: 5 }, endYmd: '2026-09-30' }),
        offer({ id: 'soon', kind: 'bill', startYmd: '2026-10-01', discount: { type: 'flat', value: 20 } }),
        offer({ id: 'coded', kind: 'bill', code: 'VIP', discount: { type: 'flat', value: 20 } }),
        offer({ id: 'over', kind: 'bill', endYmd: '2026-09-05', discount: { type: 'flat', value: 20 } }),
        endOfferNow(offer({ id: 'stopped', kind: 'bill', discount: { type: 'flat', value: 20 } }), '2026-09-09'),
      ],
      '2026-09-10',
      'now',
    );
    expect(feed.version).toBe(1);
    expect(feed.offers.map((o) => o.id)).toEqual(['live', 'soon']);
    expect(feed.offers[0]).toEqual({
      id: 'live',
      kind: 'bill',
      title: { en: 'Festival offer', mr: 'सण ऑफर' },
      startYmd: '2026-09-01',
      endYmd: '2026-09-30',
      discount: { type: 'percent', value: 5 },
    });
  });
});
