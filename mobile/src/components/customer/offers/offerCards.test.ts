import { describe, expect, it } from 'vitest';

import {
  billOfferLines,
  comboPricing,
  findPendingOfferOrder,
  offerHeadline,
  offerOrderDays,
  offerRuleLines,
  offersToAnnounce,
  priceOfferRows,
} from '@/src/components/customer/offers/offerCards';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { Offer } from '@/src/domain/offers/entities';
import type { ProductResponse } from '@/src/domain/products/dtos';

const TS = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };

type ExtraOrder = NonNullable<CustomerResponse['extraOrders']>[number];

function customer(overrides: Partial<CustomerResponse> = {}): CustomerResponse {
  return {
    id: 'cust_1',
    name: 'Asha',
    status: 'Active',
    subscriptionPlans: [],
    extraOrders: [],
    subscriptionExceptions: [],
    deliveries: [],
    payments: [],
    ...TS,
    ...overrides,
  } as unknown as CustomerResponse;
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

describe('offer card wording', () => {
  it('shows the title in the reader language, the kind, the last day and the code', () => {
    const head = offerHeadline(offer({ endYmd: '2026-09-30', code: 'diwali50' }), 'en');
    expect(head).toMatchObject({ title: 'Festival offer', kindName: 'Bill discount', validity: 'Valid till 30 Sep', code: 'DIWALI50' });
    const mr = offerHeadline(offer({}), 'mr');
    expect(mr.title).toBe('सण ऑफर');
    expect(mr.code).toBeNull();
    expect(offerHeadline(offer({}), 'en').validity).toBe('Until the dairy ends it');
  });

  it('explains a bill discount', () => {
    expect(offerRuleLines(offer({ discount: { type: 'percent', value: 10, maxDiscount: 100 } }), 'en')).toEqual([
      '10% off your bill, up to ₹100',
    ]);
    expect(offerRuleLines(offer({ discount: { type: 'flat', value: 50 } }), 'en')).toEqual(['₹50 off your bill']);
  });

  it('explains a subscription reward with its pack and product rules', () => {
    const reward = offer({
      kind: 'subscription',
      discount: { type: 'flat', value: 2 },
      minPacksPerDay: 2,
      rewardProducts: [{ productId: 'p1', productName: 'Cow Milk' }],
    });
    expect(offerRuleLines(reward, 'en')).toEqual(['₹2 off per pack on regular deliveries', 'On days with 2+ packs', 'On Cow Milk']);
    expect(offerRuleLines(offer({ kind: 'subscription', discount: { type: 'percent', value: 5 } }), 'en')).toEqual([
      '5% off your regular deliveries',
      'All products',
    ]);
    expect(offerRuleLines(offer({ kind: 'price' }), 'en')).toEqual([]);
  });

  it('prices a combo against its packs', () => {
    const combo = offer({
      kind: 'combo',
      comboPrice: 699,
      comboItems: [
        { productId: 'a', packId: 'pa', productName: 'Ghee', packLabel: '500 ml', quantity: 1, listPrice: 450 },
        { productId: 'b', packId: 'pb', productName: 'Paneer', packLabel: '200 g', quantity: 2, listPrice: 200 },
      ],
    });
    expect(comboPricing(combo)).toEqual({ price: 699, worth: 850, save: 151 });
  });
});

describe('price offer packs', () => {
  const sale = offer({
    kind: 'price',
    priceItems: [
      { productId: 'prod_sh', packId: 'pack_sh', productName: 'Shrikhand', packLabel: '500 g', listPrice: 180, offerPrice: 160 },
      { productId: 'prod_x', packId: 'pack_gone', productName: 'Basundi', packLabel: '250 g', listPrice: 90, offerPrice: 80 },
    ],
  });

  it('finds the catalog pack to order, and none for a pack no longer on sale', () => {
    const products = [
      { id: 'prod_sh', name: 'Shrikhand', packs: [{ id: 'pack_sh', label: '500 g', unit: 'Gram', quantity: 500, price: 180 }] },
      { id: 'prod_x', name: 'Basundi', packs: [{ id: 'pack_gone', label: '250 g', unit: 'Gram', quantity: 250, price: 90, isActive: false }] },
    ] as unknown as ProductResponse[];
    const rows = priceOfferRows(sale, products);
    expect(rows.map((r) => [r.item.packId, r.save, r.pack?.id ?? null])).toEqual([
      ['pack_sh', 20, 'pack_sh'],
      ['pack_gone', 10, null],
    ]);
  });
});

describe('days an offer can be ordered for', () => {
  it('starts at the first open day, skips delivered days and stops at the offer end', () => {
    const c = customer({
      deliveries: [{ id: 'd', deliveryDate: '2026-09-17', status: 'Delivered', ...TS }] as never,
    });
    // 16 Sep, 10 am: tomorrow (17th) is open by the clock but already delivered.
    const days = offerOrderDays(c, offer({ startYmd: '2026-09-01', endYmd: '2026-09-20' }), new Date(2026, 8, 16, 10, 0));
    expect(days).toEqual(['2026-09-18', '2026-09-19', '2026-09-20']);
  });

  it('waits for an offer that starts later, and after the 9 pm cut-off moves a day on', () => {
    expect(offerOrderDays(customer(), offer({ startYmd: '2026-10-01' }), new Date(2026, 8, 16, 10, 0), 2)).toEqual([
      '2026-10-01',
      '2026-10-02',
    ]);
    expect(offerOrderDays(customer(), offer({ startYmd: '2026-09-01' }), new Date(2026, 8, 16, 21, 30), 1)).toEqual(['2026-09-18']);
    expect(offerOrderDays(customer(), offer({ endedAt: '2026-09-10T00:00:00Z' }), new Date(2026, 8, 16, 10, 0))).toEqual([]);
  });
});

describe('adding to an open order', () => {
  const orders = [
    { id: 'plain', productName: 'Shrikhand', quantityLabel: '500 g', packId: 'pack_sh', deliveryDate: '2026-09-18', status: 'Pending', price: 180 },
    {
      id: 'deal',
      productName: 'Shrikhand',
      quantityLabel: '500 g',
      packId: 'pack_sh',
      deliveryDate: '2026-09-18',
      status: 'Pending',
      price: 160,
      offer: { offerId: 'sale', kind: 'price', title: { en: 'Sale' }, listPrice: 180 },
    },
    {
      id: 'box',
      productName: 'Diwali box',
      quantityLabel: 'Combo',
      deliveryDate: '2026-09-18',
      status: 'Pending',
      price: 699,
      offer: { offerId: 'combo', kind: 'combo', title: { en: 'Diwali box' }, listPrice: 850 },
      comboItems: [{ productName: 'Ghee', packLabel: '500 ml', quantity: 1 }],
    },
  ] as unknown as ExtraOrder[];
  const c = customer({ extraOrders: orders });
  const pack = { packId: 'pack_sh', productName: 'Shrikhand', packLabel: '500 g' };

  it('only joins an order at the same price', () => {
    expect(findPendingOfferOrder(c, '2026-09-18', { offerId: 'sale', ...pack })?.id).toBe('deal');
    expect(findPendingOfferOrder(c, '2026-09-18', { offerId: null, ...pack })?.id).toBe('plain');
    expect(findPendingOfferOrder(c, '2026-09-18', { offerId: 'other', ...pack })).toBeNull();
    expect(findPendingOfferOrder(c, '2026-09-19', { offerId: 'sale', ...pack })).toBeNull();
  });

  it('joins the same combo on the same day', () => {
    expect(findPendingOfferOrder(c, '2026-09-18', { offerId: 'combo', comboOfferId: 'combo' })?.id).toBe('box');
    expect(findPendingOfferOrder(c, '2026-09-18', { offerId: 'sale', comboOfferId: 'sale' })).toBeNull();
  });
});

describe('offer lines on a bill', () => {
  const lines = [
    { offerId: 'a', kind: 'subscription' as const, title: { en: 'A' }, amount: 60 },
    { offerId: 'b', kind: 'bill' as const, title: { en: 'B' }, amount: 30 },
  ];

  it('keeps the lines when the bill took them all off', () => {
    expect(billOfferLines(lines, 90)).toEqual(lines);
  });

  it('shrinks the smallest lines first when the bill capped the discount', () => {
    expect(billOfferLines(lines, 70).map((l) => [l.offerId, l.amount])).toEqual([
      ['a', 60],
      ['b', 10],
    ]);
    expect(billOfferLines(lines, 20).map((l) => [l.offerId, l.amount])).toEqual([['a', 20]]);
    expect(billOfferLines(lines, 0)).toEqual([]);
  });
});

describe('offers to announce', () => {
  it('leaves out offers the customer unlocked with a code', () => {
    expect(offersToAnnounce([offer({ id: 'open' }), offer({ id: 'coded', code: 'X12' })]).map((o) => o.id)).toEqual(['open']);
  });
});
