import { describe, expect, it } from 'vitest';

import { buildDayStatusDeliveries } from '@/src/components/delivery/markDayStatus';
import { buildStopOrder } from '@/src/components/delivery/stopOrder';
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

describe('buildStopOrder', () => {
  it('lists the subscription packs and extra orders going to the door, with the day total', () => {
    const order = buildStopOrder(
      customer({
        subscriptionPlans: [plan({ numberOfItems: 2 }), plan({ id: 'sub_2', productName: 'Curd', quantityLabel: '200 g' })],
        extraOrders: [addOn({ numberOfItems: 3, placedBy: 'admin' }), addOn({ id: 'extra_2', status: 'Cancelled' })],
      }),
      YMD,
    );
    expect(order.lines.map((l) => [l.productName, l.packLabel, l.count, l.kind])).toEqual([
      ['Cow Milk', '500 ml', 2, 'subscription'],
      ['Curd', '200 g', 1, 'subscription'],
      ['Paneer', '200 gram', 3, 'extra'],
    ]);
    expect(order.lines[2]!.placedBy).toBe('admin');
    expect(order.totalPacks).toBe(6);
    expect(order.skipped).toEqual([]);
    expect(order.status).toBe('Pending');
    expect(order.mark).toBeNull();
  });

  it('shows a combo with the packs to hand over, and counts those packs', () => {
    const order = buildStopOrder(
      customer({
        subscriptionPlans: [],
        extraOrders: [
          addOn({
            productName: 'Diwali box',
            quantityLabel: 'Combo',
            numberOfItems: 2,
            price: 599,
            offer: { offerId: 'box', kind: 'combo', title: { en: 'Diwali box' }, listPrice: 650 },
            comboItems: [
              { productName: 'Ghee', packLabel: '500 ml', quantity: 1 },
              { productName: 'Paneer', packLabel: '200 g', quantity: 2 },
            ],
          }),
        ],
      }),
      YMD,
    );
    expect(order.lines[0]).toMatchObject({ productName: 'Diwali box', count: 2, kind: 'extra' });
    expect(order.lines[0]!.comboPacks).toEqual([
      { productName: 'Ghee', packLabel: '500 ml', count: 2 },
      { productName: 'Paneer', packLabel: '200 g', count: 4 },
    ]);
    expect(order.totalPacks).toBe(6);
  });

  it('shows a changed quantity against the usual one, and paused lines apart from the order', () => {
    const order = buildStopOrder(
      customer({
        subscriptionPlans: [plan(), plan({ id: 'sub_2', productName: 'Curd', quantityLabel: '200 g' })],
        subscriptionExceptions: [
          skip({ id: 'q', kind: 'quantity', planId: 'sub_1', numberOfItems: 3 }),
          skip({ planId: 'sub_2', reason: 'Guests away' }),
        ],
      }),
      YMD,
    );
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]).toMatchObject({ productName: 'Cow Milk', count: 3, usualCount: 1 });
    expect(order.skipped).toEqual([{ key: 'plan:sub_2', productName: 'Curd', packLabel: '200 g', reason: 'Guests away' }]);
  });

  it('has nothing to deliver outside the plan dates', () => {
    const order = buildStopOrder(customer(), '2026-10-05');
    expect(order.lines).toEqual([]);
    expect(order.skipped).toEqual([]);
    expect(order.totalPacks).toBe(0);
  });

  it('says who marked the stop and why it was missed', () => {
    const c = customer();
    const { deliveries, extraOrders } = buildDayStatusDeliveries({ customer: c, ymd: YMD, next: 'Missed', actorName: 'Sagar', now: NOW });
    const missed = deliveries.map((d) => ({ ...d, missedReason: 'Door locked' }));
    const order = buildStopOrder({ ...c, deliveries: missed, extraOrders }, YMD);
    expect(order.status).toBe('Not delivered');
    expect(order.mark).toEqual({ status: 'Not delivered', by: 'Sagar', at: NOW, reason: 'Door locked' });
  });
});
