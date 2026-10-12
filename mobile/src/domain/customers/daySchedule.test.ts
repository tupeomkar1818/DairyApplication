import { describe, expect, it } from 'vitest';

import {
  dayEditability,
  dayEditabilityForCustomer,
  deliverablePlansOn,
  isDaySkipped,
  isPlanDeliverableOn,
} from '@/src/domain/customers/daySchedule';
import type { Customer, CustomerSubscriptionException, CustomerSubscriptionPlan } from '@/src/domain/customers/entities';

const TS = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };

function plan(overrides: Partial<CustomerSubscriptionPlan> = {}): CustomerSubscriptionPlan {
  return {
    id: 'sub_1',
    productName: 'Cow Milk',
    quantityLabel: '500 ml',
    deliveryTime: 'Morning',
    frequency: 'Daily',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    status: 'Active',
    ...TS,
    ...overrides,
  } as CustomerSubscriptionPlan;
}

function skip(overrides: Partial<CustomerSubscriptionException> = {}): CustomerSubscriptionException {
  return {
    id: 'skip_1',
    fromYmd: '2026-09-16',
    toYmd: '2026-09-16',
    createdBy: 'customer',
    ...TS,
    ...overrides,
  } as CustomerSubscriptionException;
}

describe('isDaySkipped', () => {
  it('covers a single day', () => {
    expect(isDaySkipped([skip()], '2026-09-16')).toBe(true);
    expect(isDaySkipped([skip()], '2026-09-17')).toBe(false);
  });

  it('covers a range inclusively — a holiday or a long pause', () => {
    const holiday = [skip({ fromYmd: '2026-09-10', toYmd: '2026-09-20' })];
    expect(isDaySkipped(holiday, '2026-09-10')).toBe(true);
    expect(isDaySkipped(holiday, '2026-09-15')).toBe(true);
    expect(isDaySkipped(holiday, '2026-09-20')).toBe(true);
    expect(isDaySkipped(holiday, '2026-09-21')).toBe(false);
  });

  it('applies to every line when no plan is named', () => {
    expect(isDaySkipped([skip()], '2026-09-16', 'sub_1')).toBe(true);
    expect(isDaySkipped([skip()], '2026-09-16', 'sub_2')).toBe(true);
  });

  it('applies to one line only when a plan is named', () => {
    const milkOnly = [skip({ planId: 'sub_1' })];
    expect(isDaySkipped(milkOnly, '2026-09-16', 'sub_1')).toBe(true);
    expect(isDaySkipped(milkOnly, '2026-09-16', 'sub_2')).toBe(false);
  });

  it('ignores rows with an unusable date', () => {
    expect(isDaySkipped([skip({ fromYmd: 'someday', toYmd: 'someday' })], '2026-09-16')).toBe(false);
  });

  it('is false with no exceptions at all', () => {
    expect(isDaySkipped(undefined, '2026-09-16')).toBe(false);
    expect(isDaySkipped([], '2026-09-16')).toBe(false);
  });
});

describe('isPlanDeliverableOn', () => {
  it('needs the plan to be running and the day not skipped', () => {
    expect(isPlanDeliverableOn(plan(), '2026-09-16', [])).toBe(true);
    expect(isPlanDeliverableOn(plan(), '2026-09-16', [skip()])).toBe(false);
    expect(isPlanDeliverableOn(plan({ endDate: '2026-09-10' }), '2026-09-16', [])).toBe(false);
  });
});

describe('deliverablePlansOn', () => {
  it('keeps the lines that still go out that day', () => {
    const customer = {
      subscriptionPlans: [plan(), plan({ id: 'sub_2', productName: 'Curd' })],
      subscriptionExceptions: [skip({ planId: 'sub_2' })],
    } as Pick<Customer, 'subscriptionExceptions' | 'subscriptionPlans'>;

    expect(deliverablePlansOn(customer, '2026-09-16').map((p) => p.productName)).toEqual(['Cow Milk']);
    expect(deliverablePlansOn(customer, '2026-09-17').map((p) => p.productName)).toEqual(['Cow Milk', 'Curd']);
  });
});

describe('dayEditabilityForCustomer', () => {
  const empty = { deliveries: [] } as Pick<Customer, 'deliveries'>;

  it('allows a change well before the cut-off', () => {
    const now = new Date(2026, 8, 15, 18, 0, 0); // 6 pm on the 15th, for the 16th
    expect(dayEditabilityForCustomer(empty, '2026-09-16', now)).toEqual({ editable: true });
  });

  it('closes the day at the cut-off the evening before', () => {
    const now = new Date(2026, 8, 15, 21, 30, 0);
    const result = dayEditabilityForCustomer(empty, '2026-09-16', now);
    expect(result.editable).toBe(false);
    expect(result.editable === false && result.reason).toContain('closed');
    expect(result.editable === false && result.contactAdmin).toBe(true);
  });

  it('keeps tomorrow open until just before 9 pm today and closes it at 9 pm sharp', () => {
    expect(dayEditabilityForCustomer(empty, '2026-09-16', new Date(2026, 8, 15, 20, 59, 59, 999)).editable).toBe(true);
    expect(dayEditabilityForCustomer(empty, '2026-09-16', new Date(2026, 8, 15, 21, 0, 0, 0)).editable).toBe(false);
  });

  it('lets the admin still change a day after the customer cut-off', () => {
    const late = new Date(2026, 8, 15, 22, 0, 0);
    expect(dayEditability(empty, '2026-09-16', 'customer', late).editable).toBe(false);
    expect(dayEditability(empty, '2026-09-16', 'admin', late)).toEqual({ editable: true });
  });

  it('still allows a day further out after tonight cut-off', () => {
    const now = new Date(2026, 8, 15, 21, 30, 0);
    expect(dayEditabilityForCustomer(empty, '2026-09-18', now)).toEqual({ editable: true });
  });

  it('refuses a day that has already been delivered', () => {
    const delivered = {
      deliveries: [
        {
          id: 'del_1',
          deliveryDate: '2026-09-16',
          productName: 'Cow Milk',
          quantityLabel: '500 ml',
          status: 'Delivered',
          ...TS,
        },
      ],
    } as Pick<Customer, 'deliveries'>;

    const now = new Date(2026, 8, 15, 8, 0, 0);
    const result = dayEditabilityForCustomer(delivered, '2026-09-16', now);
    expect(result).toEqual({ editable: false, reason: 'This day has already been delivered.' });
  });

  it('refuses a date it cannot read', () => {
    expect(dayEditabilityForCustomer(empty, 'tomorrow').editable).toBe(false);
  });
});
