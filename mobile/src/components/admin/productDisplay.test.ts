import { describe, expect, it, vi } from 'vitest';

// The theme module imports react-native (not parseable under vitest); the helpers only need a few colors.
vi.mock('@/src/theme/dairyTactile', () => ({
  amraleColors: { error: '#E11D48', blue: '#3551A1', textMuted: '#64748B' },
}));

import {
  countCustomersUsingProduct,
  productDaysLabel,
  productPackLabel,
  productPackSizes,
  productSpecsLabel,
  productStatus,
} from '@/src/components/admin/productDisplay';
import type { ProductResponse } from '@/src/domain/products/dtos';

function product(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id: 'prod_1',
    name: 'Cow Milk',
    category: 'Dairy',
    productType: 'Milk',
    price: 56,
    discountPrice: 52,
    unit: 'Litre',
    variants: ['500 ml', '1 Litre'],
    description: '',
    availableStock: 0,
    availableDays: [],
    deliveryTimeSlots: ['Morning'],
    availability: 'Available',
    features: [],
    taxApplicable: false,
    isVisibleToCustomer: true,
    isVisibleOfflineCounter: true,
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('productStatus', () => {
  it('prefers the availability flag over the active flag', () => {
    // No out-of-stock state: zero stock still reads as ACTIVE.
    expect(productStatus(product({ availableStock: 0 }))).toEqual({ label: 'ACTIVE', tone: 'blue' });
    expect(productStatus(product({ availability: 'Discontinued' }))).toEqual({ label: 'DISCONTINUED', tone: 'gray' });
    expect(productStatus(product())).toEqual({ label: 'ACTIVE', tone: 'blue' });
    expect(productStatus(product({ isActive: false }))).toEqual({ label: 'INACTIVE', tone: 'gray' });
  });
});

describe('pack labels', () => {
  it('uses the custom label, then the first variant, then 1 × unit', () => {
    expect(productPackLabel(product({ customVariantLabel: '150 ml', variants: ['Custom Size'] }))).toBe('150 ml');
    expect(productPackLabel(product())).toBe('500 ml');
    expect(productPackLabel(product({ variants: [], unit: 'Packet' }))).toBe('1 Packet');
    expect(productSpecsLabel(product())).toBe('500 ml • Milk');
    expect(
      productSpecsLabel(
        product({
          packs: [
            { id: 'pk_1', label: '1 L', unit: 'ml', quantity: 1000, price: 60, isActive: true },
            { id: 'pk_2', label: '150 ml', unit: 'ml', quantity: 150, price: 32, isActive: true },
            { id: 'pk_3', label: '2 L', unit: 'ml', quantity: 2000, price: 110, isActive: false },
          ],
        }),
      ),
    ).toBe('150 ml · 1 L • Milk');
  });

  it('lists every pack size, resolving and de-duplicating Custom Size', () => {
    expect(productPackSizes(product())).toEqual(['500 ml', '1 Litre']);
    expect(productPackSizes(product({ variants: ['Custom Size', '500 ml'], customVariantLabel: '750 ml' }))).toEqual([
      '750 ml',
      '500 ml',
    ]);
    // Custom Size without a label is dropped; falls back to "1 <unit>".
    expect(productPackSizes(product({ variants: ['Custom Size'], unit: 'Box' }))).toEqual(['1 Box']);
    expect(productPackSizes(product({ variants: [], unit: 'Box' }))).toEqual(['1 Box']);
  });
});

describe('productDaysLabel', () => {
  it('summarises delivery days in week order', () => {
    expect(productDaysLabel([])).toBe('Not set');
    expect(productDaysLabel(undefined)).toBe('Not set');
    expect(productDaysLabel(['Sunday', 'Monday', 'Wednesday'])).toBe('Mon, Wed, Sun');
    expect(
      productDaysLabel(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
    ).toBe('Every day');
  });
});

describe('countCustomersUsingProduct', () => {
  it('matches plans and legacy items by trimmed, case-insensitive name, once per customer', () => {
    const customers = [
      { subscriptionPlans: [{ productName: 'Cow Milk' }, { productName: ' cow milk ' }] },
      { subscriptionPlans: [], subscription: [{ productName: 'COW MILK' }] },
      { subscriptionPlans: [{ productName: 'Buffalo Milk' }] },
      {},
    ];
    expect(countCustomersUsingProduct('Cow Milk', customers)).toBe(2);
    expect(countCustomersUsingProduct('Paneer', customers)).toBe(0);
    expect(countCustomersUsingProduct('  ', customers)).toBe(0);
    expect(countCustomersUsingProduct('Cow Milk', undefined)).toBe(0);
  });
});
