import { describe, expect, it } from 'vitest';

import { packsToRows, productFromRow, productToRow, type Product, type ProductRow } from '@/products/mapping';

const TS = { created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-02T00:00:00.000Z' };

/** A product as the admin app sends it, with the fields that have no column of their own. */
const product: Product = {
  id: 'prod_milk',
  name: 'Cow Milk',
  category: 'Milk',
  productType: 'Milk',
  unit: 'ml',
  price: 30,
  description: 'Fresh cow milk',
  availability: 'Available',
  features: ['Fresh Product'],
  isVisibleToCustomer: true,
  isActive: true,
  // No columns: these ride in details_json.
  availableStock: 100,
  minStockAlert: 10,
  availableDays: [],
  deliveryTimeSlots: ['Morning'],
  variants: [],
  taxApplicable: false,
  isVisibleOfflineCounter: true,
  sku: 'MILK-500',
  packs: [{ id: 'pack_500', label: '500 ml', unit: 'ml', quantity: 500, price: 30, isActive: true }],
  createdAt: TS.created_at,
  updatedAt: TS.updated_at,
};

describe('products: record ↔ rows', () => {
  it('keeps every field the app sent, column-backed or not', () => {
    const row = productToRow(product);
    const packRows = packsToRows(product.id, product.packs);
    const back = productFromRow({ ...row, ...TS } as ProductRow, packRows);
    expect(back).toEqual(product);
  });

  it('puts only the fields without columns in details_json', () => {
    const details = JSON.parse(productToRow(product).details_json) as Record<string, unknown>;
    expect(Object.keys(details).sort()).toEqual([
      'availableDays',
      'availableStock',
      'deliveryTimeSlots',
      'isVisibleOfflineCounter',
      'minStockAlert',
      'sku',
      'taxApplicable',
      'variants',
    ]);
  });

  it('fills in what the admin left out and keeps the pack order', () => {
    const row = productToRow({ id: 'p1', name: '  Curd  ', price: 20.4, createdAt: 'x', updatedAt: 'y' });
    expect(row).toMatchObject({ name: 'Curd', category: '', product_type: 'Milk', price: 20, is_active: 1, is_visible_to_customer: 1 });

    const packs = packsToRows('p1', [
      { id: '', label: '1 L', unit: 'Litre', quantity: 1000, price: 58, discountPrice: 55 },
      { id: 'pack_keep', label: '200 g', unit: 'Gram', quantity: 200, price: 25, isActive: false },
    ]);
    expect(packs[0]!.id).toMatch(/^pack_/); // a new pack gets an id
    expect(packs[0]!.sort_order).toBe(0);
    expect(packs[1]).toMatchObject({ id: 'pack_keep', sort_order: 1, is_active: 0, discount_price: null });
  });
});
