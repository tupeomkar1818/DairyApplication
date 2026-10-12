import type { Product, ProductPack } from '@/src/domain/products/entities';
import type { ProductUnit } from '@/src/domain/products/enums';

/**
 * Reading and pricing a product's packs.
 *
 * Everything that shows or sells a product goes through here, so a product saved before packs existed (one price,
 * one size label) and one saved after (several sizes, each priced) look the same to every screen.
 */

/** ml and gram are the base measures; everything else counts in whole items. */
export function packUnitFamily(unit: ProductUnit): 'volume' | 'weight' | 'count' {
  if (unit === 'ml' || unit === 'Litre') return 'volume';
  if (unit === 'Gram' || unit === 'Kg') return 'weight';
  return 'count';
}

/** Reads "500 ml", "1 L - Pouch", "250 gram", "2 Litre" into a base quantity (ml / gram / piece). */
export function parsePackQuantity(label: string, fallbackUnit: ProductUnit): { quantity: number; unit: ProductUnit } {
  const text = String(label ?? '').trim().toLowerCase();
  const m = text.match(/(\d+(?:\.\d+)?)\s*([a-z]*)/);
  const n = m ? Number(m[1]) : Number.NaN;
  const token = m ? m[2] : '';

  if (!Number.isFinite(n) || n <= 0) return { quantity: 1, unit: fallbackUnit };

  if (token === 'ml') return { quantity: Math.round(n), unit: 'ml' };
  if (token === 'l' || token.startsWith('lit')) return { quantity: Math.round(n * 1000), unit: 'ml' };
  if (token === 'g' || token === 'gm' || token === 'gms' || token.startsWith('gram')) {
    return { quantity: Math.round(n), unit: 'Gram' };
  }
  if (token === 'kg' || token.startsWith('kilo')) return { quantity: Math.round(n * 1000), unit: 'Gram' };

  // No unit in the label: read the number in the product's own unit.
  const scale = fallbackUnit === 'Litre' || fallbackUnit === 'Kg' ? 1000 : 1;
  const unit = fallbackUnit === 'Litre' ? 'ml' : fallbackUnit === 'Kg' ? 'Gram' : fallbackUnit;
  return { quantity: Math.round(n * scale), unit };
}

function packId(productId: string, label: string, index: number): string {
  const slug = String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `pk_${productId}_${slug || index}`;
}

/**
 * The packs of a product, filling them in for products saved before packs existed.
 *
 * A legacy product's size labels come from `variants` (`Custom Size` resolves to `customVariantLabel`); each gets
 * the product's single price, and every pack after the first is marked `needsPricing` — dropping the extra sizes
 * would lose what the admin listed, and pricing them at the first pack's rate silently would overcharge.
 */
export function productPacks(product: Pick<Product, 'id' | 'packs' | 'variants' | 'customVariantLabel' | 'unit' | 'price' | 'discountPrice' | 'sku'>): ProductPack[] {
  const stored = product.packs ?? [];
  if (stored.length) return stored;

  const custom = String(product.customVariantLabel ?? '').trim();
  const labels = (product.variants ?? [])
    .map((v) => (v === 'Custom Size' ? custom : String(v)))
    .map((l) => l.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(labels.length ? labels : [custom || `1 ${product.unit ?? 'Packet'}`]));

  return unique.map((label, index) => {
    const { quantity, unit } = parsePackQuantity(label, product.unit ?? 'Packet');
    return {
      id: packId(product.id, label, index),
      label,
      unit,
      quantity,
      price: Math.round(Number(product.price ?? 0)),
      discountPrice: Number(product.discountPrice ?? 0) > 0 ? Math.round(Number(product.discountPrice)) : undefined,
      sku: index === 0 ? product.sku : undefined,
      isActive: true,
      // Only the first pack is genuinely priced: the others carried the same single price.
      needsPricing: index > 0,
    };
  });
}

