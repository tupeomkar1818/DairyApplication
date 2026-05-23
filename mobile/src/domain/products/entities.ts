import type { EntityBase } from '@/src/domain/shared/types';
import type { DayOfWeek, DeliveryTimeSlot, ProductAvailability, ProductFeature, ProductType, ProductUnit, ProductVariant, TaxPercentage } from '@/src/domain/products/enums';

export interface Product extends EntityBase {
  name: string;
  category: string;
  productType: ProductType;
  price: number;
  discountPrice?: number;
  unit: ProductUnit;
  variants: ProductVariant[];
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

