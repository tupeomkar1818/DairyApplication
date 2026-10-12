import { describe, expect, it } from 'vitest';

import {
  isDaySkipped,
  MAX_DAY_QUANTITY,
  planQuantityOn,
  plannedLinesOn,
  quantityChangeOn,
  usualQuantity,
} from '@/src/domain/customers/daySchedule';
import type { Customer, CustomerSubscriptionException, CustomerSubscriptionPlan } from '@/src/domain/customers/entities';

function plan(overrides: Partial<CustomerSubscriptionPlan> = {}): CustomerSubscriptionPlan {
  return {
    id: 'sub_milk',
    productName: 'Cow Milk',
    quantityLabel: '500 ml',
    numberOfItems: 1,
    deliveryTime: 'Morning',
    frequency: 'Daily',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    status: 'Active',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  } as CustomerSubscriptionPlan;
}

function change(overrides: Partial<CustomerSubscriptionException>): CustomerSubscriptionException {
  return {
    id: 'ex',
    kind: 'quantity',
    planId: 'sub_milk',
    fromYmd: '2026-09-15',
    toYmd: '2026-09-15',
    createdBy: 'customer',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  } as CustomerSubscriptionException;
}

describe('usualQuantity', () => {
  it('is the line packs per day, and 1 when unset or unreadable', () => {
    expect(usualQuantity(plan({ numberOfItems: 2 }))).toBe(2);
    expect(usualQuantity(plan({ numberOfItems: undefined }))).toBe(1);
    expect(usualQuantity(plan({ numberOfItems: 0 }))).toBe(1);
  });
});

describe('planQuantityOn', () => {
  it('is the usual quantity on an ordinary day', () => {
    expect(planQuantityOn(plan({ numberOfItems: 2 }), '2026-09-10', [])).toBe(2);
  });

  it('is 0 outside the subscription dates', () => {
    expect(planQuantityOn(plan(), '2026-10-01', [])).toBe(0);
    expect(planQuantityOn(plan(), '2026-08-31', [])).toBe(0);
  });

  it('follows a quantity change for that day', () => {
    expect(planQuantityOn(plan(), '2026-09-15', [change({ numberOfItems: 3 })])).toBe(3);
    expect(planQuantityOn(plan(), '2026-09-16', [change({ numberOfItems: 3 })])).toBe(1);
  });

  it('follows a quantity change across a range', () => {
    const week = [change({ fromYmd: '2026-09-14', toYmd: '2026-09-20', numberOfItems: 2 })];
    expect(planQuantityOn(plan(), '2026-09-14', week)).toBe(2);
    expect(planQuantityOn(plan(), '2026-09-20', week)).toBe(2);
    expect(planQuantityOn(plan(), '2026-09-21', week)).toBe(1);
  });

  it('can drop a line to zero without skipping the whole day', () => {
    const exceptions = [change({ numberOfItems: 0 })];
    expect(planQuantityOn(plan(), '2026-09-15', exceptions)).toBe(0);
    expect(isDaySkipped(exceptions, '2026-09-15')).toBe(false);
  });

  it('lets a skip win over a quantity change', () => {
    const exceptions = [
      change({ numberOfItems: 3 }),
      change({ id: 'skip', kind: 'skip', planId: undefined, numberOfItems: undefined }),
    ];
    expect(planQuantityOn(plan(), '2026-09-15', exceptions)).toBe(0);
  });

  it('uses the newest change when two cover the same day', () => {
    const exceptions = [
      change({ id: 'week', fromYmd: '2026-09-14', toYmd: '2026-09-20', numberOfItems: 2, createdAt: '2026-09-01T00:00:00.000Z' }),
      change({ id: 'day', numberOfItems: 4, createdAt: '2026-09-05T00:00:00.000Z' }),
    ];
    expect(planQuantityOn(plan(), '2026-09-15', exceptions)).toBe(4);
    expect(quantityChangeOn(plan(), '2026-09-15', exceptions)?.id).toBe('day');
    expect(planQuantityOn(plan(), '2026-09-16', exceptions)).toBe(2);
  });

  it('ignores a quantity change for a different line', () => {
    expect(planQuantityOn(plan(), '2026-09-15', [change({ planId: 'sub_curd', numberOfItems: 5 })])).toBe(1);
  });

  it('never goes above the daily limit', () => {
    expect(planQuantityOn(plan(), '2026-09-15', [change({ numberOfItems: 500 })])).toBe(MAX_DAY_QUANTITY);
  });

  it('reads old skip rows without a kind as skips', () => {
    const legacy = [{ ...change({}), kind: undefined, planId: undefined, numberOfItems: undefined }];
    expect(planQuantityOn(plan(), '2026-09-15', legacy)).toBe(0);
  });
});

describe('plannedLinesOn', () => {
  it('lists the lines going out with their quantity for the day, leaving out lines at zero', () => {
    const customer = {
      subscriptionPlans: [plan(), plan({ id: 'sub_curd', productName: 'Curd', numberOfItems: 2 })],
      subscriptionExceptions: [change({ numberOfItems: 0 }), change({ id: 'curd', planId: 'sub_curd', numberOfItems: 4 })],
    } as Pick<Customer, 'subscriptionPlans' | 'subscriptionExceptions'>;

    expect(plannedLinesOn(customer, '2026-09-15').map(({ plan: p, quantity }) => [p.productName, quantity])).toEqual([
      ['Curd', 4],
    ]);
    expect(plannedLinesOn(customer, '2026-09-16').map(({ plan: p, quantity }) => [p.productName, quantity])).toEqual([
      ['Cow Milk', 1],
      ['Curd', 2],
    ]);
  });
});
