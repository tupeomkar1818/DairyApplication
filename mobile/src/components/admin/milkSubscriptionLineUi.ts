import type { CustomerSubscriptionPlanDto } from '@/src/domain/customers/dtos';
import type { DeliveryFrequency, DeliveryTime } from '@/src/domain/customers/enums';
import type { Product } from '@/src/domain/products/entities';

export function isMilkCatalogProduct(p: Product): boolean {
  return p.productType === 'Milk' || p.productType === 'Milk Product';
}

export function packSizeOptionsForProduct(prod: Product | undefined): string[] {
  if (!prod) return [];
  const opts: string[] = [];
  for (const v of prod.variants ?? []) {
    if (typeof v === 'string' && v.trim() && v !== 'Custom Size') opts.push(v.trim());
  }
  if (prod.customVariantLabel?.trim()) opts.push(prod.customVariantLabel.trim());
  return Array.from(new Set(opts));
}

export function defaultPackLabelWhenNoOptions(prod: Product): string {
  return prod.customVariantLabel?.trim() || 'Standard';
}

export function moneyInr(v: number | undefined): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `₹${Math.round(n)}`;
}

export function milkLineHasPackComplete(
  draft: Pick<CustomerSubscriptionPlanDto, 'productName' | 'quantityLabel'>,
  milkProducts: Product[],
): boolean {
  if (!draft.productName?.trim()) return false;
  const prod = milkProducts.find((p) => p.name === draft.productName);
  const opts = packSizeOptionsForProduct(prod);
  return opts.length === 0 || !!draft.quantityLabel?.trim();
}

/** Minimal plan row for milk pickers (day add-on or wizard) — satisfies DTO for totals and patches. */
export function emptyMilkLineDraftForPicker(
  deliveryTime: DeliveryTime,
  frequency: DeliveryFrequency,
): CustomerSubscriptionPlanDto {
  return {
    productName: '',
    quantityLabel: '',
    numberOfItems: 1,
    subscriptionKind: 'Monthly',
    productAdditionTag: 'Regular',
    deliveryTime,
    frequency,
    startDate: '01/01/1970',
    status: 'Active',
    originalPrice: 0,
    discountedPrice: 0,
    effectiveFinalPrice: 0,
  };
}
