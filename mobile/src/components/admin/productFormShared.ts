import type { ProductResponse } from '@/src/domain/products/dtos';
import type { ProductUnit } from '@/src/domain/products/enums';
import { CreateProductRequestSchema, UpdateProductDetailsRequestSchema } from '@/src/domain/products/validations';

export const GRAM_OPTIONS = [250, 500, 750, 1000] as const;
export const ML_OPTIONS = [150, 250, 500, 1000] as const;
export const COUNT_OPTIONS = [1, 2, 5] as const;

export type ProductFormState = {
  name: string;
  imageUrl: string;
  price: string;
  unit: ProductUnit;
  unitQuantity: string;
  availableForOnline: boolean;
  availableForOffline: boolean;
};

export function emptyProductForm(): ProductFormState {
  return {
    name: '',
    imageUrl: '',
    price: '',
    unit: 'ml',
    unitQuantity: '150',
    availableForOnline: true,
    availableForOffline: true,
  };
}

export function quantityOptionsForUnit(unit: ProductUnit): readonly number[] {
  switch (unit) {
    case 'Gram':
      return GRAM_OPTIONS;
    case 'ml':
      return ML_OPTIONS;
    default:
      return COUNT_OPTIONS;
  }
}

export function unitSuffix(unit: ProductUnit): string {
  switch (unit) {
    case 'Gram':
      return 'gram';
    case 'ml':
      return 'ml';
    default:
      return unit;
  }
}

export function chipLabel(unit: ProductUnit, n: number): string {
  if (unit === 'ml') return `${n} ml`;
  if (unit === 'Gram') return `${n} gram`;
  return `${n} ${unitSuffix(unit)}`;
}

export function productFormFromResponse(p: ProductResponse): { form: ProductFormState; customQuantity: boolean } {
  const custom = (p.customVariantLabel ?? '').trim();
  const sizeText = p.variants?.includes('Custom Size') && custom ? custom : '';
  const qtyFromCustom = sizeText ? Number(sizeText.split(' ')[0]) : NaN;

  const unit: ProductUnit = p.unit === 'Litre' ? 'ml' : p.unit === 'Kg' ? 'Gram' : p.unit;
  const allowed = quantityOptionsForUnit(unit);
  const defaultQty = allowed[0] ?? 1;
  const hasCustomQty = Number.isFinite(qtyFromCustom) && qtyFromCustom > 0;
  const customQuantity = hasCustomQty && !allowed.includes(qtyFromCustom as (typeof allowed)[number]);
  const unitQuantity =
    customQuantity && hasCustomQty
      ? String(qtyFromCustom)
      : hasCustomQty && allowed.includes(qtyFromCustom as (typeof allowed)[number])
        ? String(qtyFromCustom)
        : String(defaultQty);

  return {
    form: {
      name: p.name,
      imageUrl: p.imageUri ?? '',
      price: String(p.price),
      unit,
      unitQuantity,
      availableForOnline: p.isVisibleToCustomer,
      availableForOffline: p.isVisibleOfflineCounter,
    },
    customQuantity,
  };
}

export function buildCustomVariantLabel(form: ProductFormState): string {
  const qty = Number(form.unitQuantity);
  return `${qty} ${unitSuffix(form.unit)}`;
}

export function parseCreateProductRequest(form: ProductFormState) {
  const qty = Number(form.unitQuantity);
  const base = UpdateProductDetailsRequestSchema.safeParse({
    name: form.name,
    price: Number(form.price),
    unit: form.unit,
    isActive: true,
  });
  if (!base.success) return base;

  if (!Number.isFinite(qty) || qty <= 0) return CreateProductRequestSchema.safeParse({});

  const imageUri = form.imageUrl.trim();
  const customVariantLabel = buildCustomVariantLabel(form);
  return CreateProductRequestSchema.safeParse({
    name: form.name,
    category: 'Milk',
    productType: 'Milk',
    price: Number(form.price),
    discountPrice: undefined,
    unit: form.unit,
    variants: ['Custom Size'],
    customVariantLabel,
    description: '',
    availableStock: 0,
    minStockAlert: undefined,
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    availability: 'Available',
    deliveryTimeSlots: ['Morning'],
    sku: '',
    imageUri,
    features: [],
    taxApplicable: false,
    taxPercentage: undefined,
    isVisibleToCustomer: form.availableForOnline,
    isVisibleOfflineCounter: form.availableForOffline,
    isActive: true,
  });
}
