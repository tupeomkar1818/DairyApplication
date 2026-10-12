import { describe, expect, it } from 'vitest';

import { computeCustomerMonthBillTotal } from '@/src/components/admin/customerSubscriptionMonthUtils';
import { buildTodayEntries } from '@/src/components/admin/dashboardMetrics';
import { setPlanQuantityForDays, skipDays } from '@/src/components/customer/customerActions';
import { buildLoadSheet, loadSheetItemCount } from '@/src/components/delivery/loadSheet';
import { buildDayStatusDeliveries, NothingPlannedError } from '@/src/components/delivery/markDayStatus';
import type { CustomerResponse } from '@/src/domain/customers/dtos';

/**
 * The customer story end to end: a September milk subscription with days away, a day of guests, a day of paneer
 * instead of milk and a day with extra curd — marked day by day by the delivery app, then billed.
 */

const TS = { createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' };
/** Long before September, so no day is past the cut-off when the changes are made. */
const PLANNING_NOW = new Date(2026, 7, 20, 10, 0, 0);

type Extra = NonNullable<CustomerResponse['extraOrders']>[number];

function baseCustomer(): CustomerResponse {
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
  } as CustomerResponse;
}

function extra(id: string, dateYmd: string, productName: string, quantityLabel: string, price: number): Extra {
  return { id, orderDate: dateYmd, deliveryDate: dateYmd, productName, quantityLabel, price, status: 'Pending', ...TS } as Extra;
}

/** Applies the customer's September changes through the same actions the app uses. */
function customerWithSeptemberChanges(): CustomerResponse {
  let c = baseCustomer();

  // Away 10–12 Sep.
  c = { ...c, ...skipDays(c, { fromYmd: '2026-09-10', toYmd: '2026-09-12', now: PLANNING_NOW }) };
  // Guests on the 15th: 3 packets.
  c = {
    ...c,
    ...setPlanQuantityForDays(c, { planId: 'sub_milk', fromYmd: '2026-09-15', numberOfItems: 3, now: PLANNING_NOW }),
  };
  // No milk on the 20th...
  c = {
    ...c,
    ...setPlanQuantityForDays(c, { planId: 'sub_milk', fromYmd: '2026-09-20', numberOfItems: 0, now: PLANNING_NOW }),
  };
  // ...but paneer that day, and curd with the usual milk on the 25th.
  c = {
    ...c,
    extraOrders: [
      extra('extra_paneer', '2026-09-20', 'Paneer', '200 g', 90),
      extra('extra_curd', '2026-09-25', 'Curd', '500 g', 40),
    ],
  };
  return c;
}

/** The delivery boy marks every day of the month delivered, as the run sheet would. */
function deliverWholeMonth(customer: CustomerResponse): CustomerResponse {
  let c = customer;
  for (let day = 1; day <= 30; day += 1) {
    const ymd = `2026-09-${String(day).padStart(2, '0')}`;
    try {
      const { deliveries, extraOrders } = buildDayStatusDeliveries({ customer: c, ymd, next: 'Delivered', now: `${ymd}T06:00:00.000Z` });
      c = { ...c, deliveries, extraOrders };
    } catch (err) {
      if (!(err instanceof NothingPlannedError)) throw err;
    }
  }
  return c;
}

