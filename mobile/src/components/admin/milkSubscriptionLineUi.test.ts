import { describe, expect, it } from 'vitest';

import {
  milkLineHasPackComplete,
  packForLabel,
  packSizeOptionsForProduct,
  planPatchForPack,
} from '@/src/components/admin/milkSubscriptionLineUi';
import type { Product } from '@/src/domain/products/entities';

function product(partial: Partial<Product> & Pick<Product, 'name'>): Product {
  return {
    id: partial.id ?? 'p1',
    category: 'Dairy',
    productType: partial.productType ?? 'Milk',
    price: partial.price ?? 30,
    unit: partial.unit ?? 'Packet',
    variants: partial.variants ?? ['500 ml'],
    description: '',
    availableStock: 10,
    availableDays: [],
    deliveryTimeSlots: [],
    availability: 'Available',
    features: [],
    taxApplicable: false,
    isVisibleToCustomer: true,
    isVisibleOfflineCounter: true,
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('milkLineHasPackComplete', () => {
  it('requires product name', () => {
    const catalog = [product({ name: 'Cow Milk' })];
    expect(milkLineHasPackComplete({ productName: '', quantityLabel: '500 ml' }, catalog)).toBe(false);
  });

  it('requires pack when product has variants (milk)', () => {
    const catalog = [product({ name: 'Cow Milk', variants: ['500 ml', '1 Litre'] })];
    expect(milkLineHasPackComplete({ productName: 'Cow Milk', quantityLabel: '' }, catalog)).toBe(false);
    expect(milkLineHasPackComplete({ productName: 'Cow Milk', quantityLabel: '500 ml' }, catalog)).toBe(true);
  });

  it('validates non-milk catalogue products when passed the full product list', () => {
    const catalog = [
      product({ name: 'Cow Milk', productType: 'Milk', variants: ['500 ml'] }),
      product({ name: 'Curd', productType: 'Grocery Product', variants: ['250 ml', '500 ml'] }),
    ];
    expect(milkLineHasPackComplete({ productName: 'Curd', quantityLabel: '' }, catalog)).toBe(false);
    expect(milkLineHasPackComplete({ productName: 'Curd', quantityLabel: '250 ml' }, catalog)).toBe(true);
  });

  it('passes when product is missing from catalog but name is set (legacy rows)', () => {
    expect(milkLineHasPackComplete({ productName: 'Unknown', quantityLabel: '' }, [])).toBe(true);
  });
});

describe('packSizeOptionsForProduct / planPatchForPack', () => {
  const packs = [
    { id: 'pk_1l', label: '1 L', unit: 'ml' as const, quantity: 1000, price: 64, discountPrice: 60, isActive: true },
    { id: 'pk_500', label: '500 ml', unit: 'ml' as const, quantity: 500, price: 34, isActive: true },
    { id: 'pk_2l', label: '2 L', unit: 'ml' as const, quantity: 2000, price: 120, isActive: false },
  ];

  it('lists every active pack, not only the headline size kept in the legacy fields', () => {
    const milk = product({ name: 'Cow Milk', unit: 'ml', variants: ['Custom Size'], customVariantLabel: '500 ml', packs });
    expect(packSizeOptionsForProduct(milk)).toEqual(['500 ml', '1 L']);
    expect(packForLabel(milk, '1 l')?.id).toBe('pk_1l');
    expect(packForLabel(milk, '2 L')).toBeUndefined();
  });

  it('prices the line from the chosen pack', () => {
    const patch = planPatchForPack(packs[0]);
    expect(patch).toMatchObject({ quantityLabel: '1 L', packId: 'pk_1l', originalPrice: 64, discountedPrice: 60, effectiveFinalPrice: 60 });
  });
});
