import { describe, expect, it } from 'vitest';

import { buildDayStatusDeliveries, NothingPlannedError } from '@/src/components/delivery/markDayStatus';
import type { CustomerResponse } from '@/src/domain/customers/dtos';

const YMD = '2026-09-16';
const NOW = '2026-09-16T06:30:00.000Z';
const TS = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };

function plan(overrides: Partial<NonNullable<CustomerResponse['subscriptionPlans']>[number]> = {}) {
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
  } as NonNullable<CustomerResponse['subscriptionPlans']>[number];
}

function addOn(overrides: Partial<NonNullable<CustomerResponse['extraOrders']>[number]> = {}) {
  return {
    id: 'extra_1',
    orderDate: YMD,
    productName: 'Paneer',
    quantityLabel: '200 gram',
    price: 90,
    status: 'Pending',
    ...TS,
    ...overrides,
  } as NonNullable<CustomerResponse['extraOrders']>[number];
}

function skip(overrides: Partial<NonNullable<CustomerResponse['subscriptionExceptions']>[number]> = {}) {
  return {
    id: 'skip_1',
    fromYmd: YMD,
    toYmd: YMD,
    createdBy: 'customer',
    ...TS,
    ...overrides,
  } as NonNullable<CustomerResponse['subscriptionExceptions']>[number];
}

function customer(overrides: Partial<CustomerResponse> = {}): CustomerResponse {
  return {
    id: 'cust_1',
    name: 'Asha',
    mobile: '9876543210',
    address: 'A-1',
    societyName: 'Green View',
    deliveryTime: 'Morning',
    paymentType: 'Cash',
    status: 'Active',
    routeName: 'Route A',
    subscription: [],
    subscriptionPlans: [plan()],
    deliveries: [],
    extraOrders: [],
    subscriptionExceptions: [],
    monthlyBillAmount: 900,
    nextDeliveryDate: YMD,
    ...TS,
    ...overrides,
  } as CustomerResponse;
}

