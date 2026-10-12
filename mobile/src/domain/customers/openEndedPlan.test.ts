import { describe, expect, it } from 'vitest';

import { CustomerSubscriptionPlanSchema } from '@/src/domain/customers/validations';

const base = {
  id: 'sub_milk',
  productName: 'Cow Milk',
  quantityLabel: '500 ml',
  numberOfItems: 1,
  deliveryTime: 'Morning' as const,
  frequency: 'Daily' as const,
  startDate: '2026-09-17',
  status: 'Active' as const,
};

describe('subscription line dates in the admin plan schema', () => {
  it('accepts a customer line that runs until stopped, and keeps its flag and pack', () => {
    const res = CustomerSubscriptionPlanSchema.safeParse({ ...base, openEnded: true, packId: 'pk_500' });
    expect(res.success).toBe(true);
    expect(res.success && [res.data.openEnded, res.data.packId, res.data.endDate]).toEqual([true, 'pk_500', undefined]);
  });

  it('still requires an end date on every other line', () => {
    const res = CustomerSubscriptionPlanSchema.safeParse(base);
    expect(res.success).toBe(false);
    expect(!res.success && res.error.issues[0]?.path).toEqual(['endDate']);
  });

  it('accepts an end date months after the start', () => {
    expect(CustomerSubscriptionPlanSchema.safeParse({ ...base, endDate: '2027-03-31' }).success).toBe(true);
  });

  it('rejects an end before the start, open-ended or not', () => {
    expect(CustomerSubscriptionPlanSchema.safeParse({ ...base, endDate: '2026-09-01' }).success).toBe(false);
    expect(CustomerSubscriptionPlanSchema.safeParse({ ...base, openEnded: true, endDate: '2026-09-01' }).success).toBe(false);
  });

  it('still needs a real start date on an open-ended line', () => {
    expect(CustomerSubscriptionPlanSchema.safeParse({ ...base, openEnded: true, startDate: 'soon' }).success).toBe(false);
  });
});
