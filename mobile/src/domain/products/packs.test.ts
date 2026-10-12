import { describe, expect, it } from 'vitest';

import type { Product, ProductPack } from '@/src/domain/products/entities';
import {
  orderablePacks,
  packDiscountPercent,
  packPrice,
  packUnitRateLabel,
  parsePackQuantity,
  productFromPrice,
  productPacks,
  resolvePack,
} from '@/src/domain/products/packs';

type PackSource = Parameters<typeof productPacks>[0];

function legacy(overrides: Partial<Product> = {}): PackSource {
  return {
    id: 'prod_1',
    unit: 'ml',
    price: 56,
    discountPrice: 52,
    variants: ['Custom Size'],
    customVariantLabel: '500 ml',
    ...overrides,
  } as PackSource;
}

function pack(overrides: Partial<ProductPack> = {}): ProductPack {
  return { id: 'pk_a', label: '500 ml', unit: 'ml', quantity: 500, price: 30, ...overrides };
}

describe('parsePackQuantity', () => {
  it('reads millilitres and litres into ml', () => {
    expect(parsePackQuantity('500 ml', 'ml')).toEqual({ quantity: 500, unit: 'ml' });
    expect(parsePackQuantity('1 L - Pouch', 'ml')).toEqual({ quantity: 1000, unit: 'ml' });
    expect(parsePackQuantity('2 Litre', 'Litre')).toEqual({ quantity: 2000, unit: 'ml' });
  });

  it('reads grams and kilos into grams', () => {
    expect(parsePackQuantity('200 g', 'Gram')).toEqual({ quantity: 200, unit: 'Gram' });
    expect(parsePackQuantity('1.5 kg', 'Kg')).toEqual({ quantity: 1500, unit: 'Gram' });
  });

  it('falls back to the product unit when the label has none', () => {
    expect(parsePackQuantity('2', 'Litre')).toEqual({ quantity: 2000, unit: 'ml' });
    expect(parsePackQuantity('6', 'Piece')).toEqual({ quantity: 6, unit: 'Piece' });
    expect(parsePackQuantity('Family pack', 'Box')).toEqual({ quantity: 1, unit: 'Box' });
  });
});

describe('productPacks', () => {
  it('returns stored packs untouched', () => {
    const stored = [pack(), pack({ id: 'pk_b', label: '1 L', quantity: 1000, price: 59 })];
    expect(productPacks(legacy({ packs: stored }))).toBe(stored);
  });

  it('reads a single-price product as one priced pack', () => {
    const [only, ...rest] = productPacks(legacy());
    expect(rest).toHaveLength(0);
    expect(only).toMatchObject({ label: '500 ml', unit: 'ml', quantity: 500, price: 56, discountPrice: 52 });
    expect(only!.needsPricing).toBe(false);
  });

  it('keeps every listed size of a multi-size product, and flags the ones still to price', () => {
    const packs = productPacks(legacy({ variants: ['500 ml', '1 Litre'], customVariantLabel: undefined }));
    expect(packs.map((p) => [p.label, p.quantity, p.needsPricing])).toEqual([
      ['500 ml', 500, false],
      ['1 Litre', 1000, true],
    ]);
  });

  it('gives each pack a stable id, so orders can point at it', () => {
    const first = productPacks(legacy()).map((p) => p.id);
    const again = productPacks(legacy()).map((p) => p.id);
    expect(first).toEqual(again);
    expect(first[0]).toBe('pk_prod_1_500-ml');
  });

  it('never returns an empty list', () => {
    expect(productPacks(legacy({ variants: [], customVariantLabel: '', unit: 'Packet' }))).toHaveLength(1);
  });
});

describe('orderablePacks', () => {
  it('drops inactive packs and puts the smallest first', () => {
    const packs = orderablePacks(
      legacy({
        packs: [
          pack({ id: 'pk_big', label: '1 L', quantity: 1000 }),
          pack({ id: 'pk_old', label: '2 L', quantity: 2000, isActive: false }),
          pack({ id: 'pk_small', label: '500 ml', quantity: 500 }),
        ],
      }),
    );
    expect(packs.map((p) => p.id)).toEqual(['pk_small', 'pk_big']);
  });
});

describe('packPrice and packDiscountPercent', () => {
  it('uses a real discount only', () => {
    expect(packPrice(pack({ price: 72, discountPrice: 70 }))).toBe(70);
    expect(packPrice(pack({ price: 72, discountPrice: 80 }))).toBe(72);
    expect(packPrice(pack({ price: 72 }))).toBe(72);
  });

  it('rounds the saving to a whole percent', () => {
    expect(packDiscountPercent(pack({ price: 72, discountPrice: 70 }))).toBe(3);
    expect(packDiscountPercent(pack({ price: 72 }))).toBe(0);
  });
});

describe('packUnitRateLabel', () => {
  it('prices volume per litre and weight per kilo', () => {
    expect(packUnitRateLabel(pack({ price: 27, quantity: 500, unit: 'ml' }))).toBe('₹54/L');
    expect(packUnitRateLabel(pack({ price: 90, quantity: 250, unit: 'Gram' }))).toBe('₹360/kg');
  });

  it('says nothing for counted items', () => {
    expect(packUnitRateLabel(pack({ price: 10, quantity: 6, unit: 'Piece' }))).toBe('');
  });
});

describe('resolvePack', () => {
  const product = legacy({
    packs: [pack({ id: 'pk_small', quantity: 500 }), pack({ id: 'pk_big', label: '1 L', quantity: 1000 })],
  });

  it('returns the chosen pack', () => {
    expect(resolvePack(product, 'pk_big')?.id).toBe('pk_big');
  });

  it('falls back to the smallest pack for an unknown id', () => {
    expect(resolvePack(product, 'nope')?.id).toBe('pk_small');
    expect(resolvePack(product)?.id).toBe('pk_small');
  });
});

describe('productFromPrice', () => {
  it('is the cheapest orderable pack', () => {
    const product = legacy({
      packs: [
        pack({ id: 'a', price: 59, quantity: 1000 }),
        pack({ id: 'b', price: 27, quantity: 500 }),
        pack({ id: 'c', price: 5, quantity: 100, isActive: false }),
      ],
    });
    expect(productFromPrice(product)).toBe(27);
  });
});
