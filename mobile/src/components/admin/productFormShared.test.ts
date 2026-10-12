import { describe, expect, it } from 'vitest';

import {
  emptyProductForm,
  parseCreateProductRequest,
  parseUpdateProductRequest,
  productFormFieldErrors,
  productFormFromResponse,
  toggleInOrder,
  WEEK_DAYS,
} from '@/src/components/admin/productFormShared';
import { persistableImageUriFromAsset } from '@/src/components/dashboard/persistablePickedImage';
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

const cowMilk = product({ name: 'Cow Milk', unit: 'Litre', variants: ['500 ml', '1 Litre'], price: 56, discountPrice: 52 });

describe('productFormFromResponse', () => {
  it('reads size from variants[0] and converts Litre products to ml', () => {
    const { form, customQuantity } = productFormFromResponse(cowMilk);
    expect(form.unit).toBe('ml');
    expect(form.unitQuantity).toBe('500');
    expect(customQuantity).toBe(false);
  });

  it('treats a bare Litre product as 1000 ml', () => {
    const { form } = productFormFromResponse(product({ name: 'Buffalo Milk', unit: 'Litre', variants: [] }));
    expect(form.unit).toBe('ml');
    expect(form.unitQuantity).toBe('1000');
  });

  it('converts Kg custom labels to grams', () => {
    const { form, customQuantity } = productFormFromResponse(
      product({ name: 'Sugar', unit: 'Kg', variants: ['Custom Size'], customVariantLabel: '2 Kg' }),
    );
    expect(form.unit).toBe('Gram');
    expect(form.unitQuantity).toBe('2000');
    expect(customQuantity).toBe(true);
  });

  it('loads every Product Details field into the form', () => {
    const paneer = product({
      name: 'Paneer',
      productType: 'Milk Product',
      category: 'Paneer',
      price: 90,
      discountPrice: 85,
      taxApplicable: true,
      taxPercentage: '5%',
      sku: 'AD-PAN-200G',
      availability: 'Seasonal Product',
      availableDays: ['Friday', 'Monday'],
      deliveryTimeSlots: ['Evening', 'Morning'],
      features: ['Organic', 'Fresh Product'],
      description: 'Soft paneer',
      isActive: false,
    });
    const { form } = productFormFromResponse(paneer);
    expect(form).toMatchObject({
      productType: 'Milk Product',
      category: 'Paneer',
      discountPrice: '85',
      taxApplicable: true,
      taxPercentage: '5%',
      sku: 'AD-PAN-200G',
      availability: 'Seasonal Product',
      availableDays: ['Monday', 'Friday'],
      deliveryTimeSlots: ['Morning', 'Evening'],
      features: ['Fresh Product', 'Organic'],
      description: 'Soft paneer',
      isActive: false,
    });
  });

  it('leaves category blank when it just repeats the product type', () => {
    expect(productFormFromResponse(cowMilk).form.category).toBe('');
  });

  it('round-trips a product created by the add form', () => {
    const created = parseCreateProductRequest({
      ...emptyProductForm(),
      name: 'Toned Milk',
      price: '30',
      discountPrice: '28',
      unit: 'ml',
      unitQuantity: '150',
      availableForOffline: false,
      features: ['Fresh Product'],
      description: 'Daily toned milk',
    });
    expect(created.success).toBe(true);
    if (!created.success) return;
    expect(created.data).toMatchObject({ category: 'Milk', productType: 'Milk', discountPrice: 28, availableStock: 0 });
    const { form, customQuantity } = productFormFromResponse(product({ ...created.data, id: 'p9' }));
    expect(form).toMatchObject({
      name: 'Toned Milk',
      price: '30',
      discountPrice: '28',
      unit: 'ml',
      unitQuantity: '150',
      availableForOffline: false,
      features: ['Fresh Product'],
      description: 'Daily toned milk',
    });
    expect(customQuantity).toBe(false);
  });
});

