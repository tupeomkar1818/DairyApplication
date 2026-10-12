import { describe, expect, it } from 'vitest';

import {
  computeSubscriptionBillingTotalForMonth,
  subscriptionPlanActiveOnDateYmd,
  subscriptionPlanActiveSegments,
} from '@/src/components/admin/customerSubscriptionMonthUtils';
import type { CustomerSubscriptionPlanDto } from '@/src/domain/customers/dtos';
import { subscriptionPlanActiveDaysInMonth } from '@/src/domain/customers/planSchedule';
import { duplicateClosureEndDdMmYyyy } from '@/src/domain/shared/planBoundaryDates';

function plan(overrides: Partial<CustomerSubscriptionPlanDto>): CustomerSubscriptionPlanDto {
  return {
    productName: 'Cow Milk',
    numberOfItems: 1,
    quantityLabel: '500 ml',
    subscriptionKind: 'Monthly',
    deliveryTime: 'Morning',
    frequency: 'Daily',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    originalPrice: 30,
    discountedPrice: 0,
    status: 'Active',
    ...overrides,
  };
}

describe('plan pause segments', () => {
  it('treats a plan paused for its whole range as inactive (not fully active)', () => {
    const p = plan({ pauseStartDate: '2026-09-01', pauseEndDate: '2026-09-30' });
    expect(subscriptionPlanActiveSegments(p)).toEqual([]);
    expect(subscriptionPlanActiveOnDateYmd(p, '2026-09-15')).toBe(false);
    expect(subscriptionPlanActiveDaysInMonth(p, '2026-09')).toBe(0);
  });

  it('keeps the active days around a partial pause', () => {
    const p = plan({ pauseStartDate: '2026-09-10', pauseEndDate: '2026-09-19' });
    expect(subscriptionPlanActiveSegments(p)).toEqual([
      ['2026-09-01', '2026-09-09'],
      ['2026-09-20', '2026-09-30'],
    ]);
    expect(subscriptionPlanActiveDaysInMonth(p, '2026-09')).toBe(20);
  });
});

describe('duplicate line closure', () => {
  it('ends the old line the day before the new line starts', () => {
    expect(duplicateClosureEndDdMmYyyy('01/09/2026', '15/09/2026')).toBe('14/09/2026');
    expect(duplicateClosureEndDdMmYyyy('2026-09-01', '01/10/2026')).toBe('30/09/2026');
  });

  it('never ends the old line before its own start', () => {
    expect(duplicateClosureEndDdMmYyyy('10/09/2026', '10/09/2026')).toBe('10/09/2026');
    expect(duplicateClosureEndDdMmYyyy('10/09/2026', '05/09/2026')).toBe('10/09/2026');
  });
});

describe('plan switch day billing', () => {
  const deliveredOn = (ymd: string) => ({ deliveryDate: ymd, productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Delivered' });

  it('bills a delivery on the switch day once after closing the old line', () => {
    const newStart = '15/09/2026';
    const oldLine = plan({ startDate: '01/09/2026', endDate: duplicateClosureEndDdMmYyyy('01/09/2026', newStart) });
    const newLine = plan({ startDate: newStart, endDate: '30/09/2026', numberOfItems: 2 });
    const total = computeSubscriptionBillingTotalForMonth('2026-09', [oldLine, newLine], [], [deliveredOn('2026-09-15')]);
    // Only the new line (2 × ₹30) is billed for the 15th.
    expect(total).toBe(60);
  });

  it('attributes an overlapping day to one line even when quantity/schedule differ', () => {
    // Same product + pack, different qty and delivery time: one Delivered row must not bill both lines.
    const oldLine = plan({ startDate: '2026-09-01', endDate: '2026-09-15', deliveryTime: 'Evening' });
    const newLine = plan({ startDate: '2026-09-15', endDate: '2026-09-30', numberOfItems: 2 });
    const total = computeSubscriptionBillingTotalForMonth('2026-09', [oldLine, newLine], [], [deliveredOn('2026-09-15')]);
    expect(total).toBe(60);
  });
});
