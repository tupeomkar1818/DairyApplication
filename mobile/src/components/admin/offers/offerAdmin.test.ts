import { describe, expect, it } from 'vitest';

import {
  copyDraftFromOffer,
  draftFromOffer,
  emptyOfferDraft,
  offerFromDraft,
  packRowFrom,
  refreshListPrices,
} from '@/src/components/admin/offers/offerDraft';
import { buildOfferStats, offerTakesOffBills, previousMonth } from '@/src/components/admin/offers/offerStats';
import { offerDetailRows, offerSummary } from '@/src/components/admin/offers/offerSummary';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { Offer } from '@/src/domain/offers/entities';
import { validateOffer } from '@/src/domain/offers/offerAdmin';
import type { ProductPack } from '@/src/domain/products/entities';

const TS = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
const META = { id: 'offer_new', ...TS };

function offer(overrides: Partial<Offer>): Offer {
  return { id: 'offer_1', kind: 'bill', title: { en: 'Festival offer' }, startYmd: '2026-09-01', ...TS, ...overrides } as Offer;
}

const shrikhandPack: ProductPack = { id: 'pack_sh', label: '500 g', unit: 'Gram', quantity: 500, price: 200, discountPrice: 180 };
const gheePack: ProductPack = { id: 'pack_gh', label: '1 kg', unit: 'Gram', quantity: 1000, price: 670 };

describe('offer form draft', () => {
  it('builds a price offer from what was typed, at the normal price of the pack', () => {
    const draft = {
      ...emptyOfferDraft('2026-09-10'),
      titleEn: ' Shrikhand week ',
      code: ' diwali 50 ',
      priceRows: [{ ...packRowFrom({ id: 'prod_sh', name: 'Shrikhand' }, shrikhandPack), offerPrice: '160' }],
    };
    const built = offerFromDraft(draft, META);
    expect(built).toMatchObject({
      kind: 'price',
      title: { en: 'Shrikhand week' },
      code: 'DIWALI50',
      startYmd: '2026-09-10',
      priceItems: [{ packId: 'pack_sh', listPrice: 180, offerPrice: 160 }],
    });
    expect(built.endYmd).toBeUndefined();
    expect(built.includeRegular).toBeUndefined();
    expect(validateOffer(built, '2026-09-10')).toEqual([]);
  });

  it('reports an empty price or discount instead of saving ₹0', () => {
    const price = offerFromDraft(
      { ...emptyOfferDraft('2026-09-10'), titleEn: 'x', priceRows: [packRowFrom({ id: 'p', name: 'P' }, gheePack)] },
      META,
    );
    expect(validateOffer(price, '2026-09-10')).toContain('offerPriceInvalid');
    const bill = offerFromDraft({ ...emptyOfferDraft('2026-09-10', 'bill'), titleEn: 'x' }, META);
    expect(validateOffer(bill, '2026-09-10')).toEqual(['discountInvalid']);
  });

  it('keeps only the chosen kind’s fields and round-trips a saved offer', () => {
    const saved = offer({
      kind: 'subscription',
      title: { en: 'Loyal', mr: 'निष्ठावान' },
      endYmd: '2026-09-30',
      discount: { type: 'percent', value: 5, maxDiscount: 100 },
      rewardProducts: [{ productId: 'prod_milk', productName: 'Cow Milk' }],
      minPacksPerDay: 2,
    });
    const draft = { ...draftFromOffer(saved), priceRows: [packRowFrom({ id: 'p', name: 'P' }, gheePack)] };
    expect(offerFromDraft(draft, saved)).toEqual(saved);
  });

  it('copies an offer with dates starting today and running until ended', () => {
    const copy = copyDraftFromOffer(offer({ startYmd: '2026-08-01', endYmd: '2026-08-15', discount: { type: 'flat', value: 50 } }), '2026-09-17');
    expect(copy).toMatchObject({ startYmd: '2026-09-17', endYmd: '', discountType: 'flat', discountValue: '50' });
  });

  it('refreshes normal prices from the catalog', () => {
    const rows = [{ ...packRowFrom({ id: 'prod_gh', name: 'Ghee' }, gheePack), listPrice: 600 }];
    const products = [{ id: 'prod_gh', name: 'Ghee', packs: [gheePack] }] as never;
    expect(refreshListPrices(rows, products)[0]!.listPrice).toBe(670);
  });
});