describe('buildDayStatusDeliveries', () => {
  it('writes one row per subscription line, stamped with the delivery boy', () => {
    const { deliveries } = buildDayStatusDeliveries({
      customer: customer({
        subscriptionPlans: [plan(), plan({ id: 'sub_2', productName: 'Curd', quantityLabel: '200 g' })],
      }),
      ymd: YMD,
      next: 'Delivered',
      actorName: 'Sagar',
      now: NOW,
    });

    expect(deliveries.map((r) => [r.productName, r.status, r.deliveryBoyName, r.deliveryDate])).toEqual([
      ['Cow Milk', 'Delivered', 'Sagar', YMD],
      ['Curd', 'Delivered', 'Sagar', YMD],
    ]);
  });

  it('includes that day one-off orders and leaves other days alone', () => {
    const { deliveries } = buildDayStatusDeliveries({
      customer: customer({
        extraOrders: [addOn(), addOn({ id: 'extra_2', orderDate: '2026-09-15', productName: 'Ghee' })],
      }),
      ymd: YMD,
      next: 'Delivered',
      now: NOW,
    });

    expect(deliveries.map((r) => r.productName)).toEqual(['Cow Milk', 'Paneer']);
  });

  it('settles the day one-off orders so they reach the bill', () => {
    const { extraOrders } = buildDayStatusDeliveries({
      customer: customer({ extraOrders: [addOn()] }),
      ymd: YMD,
      next: 'Delivered',
      now: NOW,
    });

    expect(extraOrders[0]).toMatchObject({ status: 'Delivered', updatedAt: NOW });
  });

  it('puts a one-off order back to pending when the day is marked not delivered', () => {
    const { extraOrders } = buildDayStatusDeliveries({
      customer: customer({ extraOrders: [addOn({ status: 'Delivered' })] }),
      ymd: YMD,
      next: 'Missed',
      now: NOW,
    });

    expect(extraOrders[0]!.status).toBe('Pending');
  });

  it('never revives a cancelled order', () => {
    const { deliveries, extraOrders } = buildDayStatusDeliveries({
      customer: customer({ extraOrders: [addOn({ status: 'Cancelled' })] }),
      ymd: YMD,
      next: 'Delivered',
      now: NOW,
    });

    expect(extraOrders[0]!.status).toBe('Cancelled');
    expect(deliveries.map((r) => r.productName)).toEqual(['Cow Milk']);
  });

  it('leaves out a subscription line the customer skipped', () => {
    const { deliveries } = buildDayStatusDeliveries({
      customer: customer({ subscriptionExceptions: [skip()], extraOrders: [addOn()] }),
      ymd: YMD,
      next: 'Delivered',
      now: NOW,
    });

    // The milk was skipped; only the one-off order went.
    expect(deliveries.map((r) => r.productName)).toEqual(['Paneer']);
  });

  it('refuses a day whose only line was skipped', () => {
    expect(() =>
      buildDayStatusDeliveries({
        customer: customer({ subscriptionExceptions: [skip()] }),
        ymd: YMD,
        next: 'Delivered',
        now: NOW,
      }),
    ).toThrow(NothingPlannedError);
  });

  it('updates the existing row instead of duplicating when marked twice', () => {
    const first = buildDayStatusDeliveries({
      customer: customer(),
      ymd: YMD,
      next: 'Delivered',
      actorName: 'Sagar',
      now: NOW,
    }).deliveries;

    const second = buildDayStatusDeliveries({
      customer: customer({ deliveries: first }),
      ymd: YMD,
      next: 'Missed',
      actorName: 'Sagar',
      now: '2026-09-16T07:00:00.000Z',
    }).deliveries;

    expect(second).toHaveLength(1);
    expect(second[0]!.id).toBe(first[0]!.id);
    expect(second[0]!.createdAt).toBe(NOW);
    expect(second[0]!.updatedAt).toBe('2026-09-16T07:00:00.000Z');
    expect(second[0]!.status).toBe('Missed');
    expect(second[0]!.missedReason).toBe('Marked not delivered by delivery app');
  });

  it('clears the missed reason when a missed day is marked delivered', () => {
    const missed = buildDayStatusDeliveries({ customer: customer(), ymd: YMD, next: 'Missed', now: NOW }).deliveries;
    const delivered = buildDayStatusDeliveries({
      customer: customer({ deliveries: missed }),
      ymd: YMD,
      next: 'Delivered',
      now: NOW,
    }).deliveries;

    expect(delivered[0]!.status).toBe('Delivered');
    expect(delivered[0]!.missedReason).toBeUndefined();
  });

  it('keeps other days untouched', () => {
    const other = {
      id: 'del_old',
      deliveryDate: '2026-09-15',
      productName: 'Cow Milk',
      quantityLabel: '500 ml',
      status: 'Delivered',
      ...TS,
    } as NonNullable<CustomerResponse['deliveries']>[number];

    const { deliveries } = buildDayStatusDeliveries({
      customer: customer({ deliveries: [other] }),
      ymd: YMD,
      next: 'Delivered',
      now: NOW,
    });

    expect(deliveries).toHaveLength(2);
    expect(deliveries[0]).toBe(other);
  });

  it('refuses a day with nothing planned', () => {
    expect(() =>
      buildDayStatusDeliveries({
        customer: customer({ subscriptionPlans: [] }),
        ymd: YMD,
        next: 'Delivered',
        now: NOW,
      }),
    ).toThrow(NothingPlannedError);
  });

  it('names the customer in the nothing-planned message', () => {
    expect(() =>
      buildDayStatusDeliveries({
        customer: customer({
          name: 'Rahul',
          subscriptionPlans: [plan({ startDate: '2026-10-01', endDate: '2026-10-31' })],
        }),
        ymd: YMD,
        next: 'Delivered',
        now: NOW,
      }),
    ).toThrow('Nothing is planned for Rahul on this day.');
  });

  it('keeps the existing delivery boy name when the app cannot resolve one', () => {
    const seeded = [
      {
        id: 'del_1',
        deliveryDate: YMD,
        productName: 'Cow Milk',
        quantityLabel: '500 ml',
        deliveryBoyName: 'Sagar',
        status: 'Missed',
        ...TS,
      } as NonNullable<CustomerResponse['deliveries']>[number],
    ];

    const { deliveries } = buildDayStatusDeliveries({
      customer: customer({ deliveries: seeded }),
      ymd: YMD,
      next: 'Delivered',
      now: NOW,
    });

    expect(deliveries[0]!.deliveryBoyName).toBe('Sagar');
  });
});
