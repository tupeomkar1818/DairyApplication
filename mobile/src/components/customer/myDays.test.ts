import { describe, expect, it } from 'vitest';

import { dayChangesForMonth } from '@/src/components/admin/customerDayChanges';
import { buildMyDayRow, buildMyDayRows, estimateMonthTotal } from '@/src/components/customer/myDays';
import type { CustomerResponse } from '@/src/domain/customers/dtos';

const TS = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
/** Early on the 1st: every day of September is still open. */
const NOW = new Date(2026, 8, 1, 8, 0, 0);

type Exception = NonNullable<CustomerResponse['subscriptionExceptions']>[number];

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
    subscription: [],
    subscriptionPlans: [
      {
        id: 'sub_milk',
        productName: 'Cow Milk',
        quantityLabel: '500 ml',
        numberOfItems: 1,
        deliveryTime: 'Morning',
        frequency: 'Daily',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        originalPrice: 56,
        discountedPrice: 52,
        status: 'Active',
        ...TS,
      },
    ],
    extraOrders: [],
    subscriptionExceptions: [],
    deliveries: [],
    monthlyBillAmount: 0,
    nextDeliveryDate: '2026-09-01',
    ...TS,
    ...overrides,
  } as CustomerResponse;
}

function ex(overrides: Partial<Exception>): Exception {
  return { id: 'ex', fromYmd: '2026-09-15', toYmd: '2026-09-15', createdBy: 'customer', ...TS, ...overrides } as Exception;
}

const paneer = {
  id: 'extra_paneer',
  orderDate: '2026-09-15',
  productName: 'Paneer',
  quantityLabel: '200 g',
  price: 90,
  status: 'Pending',
  ...TS,
} as NonNullable<CustomerResponse['extraOrders']>[number];

