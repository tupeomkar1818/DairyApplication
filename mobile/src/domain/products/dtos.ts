import type { Product, ProductPack } from '@/src/domain/products/entities';
import type { DayOfWeek, DeliveryTimeSlot, ProductAvailability, ProductFeature, ProductType, ProductUnit, ProductVariant, TaxPercentage } from '@/src/domain/products/enums';

export interface CreateProductRequest {
  name: string;
  category: string;
  productType: ProductType;
  price: number;
  discountPrice?: number;
  unit: ProductUnit;
  variants: ProductVariant[];
  customVariantLabel?: string;
  /** When given, the packs are the source of truth and the single-price fields above follow the smallest pack. */
  packs?: ProductPack[];
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

export interface UpdateProductRequest {
  name?: string;
  category?: string;
  productType?: ProductType;
  price?: number;
  discountPrice?: number;
  unit?: ProductUnit;
  variants?: ProductVariant[];
  customVariantLabel?: string;
  packs?: ProductPack[];
  description?: string;
  availableStock?: number;
  minStockAlert?: number;
  availableDays?: DayOfWeek[];
  deliveryTimeSlots?: DeliveryTimeSlot[];
  availability?: ProductAvailability;
  sku?: string;
  imageUri?: string;
  features?: ProductFeature[];
  taxApplicable?: boolean;
  taxPercentage?: TaxPercentage;
  isVisibleToCustomer?: boolean;
  isVisibleOfflineCounter?: boolean;
  isActive?: boolean;
}

export interface ProductResponse extends Product {}

export interface ProductListResponse {
  items: ProductResponse[];
  total: number;
}