/** Packs a customer may order, cheapest size first. */
export function orderablePacks(product: Parameters<typeof productPacks>[0]): ProductPack[] {
  return productPacks(product)
    .filter((p) => p.isActive !== false)
    .sort((a, b) => a.quantity - b.quantity || a.label.localeCompare(b.label));
}

/** What the customer pays for one pack: the discounted price when there is a real one. */
export function packPrice(pack: Pick<ProductPack, 'price' | 'discountPrice'>): number {
  const base = Math.round(Number(pack.price ?? 0));
  const discounted = Math.round(Number(pack.discountPrice ?? 0));
  return discounted > 0 && discounted < base ? discounted : base;
}

/** Whole-percent saving on a pack, or 0 when it is not discounted. */
export function packDiscountPercent(pack: Pick<ProductPack, 'price' | 'discountPrice'>): number {
  const base = Math.round(Number(pack.price ?? 0));
  const paid = packPrice(pack);
  if (!base || paid >= base) return 0;
  return Math.round(((base - paid) / base) * 100);
}

/** "₹104/L" or "₹360/kg" — what shoppers compare pack sizes on. Empty for counted items. */
export function packUnitRateLabel(pack: Pick<ProductPack, 'price' | 'discountPrice' | 'quantity' | 'unit'>): string {
  const family = packUnitFamily(pack.unit);
  const qty = Number(pack.quantity ?? 0);
  if (family === 'count' || qty <= 0) return '';
  const perBase = packPrice(pack) / qty;
  const rate = Math.round(perBase * 1000);
  if (!Number.isFinite(rate) || rate <= 0) return '';
  return `₹${rate.toLocaleString('en-IN')}/${family === 'volume' ? 'L' : 'kg'}`;
}

/** The pack a screen should show first: the one that was chosen, else the smallest orderable one. */
export function resolvePack(
  product: Parameters<typeof productPacks>[0],
  packId?: string,
): ProductPack | null {
  const packs = orderablePacks(product);
  if (packId) {
    const found = productPacks(product).find((p) => p.id === packId);
    if (found) return found;
  }
  return packs[0] ?? null;
}

/** Lowest price across a product's packs — the "from ₹x" on a catalog row. */
export function productFromPrice(product: Parameters<typeof productPacks>[0]): number {
  const prices = orderablePacks(product).map(packPrice);
  return prices.length ? Math.min(...prices) : 0;
}

/**
 * The single-price fields a product still carries, kept in step with its packs: the smallest active pack is the
 * product's headline price and size. Screens and data written before packs existed keep reading sensible values.
 */
export function legacyFieldsFromPacks(packs: readonly ProductPack[]): {
  price: number;
  discountPrice?: number;
  unit: ProductPack['unit'];
  variants: ['Custom Size'];
  customVariantLabel: string;
} | null {
  const headline = [...packs]
    .filter((p) => p.isActive !== false)
    .sort((a, b) => a.quantity - b.quantity)[0] ?? packs[0];
  if (!headline) return null;
  return {
    price: Math.round(Number(headline.price ?? 0)),
    discountPrice: headline.discountPrice && headline.discountPrice > 0 ? Math.round(headline.discountPrice) : undefined,
    unit: headline.unit,
    variants: ['Custom Size'],
    customVariantLabel: headline.label,
  };
}

/** Cleans packs coming from a form: trimmed labels, whole-rupee prices, a stable id for every row. */
export function sanitizePacks(productId: string, packs: readonly ProductPack[]): ProductPack[] {
  return packs
    .map((p, index) => {
      const label = String(p.label ?? '').trim();
      const discount = Math.round(Number(p.discountPrice ?? 0));
      return {
        ...p,
        id: String(p.id ?? '').trim() || packId(productId, label, index),
        label,
        quantity: Math.max(1, Math.round(Number(p.quantity ?? 1))),
        price: Math.max(0, Math.round(Number(p.price ?? 0))),
        discountPrice: discount > 0 ? discount : undefined,
        isActive: p.isActive !== false,
        // Saving a pack from the form is the admin pricing it.
        needsPricing: undefined,
      };
    })
    .filter((p) => p.label);
}
