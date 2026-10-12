import type { ProductResponse } from '@/src/domain/products/dtos';
import type { DayOfWeek, ProductAvailability, ProductFeature, ProductType, ProductUnit, DeliveryTimeSlot } from '@/src/domain/products/enums';
import { orderablePacks } from '@/src/domain/products/packs';
import { strings } from '@/src/i18n/strings';
import { amraleColors } from '@/src/theme/dairyTactile';

/** Display helpers shared by the admin product list cards and the product details screen. */

export type ProductStatusTone = 'blue' | 'gray' | 'red';

// Stock isn't tracked in this ERP (no out-of-stock state); the badge follows the availability flag and isActive.
export function productStatus(p: ProductResponse): { label: string; tone: ProductStatusTone } {
  const words = strings('products').status;
  if (p.availability === 'Discontinued') return { label: words.discontinued, tone: 'gray' };
  if (p.isActive) return { label: words.active, tone: 'blue' };
  return { label: words.inactive, tone: 'gray' };
}

export function productStatusColors(tone: ProductStatusTone): { bg: string; fg: string } {
  switch (tone) {
    case 'red':
      return { bg: 'rgba(225, 29, 72, 0.1)', fg: amraleColors.error };
    case 'blue':
      return { bg: 'rgba(53, 81, 161, 0.12)', fg: amraleColors.blue };
    default:
      return { bg: 'rgba(100, 116, 139, 0.14)', fg: amraleColors.textMuted };
  }
}

/** Primary pack size, e.g. "500 ml". An unlabelled 'Custom Size' falls back to "1 <unit>". */
export function productPackLabel(p: ProductResponse): string {
  return (
    (p.customVariantLabel ?? '').trim() || (p.variants ?? []).find((v) => v !== 'Custom Size') || `1 ${p.unit}`
  );
}

/** Card subtitle, e.g. "500 ml • Milk", or "500 ml · 1 L • Milk" when the product is sold in several packs. */
export function productSpecsLabel(p: ProductResponse): string {
  const packs = p.packs?.length ? orderablePacks(p).map((pk) => pk.label) : [];
  const sizes = packs.length ? packs.join(' · ') : productPackLabel(p);
  return `${sizes} • ${p.productType ? productTypeName(p.productType) : p.category}`;
}

/** Every pack size the product is sold in ('Custom Size' resolved to its label). */
export function productPackSizes(p: ProductResponse): string[] {
  const custom = (p.customVariantLabel ?? '').trim();
  const sizes = (p.variants ?? [])
    .map((v) => (v === 'Custom Size' ? custom : v))
    .filter((v): v is string => !!v);
  const unique = Array.from(new Set(sizes));
  return unique.length ? unique : [productPackLabel(p)];
}

const WEEK_ORDER: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Names of the fixed product vocabulary in the app language; anything unknown (old data) is shown as stored. */
export function productTypeName(type: ProductType | string): string {
  return strings('products').productTypes[type as ProductType] ?? type;
}

export function productUnitName(unit: ProductUnit | string): string {
  return strings('products').units[unit as ProductUnit] ?? unit;
}

export function productAvailabilityName(availability: ProductAvailability | string): string {
  return strings('products').availability[availability as ProductAvailability] ?? availability;
}

export function deliverySlotName(slot: DeliveryTimeSlot | string): string {
  return strings('products').slots[slot as DeliveryTimeSlot] ?? slot;
}

export function productFeatureName(feature: ProductFeature | string): string {
  return strings('products').features[feature as ProductFeature] ?? feature;
}

/** "Mon" for Monday, in the app language. */
export function productDayShort(day: DayOfWeek): string {
  // Common weekday names start on Sunday; WEEK_ORDER starts on Monday.
  return strings('common').dates.weekdaysShort[(WEEK_ORDER.indexOf(day) + 1) % 7] ?? day.slice(0, 3);
}

/** "Every day", "Not set", or short day names in week order ("Mon, Wed, Fri"). */
export function productDaysLabel(days: DayOfWeek[] | undefined): string {
  const set = new Set(days ?? []);
  if (set.size === 0) return strings('common').states.notSet;
  if (WEEK_ORDER.every((d) => set.has(d))) return strings('products').everyDay;
  return WEEK_ORDER.filter((d) => set.has(d))
    .map(productDayShort)
    .join(', ');
}

type CustomerProductRefs = {
  subscriptionPlans?: { productName?: string }[];
  subscription?: { productName?: string }[];
};

/**
 * Customers whose subscription plans (or legacy subscription items) reference the product — matched by trimmed,
 * case-insensitive name, the same rule the products service uses to block deleting a product that is in use.
 */
export function countCustomersUsingProduct(productName: string, customers: CustomerProductRefs[] | undefined): number {
  const key = productName.trim().toLowerCase();
  if (!key) return 0;
  const matches = (name: string | undefined) => (name ?? '').trim().toLowerCase() === key;
  return (customers ?? []).filter(
    (c) => (c.subscriptionPlans ?? []).some((p) => matches(p.productName)) || (c.subscription ?? []).some((s) => matches(s.productName)),
  ).length;
}
