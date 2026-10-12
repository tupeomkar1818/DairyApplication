import type { EntityBase } from '@/src/domain/shared/types';
import type { DayOfWeek, DeliveryTimeSlot, ProductAvailability, ProductFeature, ProductType, ProductUnit, ProductVariant, TaxPercentage } from '@/src/domain/products/enums';

/**
 * One sellable pack of a product: a size with its own price.
 *
 * A dairy lists the same milk as 500 ml and 1 L at different prices, so the price belongs to the pack, not to the
 * product. `quantity` is the size in the unit's base measure (ml, gram, piece) — it orders the picker and gives the
 * price per litre or kilo. Products saved before packs existed are read as a single pack, so every screen can
 * simply read `packs`.
 */
export interface ProductPack {
  id: string;
  /** What the customer picks: "500 ml", "1 L - Pouch", "200 g". */
  label: string;
  unit: ProductUnit;
  /** Size in ml / gram / piece. */
  quantity: number;
  price: number;
  discountPrice?: number;
  sku?: string;
  /** Per-pack stock; omitted means the product's own stock applies. */
  availableStock?: number;
  /** An inactive pack still stands on old orders and bills, but is no longer offered. */
  isActive?: boolean;
  /** Set on packs the migration created from a multi-size product: the admin still has to price them. */
  needsPricing?: boolean;
}

export interface Product extends EntityBase {
  name: string;
  category: string;
  productType: ProductType;
  price: number;
  discountPrice?: number;
  unit: ProductUnit;
  variants: ProductVariant[];
  /** Sellable packs, each with its own price. Always present on a product read through the service. */
  packs?: ProductPack[];
  customVariantLabel?: string;
  description: string;
  availableStock: number;
  minStockAlert?: number;
  availableDays: DayOfWeek[];
  deliveryTimeSlots: DeliveryTimeSlot[];
  availability: ProductAvailability;
  sku?: string;
  imageUri?: string;
  features: ProductFeature[];
  taxApplicable: boolean;
  taxPercentage?: TaxPercentage;
  isVisibleToCustomer: boolean;
  isVisibleOfflineCounter: boolean;
  isActive: boolean;
}

