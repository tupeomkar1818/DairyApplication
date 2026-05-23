import {
  billableDeliveredDatesForPlan,
  planLineTotal,
} from '@/src/components/admin/customerSubscriptionMonthUtils';
import type {
  CustomerDailyProductOrderLineDto,
  CustomerResponse,
  CustomerSubscriptionHistoryLineKind,
  CustomerSubscriptionHistoryRowDto,
  CustomerSubscriptionPlanDto,
} from '@/src/domain/customers/dtos';

function classifyLineKind(tag: CustomerSubscriptionPlanDto['productAdditionTag'] | undefined): CustomerSubscriptionHistoryLineKind {
  if (tag === 'Temporary' || tag === 'Permanent') return 'add_on_product';
  return 'basic_subscription';
}

/**
 * Builds subscription history rows: one per `subscriptionPlans` line.
 * Delivery stats use the same rules as billing: only **Delivered** `customer.deliveries` rows, aligned to the plan
 * (active day + duplicate-key attribution), with per-day quantity from matching calendar order lines or 1.
 */
export function buildCustomerSubscriptionHistoryRows(
  customer: CustomerResponse | null | undefined,
  dailyOrderLines: CustomerDailyProductOrderLineDto[],
): CustomerSubscriptionHistoryRowDto[] {
  const plans = customer?.subscriptionPlans ?? [];
  const deliveries = customer?.deliveries ?? [];

  return plans.map((plan, index) => {
    const planId = plan.id?.trim() || `plan_${index}_${plan.productName}`;
    const byDate = billableDeliveredDatesForPlan(index, plans, dailyOrderLines, deliveries, undefined);

    let lastYmd: string | undefined;
    for (const y of byDate.keys()) {
      if (!lastYmd || y > lastYmd) lastYmd = y;
    }

    const deliveryOccurrenceCount = byDate.size;
    let totalQuantityDelivered = 0;
    for (const v of byDate.values()) totalQuantityDelivered += v;

    const pricePerDelivery = planLineTotal(plan);
    const calculatedAmount = Math.round(deliveryOccurrenceCount * pricePerDelivery);

    const subscriptionIssueDate =
      plan.createdAt ?? plan.addedDate ?? customer?.updatedAt ?? customer?.createdAt ?? new Date().toISOString();

    return {
      id: planId,
      lineKind: classifyLineKind(plan.productAdditionTag),
      productName: plan.productName,
      packSizeLabel: plan.quantityLabel,
      quantity: Math.max(1, Number(plan.numberOfItems ?? 1)),
      pricePerDelivery,
      subscriptionIssueDate,
      subscriptionStartDate: plan.startDate,
      subscriptionEndDate: plan.endDate,
      lastDeliveredDateYmd: lastYmd,
      totalQuantityDelivered,
      deliveryOccurrenceCount,
      calculatedAmount,
    };
  });
}
