import { describe, expect, it } from 'vitest';

import { offerFromRow, offerStatus, offerToRow, websiteOffer, type Offer, type OfferRow } from '@/offers/mapping';

const TS = { created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-02T00:00:00.000Z' };

/** A price offer as the admin app sends it, with the kind's own fields that have no column. */
const priceOffer: Offer = {
  id: 'offer_diwali',
  kind: 'price',
  title: { en: 'Diwali week', mr: 'दिवाळी सप्ताह' },
  description: { en: 'Shrikhand at a lower price' },
  startYmd: '2026-11-05',
  endYmd: '2026-11-12',
  code: 'DIWALI50',
  priceItems: [
    { productId: 'prod_shri', packId: 'pack_500', productName: 'Shrikhand', packLabel: '500 g', listPrice: 180, offerPrice: 160 },
  ],
  includeRegular: true,
  createdAt: TS.created_at,
  updatedAt: TS.updated_at,
};

describe('offers: record ↔ row', () => {
  it('keeps every field the app sent, column-backed or not', () => {
    const back = offerFromRow({ ...offerToRow(priceOffer), ...TS } as OfferRow);
    expect(back).toEqual(priceOffer);
  });

  it('round-trips a combo with its own numbers', () => {
    const combo: Offer = {
      id: 'offer_box',
      kind: 'combo',
      title: { en: 'Festival box' },
      startYmd: '2026-11-05',
      comboItems: [
        { productId: 'p1', packId: 'k1', productName: 'Shrikhand', packLabel: '500 g', quantity: 2, listPrice: 180 },
        { productId: 'p2', packId: 'k2', productName: 'Ghee', packLabel: '200 ml', quantity: 1, listPrice: 240 },
      ],
      comboPrice: 499,
      createdAt: TS.created_at,
      updatedAt: TS.updated_at,
    };
    expect(offerFromRow({ ...offerToRow(combo), ...TS } as OfferRow)).toEqual(combo);
  });

  it('stores a code the way it is compared, without case or spaces', () => {
    expect(offerToRow({ ...priceOffer, code: ' diwali 50 ' }).code).toBe('DIWALI50');
  });

  it('leaves no code when the offer applies by itself', () => {
    expect(offerToRow({ ...priceOffer, code: undefined }).code).toBeNull();
    expect(offerFromRow({ ...offerToRow({ ...priceOffer, code: undefined }), ...TS } as OfferRow).code).toBeUndefined();
  });

  it('falls back to English when no Marathi wording was written', () => {
    const row = offerToRow({ ...priceOffer, title: { en: 'Diwali week' } });
    expect(row.title_mr).toBeNull();
    expect(offerFromRow({ ...row, ...TS } as OfferRow).title).toEqual({ en: 'Diwali week' });
  });
});

describe('offers: what is running today', () => {
  const row = (over: Partial<OfferRow>) =>
    ({ start_ymd: '2026-11-05', end_ymd: '2026-11-12', ended_at: null, ...over }) as OfferRow;

  it('is scheduled before its first day', () => {
    expect(offerStatus(row({}), '2026-11-04')).toBe('scheduled');
  });

  it('is live on its first and last day', () => {
    expect(offerStatus(row({}), '2026-11-05')).toBe('live');
    expect(offerStatus(row({}), '2026-11-12')).toBe('live');
  });

  it('is ended after its last day', () => {
    expect(offerStatus(row({}), '2026-11-13')).toBe('ended');
  });

  it('runs on until ended when no last day was set', () => {
    expect(offerStatus(row({ end_ymd: null }), '2027-05-01')).toBe('live');
  });

  it('is ended at once when the dairy ended it', () => {
    expect(offerStatus(row({ ended_at: '2026-11-08T06:00:00.000Z' }), '2026-11-08')).toBe('ended');
  });
});

describe('offers: what the website is given', () => {
  it('shows the packs and their prices', () => {
    const published = websiteOffer(priceOffer);
    expect(published).toMatchObject({
      id: 'offer_diwali',
      kind: 'price',
      title: { en: 'Diwali week', mr: 'दिवाळी सप्ताह' },
      startYmd: '2026-11-05',
      endYmd: '2026-11-12',
      includeRegular: true,
      priceItems: [{ productName: 'Shrikhand', packLabel: '500 g', listPrice: 180, offerPrice: 160 }],
    });
  });

  it('never publishes a code, or the ids behind it', () => {
    const published = websiteOffer(priceOffer);
    expect(published.code).toBeUndefined();
    expect(JSON.stringify(published)).not.toContain('prod_shri');
  });

  it('adds up what a combo would have cost, so the saving can be shown', () => {
    const published = websiteOffer({
      id: 'offer_box',
      kind: 'combo',
      title: { en: 'Festival box' },
      startYmd: '2026-11-05',
      comboItems: [
        { productName: 'Shrikhand', packLabel: '500 g', quantity: 2, listPrice: 180 },
        { productName: 'Ghee', packLabel: '200 ml', quantity: 1, listPrice: 240 },
      ],
      comboPrice: 499,
      createdAt: TS.created_at,
      updatedAt: TS.updated_at,
    });
    expect(published.combo).toEqual({
      items: [
        { productName: 'Shrikhand', packLabel: '500 g', quantity: 2 },
        { productName: 'Ghee', packLabel: '200 ml', quantity: 1 },
      ],
      price: 499,
      listTotal: 600,
    });
  });

  it('shows a bill discount as the rule it is', () => {
    const published = websiteOffer({
      id: 'offer_bill',
      kind: 'bill',
      title: { en: '10% off October' },
      startYmd: '2026-10-01',
      discount: { type: 'percent', value: 10, maxDiscount: 200 },
      createdAt: TS.created_at,
      updatedAt: TS.updated_at,
    });
    expect(published.discount).toEqual({ type: 'percent', value: 10, maxDiscount: 200 });
  });

  it('names the products a subscription reward is for, by name only', () => {
    const published = websiteOffer({
      id: 'offer_sub',
      kind: 'subscription',
      title: { en: '₹2 off every litre' },
      startYmd: '2026-10-01',
      discount: { type: 'flat', value: 2 },
      rewardProducts: [{ productId: 'prod_milk', productName: 'Cow Milk' }],
      minPacksPerDay: 2,
      createdAt: TS.created_at,
      updatedAt: TS.updated_at,
    });
    expect(published).toMatchObject({ rewardProducts: ['Cow Milk'], minPacksPerDay: 2, discount: { type: 'flat', value: 2 } });
  });
});
