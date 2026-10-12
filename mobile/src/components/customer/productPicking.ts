import { isOrderableByCustomer } from '@/src/components/customer/customerActions';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { ProductResponse } from '@/src/domain/products/dtos';
import type { ProductPack } from '@/src/domain/products/entities';
import { orderablePacks, productFromPrice } from '@/src/domain/products/packs';
import { strings } from '@/src/i18n/strings';

/**
 * Which products the customer app offers, and where.
 *
 * - My subscription offers only products the dairy has marked "Subscription Available" — the things it delivers on
 *   a schedule.
 * - My days offers every product on sale, as a one-off for that day (extra milk included).
 */

export const SUBSCRIPTION_FEATURE = 'Subscription Available';

function sortByName(products: ProductResponse[]): ProductResponse[] {
  return [...products].sort((a, b) => a.name.localeCompare(b.name));
}

function onSale(product: ProductResponse): boolean {
  return isOrderableByCustomer(product) && orderablePacks(product).length > 0;
}

/** Products a customer can subscribe to. */
export function subscribableProducts(products: readonly ProductResponse[]): ProductResponse[] {
  return sortByName(products.filter((p) => onSale(p) && (p.features ?? []).includes(SUBSCRIPTION_FEATURE)));
}

/** Products a customer can add to a single day. */
export function addOnProducts(products: readonly ProductResponse[]): ProductResponse[] {
  return sortByName(products.filter(onSale));
}

/** Case-insensitive match on name and category. */
export function searchProducts(products: readonly ProductResponse[], query: string): ProductResponse[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...products];
  return products.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(q));
}

/** "from ₹27" when packs differ in price, "₹27" when there is one price. */
export function productPriceHint(product: ProductResponse): string {
  const packs = orderablePacks(product);
  const from = productFromPrice(product);
  const differ = new Set(packs.map((p) => Math.round(Number(p.discountPrice || p.price)))).size > 1;
  return differ ? strings('customer').productPicker.priceFrom(`₹${from}`) : `₹${from}`;
}

/**
 * A subscription the customer already has for this product and pack whose dates overlap the chosen ones. Two lines
 * for the same pack on the same days would deliver twice — the customer should change the quantity instead.
 */
export function overlappingSubscription(
  customer: Pick<CustomerResponse, 'subscriptionPlans'>,
  product: Pick<ProductResponse, 'name'>,
  pack: Pick<ProductPack, 'id' | 'label'>,
  startYmd: string,
  endYmd?: string,
): NonNullable<CustomerResponse['subscriptionPlans']>[number] | null {
  const newEnd = endYmd || '9999-12-31';
  return (
    (customer.subscriptionPlans ?? []).find((p) => {
      if (p.status === 'Inactive') return false;
      if (String(p.productName ?? '').trim() !== product.name.trim()) return false;
      const samePack = p.packId ? p.packId === pack.id : String(p.quantityLabel ?? '').trim() === pack.label.trim();
      if (!samePack) return false;
      const start = String(p.startDate ?? '').slice(0, 10);
      const end = p.openEnded ? '9999-12-31' : String(p.endDate ?? '').slice(0, 10) || '9999-12-31';
      return start <= newEnd && startYmd <= end;
    }) ?? null
  );
}
