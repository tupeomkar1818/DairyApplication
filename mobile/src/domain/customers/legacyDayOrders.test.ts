import { describe, expect, it } from 'vitest';

import { placeAddOnOrder, DayLockedError, skipDays } from '@/src/components/customer/customerActions';
import { dayEditability } from '@/src/domain/customers/daySchedule';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { convertLegacyDayOrders } from '@/src/domain/customers/legacyDayOrders';
import type { ProductResponse } from '@/src/domain/products/dtos';

const TS = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
const TODAY = '2026-09-16';

function customer(overrides: Partial<CustomerResponse> = {}): CustomerResponse {
  return {
    id: 'cust_1',
    name: 'Asha',
    mobile: '9876543210',
    address: 'A-1',
    deliveryTime: 'Morning',
    paymentType: 'Cash',
    status: 'Active',
    subscription: [],
    subscriptionPlans: [
      {
        ...TS,
        id: 'sub_milk',
        productName: 'Cow Milk',
        quantityLabel: '500 ml',
        numberOfItems: 1,
        deliveryTime: 'Morning',
        frequency: 'Daily',
        startDate: '2026-09-01',
        openEnded: true,
        originalPrice: 30,
        status: 'Active',
      },
    ],
    extraOrders: [],
    subscriptionExceptions: [],
    deliveries: [],
    monthlyBillAmount: 0,
    nextDeliveryDate: TODAY,
    ...TS,
    ...overrides,
  } as CustomerResponse;
}

const paneer = {
  ...TS,
  id: 'prod_paneer',
  name: 'Paneer',
  unit: 'Gram',
  price: 100,
  isActive: true,
  packs: [{ id: 'pk_200', label: '200 gm', quantity: 200, unit: 'Gram', price: 100, discountPrice: 90, isActive: true }],
} as unknown as ProductResponse;

function line(id: string, dateYmd: string, productName: string, quantityLabel: string, quantity: number) {
  return { id, dateYmd, productName, quantityLabel, quantity };
}

describe("the admin's changes to a customer's day", () => {
  const evening = new Date(2026, 8, 16, 22, 0); // after tonight's 9 pm cut-off

  it('are not held to the evening cut-off, unlike the customer', () => {
    const c = customer();
    expect(dayEditability(c, '2026-09-17', 'customer', evening).editable).toBe(false);
    expect(dayEditability(c, '2026-09-17', 'admin', evening).editable).toBe(true);
  });

  it('stop once the delivery boy has marked the day', () => {
    const c = customer({
      deliveries: [{ ...TS, id: 'd1', deliveryDate: TODAY, productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Delivered' }],
    });
    const result = dayEditability(c, TODAY, 'admin', evening);
    expect(result.editable).toBe(false);
    expect(() =>
      placeAddOnOrder(c, { product: paneer, pack: paneer.packs![0]!, numberOfItems: 1, dateYmd: TODAY, actor: 'admin', now: evening }),
    ).toThrow(DayLockedError);
  });

  it('are saved as the same records the customer writes, marked as the dairy’s', () => {
    const c = customer();
    const { order } = placeAddOnOrder(c, {
      product: paneer,
      pack: paneer.packs![0]!,
      numberOfItems: 2,
      dateYmd: '2026-09-17',
      actor: 'admin',
      now: evening,
    });
    expect(order).toMatchObject({ productName: 'Paneer', quantityLabel: '200 gm', numberOfItems: 2, price: 90, status: 'Pending', placedBy: 'admin' });

    const { skip } = skipDays(c, { fromYmd: '2026-09-17', actor: 'admin', now: evening });
    expect(skip.createdBy).toBe('admin');
  });
});

describe('older admin day orders', () => {
  it('become add-ons: delivered, still to come, or cancelled when the day went by without them', () => {
    const c = customer({
      deliveries: [{ ...TS, id: 'd1', deliveryDate: '2026-09-10', productName: 'Paneer', quantityLabel: '200 gm', status: 'Delivered' }],
    });
    const patch = convertLegacyDayOrders({
      customer: c,
      products: [paneer],
      today: TODAY,
      lines: [
        line('a', '2026-09-10', 'Paneer', '200 gm', 1),
        line('b', '2026-09-12', 'Paneer', '200 gm', 1),
        line('c', '2026-09-18', 'Paneer', '200 gm', 3),
      ],
    });
    expect(patch?.extraOrders?.map((o) => [o.id, o.status, o.numberOfItems, o.price, o.placedBy])).toEqual([
      ['extra_legacy_a', 'Delivered', 1, 90, 'admin'],
      ['extra_legacy_b', 'Cancelled', 1, 90, 'admin'],
      ['extra_legacy_c', 'Pending', 3, 90, 'admin'],
    ]);
  });

  it("become a quantity change when they were for the customer's own subscription", () => {
    const patch = convertLegacyDayOrders({
      customer: customer(),
      products: [paneer],
      today: TODAY,
      lines: [
        line('q1', '2026-09-20', 'Cow Milk', '500 ml', 3),
        line('q2', '2026-09-21', 'Cow Milk', '500 ml', 1), // the usual quantity: nothing to change
        line('q3', '2026-09-02', 'Cow Milk', '500 ml', 2), // already delivered and billed
      ],
    });
    expect(patch?.extraOrders).toEqual([]);
    expect(patch?.subscriptionExceptions).toEqual([
      expect.objectContaining({ id: 'qty_legacy_q1', kind: 'quantity', planId: 'sub_milk', fromYmd: '2026-09-20', numberOfItems: 3 }),
    ]);
  });

  it('are not added twice', () => {
    const lines = [line('c', '2026-09-18', 'Paneer', '200 gm', 3)];
    const first = convertLegacyDayOrders({ customer: customer(), products: [paneer], today: TODAY, lines })!;
    const again = convertLegacyDayOrders({ customer: customer(first), products: [paneer], today: TODAY, lines });
    expect(again).toBeNull();
  });
});
