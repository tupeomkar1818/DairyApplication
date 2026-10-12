import type { CustomerSubscriptionPlanDto } from '@/src/domain/customers/dtos';
import type { DeliveryFrequency, DeliveryTime } from '@/src/domain/customers/enums';
import type { Product, ProductPack } from '@/src/domain/products/entities';
import { orderablePacks, packPrice } from '@/src/domain/products/packs';

export function isMilkCatalogProduct(p: Product): boolean {
  return p.productType === 'Milk' || p.productType === 'Milk Product';
}

/** Every pack the admin can put on a line, as the customer app lists them (not just the product's headline size). */
export function packSizeOptionsForProduct(prod: Product | undefined): string[] {
  if (!prod) return [];
  return Array.from(new Set(orderablePacks(prod).map((p) => p.label.trim()).filter(Boolean)));
}

/** The pack a line's label refers to, or undefined when the product no longer sells that size. */
export function packForLabel(prod: Product | undefined, label: string | undefined): ProductPack | undefined {
  const want = String(label ?? '').trim().toLowerCase();
  if (!prod || !want) return undefined;
  return orderablePacks(prod).find((p) => p.label.trim().toLowerCase() === want);
}

/** Plan fields for a chosen pack: its size, id and price — so a 1 L line is billed at the 1 L price. */
export function planPatchForPack(pack: ProductPack): Partial<CustomerSubscriptionPlanDto> {
  return {
    quantityLabel: pack.label,
    unitType: pack.unit,
    packId: pack.id,
    originalPrice: Math.round(Number(pack.price ?? 0)),
    // Same fields the customer app saves; planLineTotal charges the discount when it is a real one.
    discountedPrice: Math.round(Number(pack.discountPrice ?? 0)),
    effectiveFinalPrice: packPrice(pack),
  };
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
