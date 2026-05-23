import { describe, expect, it } from 'vitest';

import type { BaseMilkSubscription, SubscriptionDailyDelivery, SubscriptionModification } from '@/src/domain/subscriptions/entities';
import {
  billableLitresFromDeliveryRow,
  buildMonthDayYmds,
  endOfCalendarMonthYmd,
  firstMonthlyCycleEndYmd,
  nextFullCalendarMonthRange,
  plannedQuantityForDate,
} from '@/src/domain/subscriptions/scheduleEngine';

function base(overrides: Partial<BaseMilkSubscription> = {}): BaseMilkSubscription {
  const ts = '2026-04-01T00:00:00.000Z';
  return {
    id: 'sub_base_1',
    customerId: 'cust_1',
    productId: 'milk_cow',
    defaultQuantityLitres: 1,
    issueDate: '2026-04-05',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    status: 'Active',
    deliveryFrequency: 'Daily',
    billingType: 'Monthly',
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function mod(partial: Partial<SubscriptionModification> & Pick<SubscriptionModification, 'id'>): SubscriptionModification {
  const ts = '2026-04-01T00:00:00.000Z';
  return {
    subscriptionId: 'sub_base_1',
    productId: 'milk_cow',
    oldQuantityLitres: 1,
    newQuantityLitres: 1,
    effectiveFromDate: '2026-04-10',
    effectiveToDate: '2026-04-12',
    changeType: 'Decrease',
    createdBy: 'Customer',
    status: 'Active',
    createdAt: ts,
    updatedAt: ts,
    ...partial,
  };
}

describe('scheduleEngine', () => {
  it('computes first cycle end as last day of start month', () => {
    expect(firstMonthlyCycleEndYmd('2026-04-06')).toBe('2026-04-30');
    expect(endOfCalendarMonthYmd('2026-04-06')).toBe('2026-04-30');
  });

  it('computes next full month after an end date', () => {
    expect(nextFullCalendarMonthRange('2026-04-30')).toEqual({ start: '2026-05-01', end: '2026-05-31' });
  });

  it('matches the documented April quantity ladder (1 → 0.5 → 1 → 2 → 1 → 0 → 1)', () => {
    const b = base();
    const modifications: SubscriptionModification[] = [
      mod({ id: 'm1', newQuantityLitres: 0.5, effectiveFromDate: '2026-04-10', effectiveToDate: '2026-04-12', changeType: 'Decrease' }),
      mod({ id: 'm2', newQuantityLitres: 2, effectiveFromDate: '2026-04-15', effectiveToDate: '2026-04-15', changeType: 'Increase' }),
      mod({ id: 'm3', newQuantityLitres: 0, effectiveFromDate: '2026-04-25', effectiveToDate: '2026-04-27', changeType: 'Pause' }),
    ];

    const sample = (ymd: string) => plannedQuantityForDate(b, modifications, ymd).plannedQuantityLitres;

    expect(sample('2026-04-01')).toBe(1);
    expect(sample('2026-04-09')).toBe(1);
    expect(sample('2026-04-10')).toBe(0.5);
    expect(sample('2026-04-12')).toBe(0.5);
    expect(sample('2026-04-13')).toBe(1);
    expect(sample('2026-04-17')).toBe(1);
    expect(sample('2026-04-18')).toBe(1);
    expect(sample('2026-04-20')).toBe(1);
    expect(sample('2026-04-21')).toBe(1);
    expect(sample('2026-04-24')).toBe(1);
    expect(sample('2026-04-25')).toBe(0);
    expect(sample('2026-04-27')).toBe(0);
    expect(sample('2026-04-28')).toBe(1);
    expect(sample('2026-04-30')).toBe(1);
  });

  it('returns zero outside the subscription window', () => {
    const b = base();
    expect(plannedQuantityForDate(b, [], '2026-03-31').plannedQuantityLitres).toBe(0);
    expect(plannedQuantityForDate(b, [], '2026-05-01').plannedQuantityLitres).toBe(0);
  });

  it('builds all days in a month', () => {
    expect(buildMonthDayYmds('2026-04').length).toBe(30);
    expect(buildMonthDayYmds('2026-04')[0]).toBe('2026-04-01');
    expect(buildMonthDayYmds('2026-04')[29]).toBe('2026-04-30');
  });

  it('bills only final delivered litres (pending mismatch or rejected → 0)', () => {
    const baseRow = (partial: Partial<SubscriptionDailyDelivery>): SubscriptionDailyDelivery => ({
      id: 'd1',
      customerId: 'c1',
      subscriptionId: 's1',
      productId: 'milk',
      deliveryDate: '2026-04-10',
      plannedQuantityLitres: 1,
      deliveredQuantityLitres: 0.5,
      deliveryStatus: 'Partial',
      adminApprovalStatus: 'Pending',
      createdAt: '',
      updatedAt: '',
      ...partial,
    });

    expect(billableLitresFromDeliveryRow(baseRow({}))).toBe(0);
    expect(billableLitresFromDeliveryRow(baseRow({ adminApprovalStatus: 'Rejected' }))).toBe(0);
    expect(billableLitresFromDeliveryRow(baseRow({ adminApprovalStatus: 'Approved' }))).toBe(0.5);
    expect(billableLitresFromDeliveryRow(baseRow({ adminApprovalStatus: 'Approved', deliveryStatus: 'NotDelivered' }))).toBe(0);
  });
});