describe('offer summary', () => {
  it('says what each kind gives in one line', () => {
    const price = offer({
      kind: 'price',
      priceItems: [
        { productId: 'a', packId: 'a1', productName: 'Shrikhand', packLabel: '500 g', listPrice: 180, offerPrice: 160 },
        { productId: 'b', packId: 'b1', productName: 'Ghee', packLabel: '1 kg', listPrice: 670, offerPrice: 640 },
      ],
    });
    expect(offerSummary(price, 'en')).toBe('Shrikhand 500 g ₹180 → ₹160 +1 more');
    const combo = offer({
      kind: 'combo',
      comboPrice: 699,
      comboItems: [
        { productId: 'a', packId: 'a1', productName: 'Shrikhand', packLabel: '500 g', listPrice: 180, quantity: 1 },
        { productId: 'b', packId: 'b1', productName: 'Ghee', packLabel: '1 kg', listPrice: 670, quantity: 1 },
      ],
    });
    expect(offerSummary(combo, 'en')).toBe('Combo ₹699 (worth ₹850)');
    expect(offerSummary(offer({ discount: { type: 'percent', value: 10, maxDiscount: 100 } }), 'en')).toBe('10% off, up to ₹100');
    expect(offerSummary(offer({ kind: 'subscription', discount: { type: 'flat', value: 2 } }), 'en')).toBe('₹2 off per pack');
    expect(offerSummary(offer({ discount: { type: 'flat', value: 50 } }), 'mr')).toBe('₹50 सूट');
  });

  it('lists the details of a subscription reward', () => {
    const rows = offerDetailRows(offer({ kind: 'subscription', discount: { type: 'percent', value: 5 }, minPacksPerDay: 2 }), 'en');
    expect(rows).toEqual([
      { label: 'Reward', value: '5% off' },
      { label: 'Products', value: 'All products' },
      { label: 'Minimum packs a day', value: '2' },
    ]);
  });
});

describe('offer stats', () => {
  type ExtraOrder = NonNullable<CustomerResponse['extraOrders']>[number];
  const snapshot = { offerId: 'sale', kind: 'price' as const, title: { en: 'Sale' }, listPrice: 180 };
  const order = (id: string, status: ExtraOrder['status'], items: number, extra: Partial<ExtraOrder> = {}): ExtraOrder =>
    ({
      id,
      orderDate: '2026-09-10',
      deliveryDate: '2026-09-10',
      productName: 'Shrikhand',
      quantityLabel: '500 g',
      numberOfItems: items,
      price: 160,
      status,
      offer: snapshot,
      ...TS,
      ...extra,
    }) as ExtraOrder;
  const person = (id: string, extraOrders: ExtraOrder[], more: Partial<CustomerResponse> = {}) =>
    ({ id, name: id.toUpperCase(), extraOrders, subscriptionPlans: [], deliveries: [], ...more }) as unknown as CustomerResponse;

  it('counts orders under the offer, leaving out cancelled ones and other offers', () => {
    const sale = offer({ id: 'sale', kind: 'price' });
    const customers = [
      person('a', [order('1', 'Delivered', 2), order('2', 'Cancelled', 5)]),
      person('b', [order('3', 'Pending', 1), order('4', 'Delivered', 1, { offer: { ...snapshot, offerId: 'other' } })], {
        offerClaims: [{ offerId: 'sale', code: 'SALE', claimedAt: '2026-09-05T10:00:00.000Z' }],
      }),
    ];
    const stats = buildOfferStats(sale, customers, [sale], '2026-09-17');
    expect(stats).toMatchObject({ orders: 2, customers: 2, items: 3, sales: 480, savings: 60, discounts: null });
    expect(stats.claims).toEqual([{ customerId: 'b', name: 'B', claimedAt: '2026-09-05T10:00:00.000Z' }]);
  });

  it('adds up what a bill offer took off this month and last month', () => {
    const bill = offer({ id: 'bill', kind: 'bill', startYmd: '2026-08-01', discount: { type: 'flat', value: 50 } });
    const plain = { offer: undefined, price: 300 };
    const customers = [
      person('a', [
        order('1', 'Delivered', 1, { ...plain, orderDate: '2026-08-20', deliveryDate: '2026-08-20' }),
        order('2', 'Delivered', 1, plain),
      ]),
    ];
    const stats = buildOfferStats(bill, customers, [bill], '2026-09-17');
    expect(stats.discounts).toEqual({ thisMonth: '2026-09', lastMonth: '2026-08', thisMonthAmount: 50, lastMonthAmount: 50 });
    expect(offerTakesOffBills(offer({ kind: 'price', includeRegular: true }))).toBe(true);
    expect(previousMonth('2026-01')).toBe('2025-12');
  });
});
