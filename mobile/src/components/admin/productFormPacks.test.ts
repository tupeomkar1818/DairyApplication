import { describe, expect, it } from 'vitest';

import {
  emptyExtraPack,
  emptyProductForm,
  parseCreateProductRequest,
  parseUpdateProductRequest,
  productFormExtraPackErrors,
  productFormFromResponse,
  type ProductFormState,
} from '@/src/components/admin/productFormShared';
import type { ProductResponse } from '@/src/domain/products/dtos';

function product(partial: Partial<ProductResponse> & Pick<ProductResponse, 'name'>): ProductResponse {
  return {
    id: partial.id ?? 'p1',
    category: 'Milk',
    productType: 'Milk',
    price: 56,
    discountPrice: 0,
    unit: 'Litre',
    variants: [],
    customVariantLabel: '',
    description: '',
    availableStock: 0,
    availableDays: ['Monday'],
    deliveryTimeSlots: ['Morning'],
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

/** A valid new-product form: Taaza Milk, 500 ml at ₹27. */
function taazaForm(overrides: Partial<ProductFormState> = {}): ProductFormState {
  return {
    ...emptyProductForm(),
    name: 'Taaza Milk',
    price: '27',
    unit: 'ml',
    unitQuantity: '500',
    ...overrides,
  };
}

describe('productFormFromResponse — packs', () => {
  it('puts the extra sizes of a single-price product in rows flagged for pricing', () => {
    const { form } = productFormFromResponse(
      product({ name: 'Cow Milk', variants: ['500 ml', '1 Litre'], price: 56, discountPrice: 52 }),
    );

    expect(form.firstPackLabel).toBe('500 ml');
    expect(form.extraPacks).toEqual([
      expect.objectContaining({ label: '1 Litre', price: '56', discountPrice: '52', isActive: true, needsPricing: true }),
    ]);
  });

  it('reads stored packs with their own prices, keeping the headline pack first', () => {
    const { form } = productFormFromResponse(
      product({
        name: 'Taaza Milk',
        unit: 'ml',
        price: 27,
        variants: ['Custom Size'],
        customVariantLabel: '500 ml',
        packs: [
          { id: 'pk_big', label: '1 L - Pouch', unit: 'ml', quantity: 1000, price: 59 },
          { id: 'pk_small', label: '500 ml', unit: 'ml', quantity: 500, price: 27 },
        ],
      }),
    );

    expect([form.firstPackId, form.firstPackLabel, form.price]).toEqual(['pk_small', '500 ml', '27']);
    expect(form.extraPacks).toEqual([
      expect.objectContaining({ id: 'pk_big', label: '1 L - Pouch', price: '59', needsPricing: undefined }),
    ]);
  });

  it('has no extra rows for a plain single-size product', () => {
    const { form } = productFormFromResponse(product({ name: 'Ghee', variants: ['Custom Size'], customVariantLabel: '500 ml' }));
    expect(form.extraPacks).toEqual([]);
  });
});

describe('parseCreateProductRequest — packs', () => {
  it('sends every pack with its own size and price', () => {
    const res = parseCreateProductRequest(
      taazaForm({
        extraPacks: [{ ...emptyExtraPack(), label: '1 L - Pouch', price: '59', discountPrice: '55' }],
      }),
    );

    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.packs?.map((p) => [p.label, p.quantity, p.unit, p.price, p.discountPrice])).toEqual([
      ['500 ml', 500, 'ml', 27, undefined],
      ['1 L - Pouch', 1000, 'ml', 59, 55],
    ]);
  });

  it('sends a single pack when there are no extra rows', () => {
    const res = parseCreateProductRequest(taazaForm());
    expect(res.success && res.data.packs?.map((p) => p.label)).toEqual(['500 ml']);
  });
});

describe('productFormExtraPackErrors', () => {
  it('names the row with a missing price', () => {
    const { rows } = productFormExtraPackErrors(
      taazaForm({ extraPacks: [{ ...emptyExtraPack(), label: '1 L', price: '' }] }),
    );
    expect(rows[0]?.price).toBeTruthy();
  });

  it('names the row whose size is missing', () => {
    const { rows } = productFormExtraPackErrors(taazaForm({ extraPacks: [{ ...emptyExtraPack(), price: '59' }] }));
    expect(rows[0]?.label).toBe('Enter the pack size, e.g. 500 ml');
  });

  it('catches a size listed twice', () => {
    const { rows } = productFormExtraPackErrors(
      taazaForm({ extraPacks: [{ ...emptyExtraPack(), label: '500 ml', price: '30' }] }),
    );
    expect(rows[0]?.label).toBe('"500 ml" is listed twice');
  });

  it('catches a discount above the price on a row', () => {
    const { rows } = productFormExtraPackErrors(
      taazaForm({ extraPacks: [{ ...emptyExtraPack(), label: '1 L', price: '59', discountPrice: '70' }] }),
    );
    expect(rows[0]?.discountPrice).toBe('Discount price cannot be higher than price');
  });

  it('does not repeat the first pack problems on the rows', () => {
    const { rows } = productFormExtraPackErrors(
      taazaForm({ price: '', extraPacks: [{ ...emptyExtraPack(), label: '1 L', price: '59' }] }),
    );
    expect(rows).toEqual({});
  });

  it('is empty for a valid form', () => {
    expect(
      productFormExtraPackErrors(taazaForm({ extraPacks: [{ ...emptyExtraPack(), label: '1 L', price: '59' }] })),
    ).toEqual({ rows: {} });
  });
});

describe('parseUpdateProductRequest — packs', () => {
  it('keeps the first pack own name while its size is unchanged', () => {
    const stored = product({
      name: 'Taaza Milk',
      unit: 'ml',
      price: 59,
      variants: ['Custom Size'],
      customVariantLabel: '1 L - Pouch',
      packs: [{ id: 'pk_big', label: '1 L - Pouch', unit: 'ml', quantity: 1000, price: 59 }],
    });
    const { form: seed } = productFormFromResponse(stored);
    const edited = { ...seed, price: '61' };

    const res = parseUpdateProductRequest(stored, seed, edited);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.packs?.[0]).toMatchObject({ id: 'pk_big', label: '1 L - Pouch', price: 61 });
  });

  it('removing a row removes that pack', () => {
    const stored = product({
      name: 'Taaza Milk',
      unit: 'ml',
      price: 27,
      variants: ['Custom Size'],
      customVariantLabel: '500 ml',
      packs: [
        { id: 'pk_small', label: '500 ml', unit: 'ml', quantity: 500, price: 27 },
        { id: 'pk_big', label: '1 L', unit: 'ml', quantity: 1000, price: 59 },
      ],
    });
    const { form: seed } = productFormFromResponse(stored);

    const res = parseUpdateProductRequest(stored, seed, { ...seed, extraPacks: [] });
    expect(res.success && res.data.packs?.map((p) => p.id)).toEqual(['pk_small']);
  });
});
