import type { Product } from '@/src/domain/products/entities';

/**
 * Price a customer actually pays per unit: the discount price when it is a real discount
 * (greater than 0 and below the list price), otherwise the list price.
 * Single source of truth for list display, sorting, and billing lookups.
 */
export function effectiveUnitPrice(p: Pick<Product, 'price' | 'discountPrice'>): number {
  const price = Number(p.price ?? 0);
  const disc = Number(p.discountPrice ?? 0);
  const unit = disc > 0 && disc < price ? disc : price;
  return Number.isFinite(unit) ? Math.max(0, unit) : 0;
}