describe('buildMyDayRow', () => {
  it('shows an ordinary day as coming, at the usual quantity and price', () => {
    const row = buildMyDayRow(customer(), '2026-09-10', NOW);
    expect(row.state).toBe('planned');
    expect(row.lines).toEqual([
      expect.objectContaining({ planId: 'sub_milk', quantity: 1, usual: 1, unitPrice: 52, changed: false }),
    ]);
    expect(row.amount).toBe(52);
    expect(row.editable).toBe(true);
  });

  it('prices a changed quantity per pack and marks it changed', () => {
    const row = buildMyDayRow(
      customer({ subscriptionExceptions: [ex({ kind: 'quantity', planId: 'sub_milk', numberOfItems: 3 })] }),
      '2026-09-15',
      NOW,
    );
    expect(row.lines[0]).toMatchObject({ quantity: 3, usual: 1, changed: true });
    expect(row.amount).toBe(156);
  });

  it('calls a skipped day with nothing else coming "skipped", and costs nothing', () => {
    const row = buildMyDayRow(customer({ subscriptionExceptions: [ex({ kind: 'skip' })] }), '2026-09-15', NOW);
    expect(row.state).toBe('skipped');
    expect(row.amount).toBe(0);
    expect(row.wholeDaySkipId).toBe('ex');
  });

  it('calls a skipped day with an extra order "extras", and charges only the extra', () => {
    const row = buildMyDayRow(
      customer({ subscriptionExceptions: [ex({ kind: 'skip' })], extraOrders: [paneer] }),
      '2026-09-15',
      NOW,
    );
    expect(row.state).toBe('extras');
    expect(row.amount).toBe(90);
  });

  it('treats milk set to zero with paneer ordered as extras, without a whole-day skip', () => {
    const row = buildMyDayRow(
      customer({
        subscriptionExceptions: [ex({ kind: 'quantity', planId: 'sub_milk', numberOfItems: 0 })],
        extraOrders: [paneer],
      }),
      '2026-09-15',
      NOW,
    );
    expect(row.state).toBe('extras');
    expect(row.wholeDaySkipId).toBeUndefined();
    expect(row.lines[0]!.quantity).toBe(0);
    expect(row.amount).toBe(90);
  });

  it('adds extras to the day total on an ordinary day', () => {
    expect(buildMyDayRow(customer({ extraOrders: [paneer] }), '2026-09-15', NOW).amount).toBe(142);
  });

  it('shows an order on a day without a subscription as coming', () => {
    const row = buildMyDayRow(customer({ subscriptionPlans: [], extraOrders: [paneer] }), '2026-09-15', NOW);
    expect(row.state).toBe('planned');
  });

  it('shows a day outside the subscription with nothing ordered as nothing', () => {
    expect(buildMyDayRow(customer(), '2026-10-05', NOW).state).toBe('nothing');
  });

  it('reports delivered days and locks them', () => {
    const row = buildMyDayRow(
      customer({
        deliveries: [
          { id: 'd', deliveryDate: '2026-09-15', productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Delivered', ...TS },
        ] as CustomerResponse['deliveries'],
      }),
      '2026-09-15',
      NOW,
    );
    expect(row.state).toBe('delivered');
    expect(row.editable).toBe(false);
  });
});

describe('buildMyDayRows', () => {
  it('starts the current month at today, and shows a past month in full', () => {
    expect(buildMyDayRows(customer(), '2026-09', '2026-09-16', NOW)[0]!.ymd).toBe('2026-09-16');
    expect(buildMyDayRows(customer(), '2026-08', '2026-09-16', NOW)).toHaveLength(31);
  });
});

describe('dayChangesForMonth', () => {
  const c = customer({
    subscriptionExceptions: [
      ex({ id: 'away', kind: 'skip', fromYmd: '2026-09-10', toYmd: '2026-09-12' }),
      ex({ id: 'guests', kind: 'quantity', planId: 'sub_milk', numberOfItems: 3 }),
      ex({ id: 'none', kind: 'quantity', planId: 'sub_milk', fromYmd: '2026-09-20', toYmd: '2026-09-20', numberOfItems: 0 }),
      ex({ id: 'october', kind: 'skip', fromYmd: '2026-10-02', toYmd: '2026-10-03' }),
      ex({ id: 'across', kind: 'skip', fromYmd: '2026-08-30', toYmd: '2026-09-02', createdBy: 'admin' }),
    ],
  });

  it('lists the month changes in date order with plain wording', () => {
    expect(dayChangesForMonth(c, '2026-09').map((r) => [r.id, r.productLabel, r.changeLabel, r.createdBy])).toEqual([
      ['across', 'Whole subscription', 'Skipped', 'admin'],
      ['away', 'Whole subscription', 'Skipped', 'customer'],
      ['guests', 'Cow Milk · 500 ml', '× 3 (usually 1)', 'customer'],
      ['none', 'Cow Milk · 500 ml', 'None of this product', 'customer'],
    ]);
  });

  it('leaves out changes in other months', () => {
    expect(dayChangesForMonth(c, '2026-10').map((r) => r.id)).toEqual(['october']);
  });
});

describe('estimateMonthTotal', () => {
  it('counts each line only within its own dates', () => {
    const c = customer({
      subscriptionPlans: [
        { ...customer().subscriptionPlans![0]!, startDate: '2026-09-17', endDate: '2026-09-30' },
      ],
    });
    // 14 days from the 17th to the 30th at 52.
    expect(estimateMonthTotal(c, '2026-09')).toBe(14 * 52);
  });

  it('matches the delivered bill for the worked example before anything is delivered', () => {
    const c = customer({
      subscriptionExceptions: [
        ex({ id: 'away', kind: 'skip', fromYmd: '2026-09-10', toYmd: '2026-09-12' }),
        ex({ id: 'guests', kind: 'quantity', planId: 'sub_milk', numberOfItems: 3 }),
        ex({ id: 'none', kind: 'quantity', planId: 'sub_milk', fromYmd: '2026-09-20', toYmd: '2026-09-20', numberOfItems: 0 }),
      ],
      extraOrders: [
        { ...paneer, id: 'p', orderDate: '2026-09-20' },
        { ...paneer, id: 'c', orderDate: '2026-09-25', productName: 'Curd', quantityLabel: '500 g', price: 40 },
      ],
    });
    expect(estimateMonthTotal(c, '2026-09')).toBe(1586);
  });

  it('leaves out a day marked not delivered and cancelled orders', () => {
    const c = customer({
      deliveries: [
        { id: 'd', deliveryDate: '2026-09-05', productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Missed', ...TS },
      ] as CustomerResponse['deliveries'],
      extraOrders: [{ ...paneer, status: 'Cancelled' }],
    });
    expect(estimateMonthTotal(c, '2026-09')).toBe(29 * 52);
  });
});
