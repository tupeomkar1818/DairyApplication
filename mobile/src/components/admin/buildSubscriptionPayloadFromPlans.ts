import type { CustomerSubscriptionItemDto, CustomerSubscriptionPlanDto } from '@/src/domain/customers/dtos';
import { dobToIsoDate } from '@/src/components/admin/customerFormDates';

export type AdminProductLite = { name: string; price?: number; discountPrice?: number };

export function buildSubscriptionPayloadFromPlans(
  plans: CustomerSubscriptionPlanDto[],
  adminProducts: AdminProductLite[],
): { subscription: CustomerSubscriptionItemDto[]; subscriptionPlans: CustomerSubscriptionPlanDto[] } {
  const subscription = plans.map((p) => ({
    productName: p.productName,
    quantityLabel: `${Math.max(1, Number(p.numberOfItems ?? 1))} x ${p.quantityLabel}`,
  }));
  const subscriptionPlans = plans.map((p) => {
    const items = Math.max(1, Number(p.numberOfItems ?? 1));
    const prod = adminProducts.find((x) => x.name === p.productName);
    const fromForm = Number(p.originalPrice ?? 0);
    const fromCatalog = prod ? Number(prod.price ?? 0) : 0;
    /** Single admin-entered/catalog price: original = final, no separate discount. */
    const unitPrice = Number.isFinite(fromForm) && fromForm > 0 ? fromForm : fromCatalog;
    return {
      ...p,
      numberOfItems: items,
      originalPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      discountedPrice: 0,
      effectiveFinalPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      startDate: dobToIsoDate(p.startDate) ?? p.startDate,
      endDate: p.endDate ? dobToIsoDate(p.endDate) ?? p.endDate : undefined,
      pauseStartDate: p.pauseStartDate ? dobToIsoDate(p.pauseStartDate) ?? p.pauseStartDate : undefined,
      pauseEndDate: p.pauseEndDate ? dobToIsoDate(p.pauseEndDate) ?? p.pauseEndDate : undefined,
      resumeDate: p.resumeDate ? dobToIsoDate(p.resumeDate) ?? p.resumeDate : undefined,
      deliveryDate: p.deliveryDate ? dobToIsoDate(p.deliveryDate) ?? p.deliveryDate : undefined,
      addedDate: p.addedDate ? dobToIsoDate(p.addedDate) ?? p.addedDate : undefined,
    } as CustomerSubscriptionPlanDto;
  });
  return { subscription, subscriptionPlans };
}