describe('a subscription month with days away, extra quantity and add-ons', () => {
  it('bills ₹1,586: 28 milk packets at ₹52 plus ₹130 of extras', () => {
    const billed = deliverWholeMonth(customerWithSeptemberChanges());
    expect(computeCustomerMonthBillTotal(billed, '2026-09')).toBe(1586);
  });

  it('delivers nothing on the days away', () => {
    const billed = deliverWholeMonth(customerWithSeptemberChanges());
    const awayRows = (billed.deliveries ?? []).filter((d) => ['2026-09-10', '2026-09-11', '2026-09-12'].includes(d.deliveryDate));
    expect(awayRows).toEqual([]);
  });

  it('records 3 packets on the guests day', () => {
    const billed = deliverWholeMonth(customerWithSeptemberChanges());
    const row = (billed.deliveries ?? []).find((d) => d.deliveryDate === '2026-09-15');
    expect(row).toMatchObject({ productName: 'Cow Milk', numberOfItems: 3, subscriptionItems: 3 });
  });

  it('sends only the paneer on the day milk was set to zero', () => {
    const billed = deliverWholeMonth(customerWithSeptemberChanges());
    const rows = (billed.deliveries ?? []).filter((d) => d.deliveryDate === '2026-09-20');
    expect(rows.map((d) => d.productName)).toEqual(['Paneer']);
  });

  it('bills the month exactly as before when there are no day changes', () => {
    const billed = deliverWholeMonth(baseCustomer());
    expect(computeCustomerMonthBillTotal(billed, '2026-09')).toBe(30 * 52);
  });

  it('shows the day as due with the right packs on the run sheet and load sheet', () => {
    const c = customerWithSeptemberChanges();

    const guests = buildTodayEntries([c], '2026-09-15');
    expect(guests[0]?.planItems).toEqual(['Cow Milk · 500 ml × 3']);
    expect(guests[0]?.amount).toBe(156);
    expect(loadSheetItemCount(buildLoadSheet(guests))).toBe(3);

    const paneerDay = buildTodayEntries([c], '2026-09-20');
    expect(paneerDay[0]?.planItems).toEqual([]);
    expect(paneerDay[0]?.addOnItems).toEqual(['Paneer · 200 g']);
    expect(paneerDay[0]?.amount).toBe(90);

    expect(buildTodayEntries([c], '2026-09-11')).toEqual([]);
  });
});

describe('billing a day that mixes the subscription and a one-off order of the same pack', () => {
  it('charges the subscription share once and the one-off order once', () => {
    let c = baseCustomer();
    c = { ...c, extraOrders: [extra('extra_milk', '2026-09-05', 'Cow Milk', '500 ml', 52)] };

    const { deliveries, extraOrders } = buildDayStatusDeliveries({ customer: c, ymd: '2026-09-05', next: 'Delivered' });
    c = { ...c, deliveries, extraOrders };

    // One row: 2 packets handed over, 1 of them the subscription.
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({ numberOfItems: 2, subscriptionItems: 1 });
    expect(computeCustomerMonthBillTotal(c, '2026-09')).toBe(104);
  });

  it('charges only the one-off order when the subscription was set to zero that day', () => {
    let c = baseCustomer();
    c = {
      ...c,
      ...setPlanQuantityForDays(c, { planId: 'sub_milk', fromYmd: '2026-09-05', numberOfItems: 0, now: PLANNING_NOW }),
      extraOrders: [extra('extra_milk', '2026-09-05', 'Cow Milk', '500 ml', 52)],
    };

    const { deliveries, extraOrders } = buildDayStatusDeliveries({ customer: c, ymd: '2026-09-05', next: 'Delivered' });
    c = { ...c, deliveries, extraOrders };

    expect(deliveries[0]).toMatchObject({ numberOfItems: 1, subscriptionItems: 0 });
    expect(computeCustomerMonthBillTotal(c, '2026-09')).toBe(52);
  });
});

describe('older delivery rows without pack counts', () => {
  it('bill at the line usual quantity, as they always did', () => {
    const c = {
      ...baseCustomer(),
      subscriptionPlans: [{ ...baseCustomer().subscriptionPlans![0]!, numberOfItems: 2 }],
      deliveries: [
        { id: 'd1', deliveryDate: '2026-09-01', productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Delivered', ...TS },
        { id: 'd2', deliveryDate: '2026-09-02', productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Delivered', ...TS },
      ],
    } as CustomerResponse;

    expect(computeCustomerMonthBillTotal(c, '2026-09')).toBe(2 * 2 * 52);
  });
});
