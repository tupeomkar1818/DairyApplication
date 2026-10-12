import { describe, expect, it } from 'vitest';

import {
  addOnProducts,
  overlappingSubscription,
  productPriceHint,
  searchProducts,
  subscribableProducts,
} from '@/src/components/customer/productPicking';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { ProductResponse } from '@/src/domain/products/dtos';

const TS = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };

function product(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id: 'prod_milk',
    name: 'Cow Milk',
    category: 'Milk',
    productType: 'Milk',
    price: 56,
    discountPrice: 52,
    unit: 'ml',
    variants: ['Custom Size'],
    customVariantLabel: '500 ml',
    description: '',
    availableStock: 0,
    availableDays: [],
    deliveryTimeSlots: ['Morning'],
    availability: 'Available',
    features: ['Subscription Available'],
    taxApplicable: false,
    isVisibleToCustomer: true,
    isVisibleOfflineCounter: true,
    isActive: true,
    ...TS,
    ...overrides,
  } as ProductResponse;
}

const catalog = [
  product({ id: 'paneer', name: 'Paneer', category: 'Paneer', features: [] }),
  product(),
  product({ id: 'hidden', name: 'Secret Milk', isVisibleToCustomer: false }),
  product({ id: 'off', name: 'Old Milk', isActive: false }),
  product({ id: 'buffalo', name: 'Buffalo Milk', features: ['Fresh Product'] }),
];

describe('subscribableProducts', () => {
  it('offers only products on sale that the dairy marked for subscription', () => {
    expect(subscribableProducts(catalog).map((p) => p.id)).toEqual(['prod_milk']);
  });
});

describe('addOnProducts', () => {
  it('offers every product on sale, subscription ones included, by name', () => {
    expect(addOnProducts(catalog).map((p) => p.name)).toEqual(['Buffalo Milk', 'Cow Milk', 'Paneer']);
  });
});

describe('searchProducts', () => {
  it('matches name or category, ignoring case', () => {
    expect(searchProducts(catalog, 'paneer').map((p) => p.id)).toEqual(['paneer']);
    expect(searchProducts(catalog, 'MILK').length).toBe(4);
    expect(searchProducts(catalog, '  ')).toHaveLength(catalog.length);
  });
});

describe('productPriceHint', () => {
  it('says "from" only when pack prices differ', () => {
    expect(productPriceHint(product())).toBe('₹52');
    expect(
      productPriceHint(
        product({
          packs: [
            { id: 'a', label: '500 ml', unit: 'ml', quantity: 500, price: 27 },
            { id: 'b', label: '1 L', unit: 'ml', quantity: 1000, price: 59 },
          ],
        }),
      ),
    ).toBe('from ₹27');
  });
});

describe('overlappingSubscription', () => {
  const pack = { id: 'pk_500', label: '500 ml' };
  const c = {
    subscriptionPlans: [
      {
        id: 'sub_1',
        productName: 'Cow Milk',
        quantityLabel: '500 ml',
        packId: 'pk_500',
        startDate: '2026-09-15',
        endDate: '2026-09-30',
        status: 'Active',
      },
    ],
  } as Pick<CustomerResponse, 'subscriptionPlans'>;

  it('finds a subscription for the same pack on overlapping days', () => {
    expect(overlappingSubscription(c, { name: 'Cow Milk' }, pack, '2026-09-20', '2026-10-10')?.id).toBe('sub_1');
    expect(overlappingSubscription(c, { name: 'Cow Milk' }, pack, '2026-09-01')?.id).toBe('sub_1');
  });

  it('allows the same pack on days that do not overlap', () => {
    expect(overlappingSubscription(c, { name: 'Cow Milk' }, pack, '2026-10-01')).toBeNull();
    expect(overlappingSubscription(c, { name: 'Cow Milk' }, pack, '2026-09-01', '2026-09-14')).toBeNull();
  });

  it('allows a different pack or product on the same days', () => {
    expect(overlappingSubscription(c, { name: 'Cow Milk' }, { id: 'pk_1l', label: '1 L' }, '2026-09-20')).toBeNull();
    expect(overlappingSubscription(c, { name: 'Curd' }, pack, '2026-09-20')).toBeNull();
  });

  it('treats a subscription without an end as running on', () => {
    const open = {
      subscriptionPlans: [{ ...c.subscriptionPlans![0]!, endDate: undefined, openEnded: true }],
    } as Pick<CustomerResponse, 'subscriptionPlans'>;
    expect(overlappingSubscription(open, { name: 'Cow Milk' }, pack, '2027-05-01')?.id).toBe('sub_1');
  });

  it('ignores a cancelled subscription', () => {
    const cancelled = {
      subscriptionPlans: [{ ...c.subscriptionPlans![0]!, status: 'Inactive' }],
    } as Pick<CustomerResponse, 'subscriptionPlans'>;
    expect(overlappingSubscription(cancelled, { name: 'Cow Milk' }, pack, '2026-09-20')).toBeNull();
  });
});