describe('parseUpdateProductRequest', () => {
  it('keeps unit / variants / label when only the price changes', () => {
    const seed = productFormFromResponse(cowMilk).form;
    const res = parseUpdateProductRequest(cowMilk, seed, { ...seed, price: '60' });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.price).toBe(60);
    expect(res.data).not.toHaveProperty('unit');
    expect(res.data).not.toHaveProperty('variants');
    expect(res.data).not.toHaveProperty('customVariantLabel');
    expect(res.data.discountPrice).toBe(52);
  });

  it('keeps a Bottle product with an ml custom label untouched', () => {
    const ghee = product({ name: 'Ghee', unit: 'Bottle', variants: ['Custom Size'], customVariantLabel: '500 ml', price: 620 });
    const seed = productFormFromResponse(ghee).form;
    const res = parseUpdateProductRequest(ghee, seed, { ...seed, name: 'Pure Ghee' });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).not.toHaveProperty('unit');
    expect(res.data).not.toHaveProperty('customVariantLabel');
  });

  it('sends a new size label when the quantity changes', () => {
    const seed = productFormFromResponse(cowMilk).form;
    const res = parseUpdateProductRequest(cowMilk, seed, { ...seed, unitQuantity: '250' });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toMatchObject({ unit: 'ml', variants: ['Custom Size'], customVariantLabel: '250 ml' });
  });

  it('keeps an inactive product inactive unless the status is switched on', () => {
    const inactive = product({ name: 'Cheese', unit: 'Packet', isActive: false });
    const seed = productFormFromResponse(inactive).form;
    const res = parseUpdateProductRequest(inactive, seed, { ...seed, price: '99' });
    expect(res.success && res.data.isActive).toBe(false);
    const reactivated = parseUpdateProductRequest(inactive, seed, { ...seed, isActive: true });
    expect(reactivated.success && reactivated.data.isActive).toBe(true);
  });

  it('never sends stock (not tracked in this ERP)', () => {
    const seed = productFormFromResponse(cowMilk).form;
    const res = parseUpdateProductRequest(cowMilk, seed, { ...seed, name: 'Cow Milk A2' });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).not.toHaveProperty('availableStock');
    expect(res.data).not.toHaveProperty('minStockAlert');
  });

  it('sends a cleared discount as 0 and rejects a discount above the price', () => {
    const seed = productFormFromResponse(cowMilk).form;
    const cleared = parseUpdateProductRequest(cowMilk, seed, { ...seed, discountPrice: '' });
    expect(cleared.success && cleared.data.discountPrice).toBe(0);
    const tooHigh = parseUpdateProductRequest(cowMilk, seed, { ...seed, price: '50' });
    expect(tooHigh).toEqual({ success: false, message: 'Discount price cannot be higher than price' });
  });

  it('sends the edited details fields', () => {
    const seed = productFormFromResponse(cowMilk).form;
    const res = parseUpdateProductRequest(cowMilk, seed, {
      ...seed,
      productType: 'Milk Product',
      category: 'Dairy',
      availability: 'Seasonal Product',
      availableDays: ['Saturday', 'Sunday'],
      deliveryTimeSlots: ['Evening'],
      taxApplicable: true,
      taxPercentage: '12%',
      sku: 'AD-COW-2',
      features: ['Organic'],
      description: 'Farm fresh',
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toMatchObject({
      productType: 'Milk Product',
      category: 'Dairy',
      availability: 'Seasonal Product',
      availableDays: ['Saturday', 'Sunday'],
      deliveryTimeSlots: ['Evening'],
      taxApplicable: true,
      taxPercentage: '12%',
      sku: 'AD-COW-2',
      features: ['Organic'],
      description: 'Farm fresh',
    });
  });

  it('rejects a blank price and a whitespace-only name', () => {
    const seed = productFormFromResponse(cowMilk).form;
    const blankPrice = parseUpdateProductRequest(cowMilk, seed, { ...seed, price: '', discountPrice: '' });
    expect(blankPrice).toEqual({ success: false, message: 'Price is required' });
    const blankName = parseUpdateProductRequest(cowMilk, seed, { ...seed, name: '   ' });
    expect(blankName).toEqual({ success: false, message: 'Product name is required' });
  });

  it('trims the product name', () => {
    const seed = productFormFromResponse(cowMilk).form;
    const res = parseUpdateProductRequest(cowMilk, seed, { ...seed, name: '  Cow Milk A2  ' });
    expect(res.success && res.data.name).toBe('Cow Milk A2');
  });
});

describe('parseCreateProductRequest', () => {
  it('reports a missing price instead of saving 0', () => {
    const res = parseCreateProductRequest({ ...emptyProductForm(), name: 'Curd', price: '', unitQuantity: '250' });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.issues[0]?.message).toBe('Price is required');
  });

  it('drops the tax percentage when tax is not applicable', () => {
    const res = parseCreateProductRequest({ ...emptyProductForm(), name: 'Lassi', price: '25', taxPercentage: '5%' });
    expect(res.success && res.data.taxPercentage).toBeUndefined();
  });
});

describe('productFormFieldErrors', () => {
  it('maps each problem to its form field', () => {
    const errors = productFormFieldErrors({
      ...emptyProductForm(),
      name: '',
      price: '40',
      discountPrice: '45',
      taxApplicable: true,
      taxPercentage: '',
      availableDays: [],
      deliveryTimeSlots: [],
      sku: 'X',
    });
    expect(errors).toMatchObject({
      name: 'Product name is required',
      discountPrice: 'Discount price cannot be higher than price',
      taxPercentage: 'Select tax percentage',
      availableDays: 'Select at least one available day',
      deliveryTimeSlots: 'Select at least one delivery slot',
      sku: 'SKU must be at least 2 characters',
    });
  });

  it('is empty for a valid form', () => {
    expect(productFormFieldErrors({ ...emptyProductForm(), name: 'Curd', price: '40' })).toEqual({});
  });
});

describe('toggleInOrder', () => {
  it('adds and removes while keeping week order', () => {
    expect(toggleInOrder(['Friday', 'Monday'], 'Wednesday', WEEK_DAYS)).toEqual(['Monday', 'Wednesday', 'Friday']);
    expect(toggleInOrder(['Monday', 'Wednesday'], 'Monday', WEEK_DAYS)).toEqual(['Wednesday']);
  });
});

describe('persistableImageUriFromAsset', () => {
  it('builds a data: URI on web instead of keeping the blob: URL', () => {
    const res = persistableImageUriFromAsset({ uri: 'blob:http://x/1', base64: 'AAAA', mimeType: 'image/png' }, 'web');
    expect(res).toEqual({ ok: true, uri: 'data:image/png;base64,AAAA' });
  });

  it('rejects oversized images on web', () => {
    const res = persistableImageUriFromAsset({ uri: 'blob:http://x/1', base64: 'A'.repeat(4000), mimeType: 'image/jpeg' }, 'web', 1000);
    expect(res.ok).toBe(false);
  });

  it('keeps the native file uri', () => {
    const res = persistableImageUriFromAsset({ uri: 'file:///a.jpg', base64: null, mimeType: 'image/jpeg' }, 'ios');
    expect(res).toEqual({ ok: true, uri: 'file:///a.jpg' });
  });
});
