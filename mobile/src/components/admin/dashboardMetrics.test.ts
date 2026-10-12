import { describe, expect, it } from 'vitest';

import {
  buildMonthRows,
  buildTeamTodayEntries,
  buildTodayEntries,
  computeDashboardAlerts,
  computeMoneyMetrics,
  computeTeamToday,
  computeTodayMetrics,
  filterTeamEntries,
  filterTodayEntries,
  monthBillingBasis,
  monthKeyOf,
  shiftYmd,
  todayYmd,
} from '@/src/components/admin/dashboardMetrics';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { DeliveryBoyResponse } from '@/src/domain/deliveryBoys/dtos';
import type { ProductResponse } from '@/src/domain/products/dtos';

const TODAY = '2026-09-16';
/** Nested records extend EntityBase, so fixtures need timestamps too. */
const TS = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };

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
    subscriptionPlans: [],
    monthlyBillAmount: 900,
    nextDeliveryDate: TODAY,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  } as CustomerResponse;
}

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
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  } as NonNullable<CustomerResponse['subscriptionPlans']>[number];
}

/** Delivered rows for days `from`..`to` of a month. */
function deliveredDays(month: string, from: number, to: number, productName = 'Cow Milk', quantityLabel = '500 ml') {
  const rows = [];
  for (let d = from; d <= to; d += 1) {
    const day = `${month}-${String(d).padStart(2, '0')}`;
    rows.push({ ...TS, id: `d_${productName}_${day}`, deliveryDate: day, productName, quantityLabel, status: 'Delivered' as const });
  }
  return rows;
}

function boy(overrides: Partial<DeliveryBoyResponse> = {}): DeliveryBoyResponse {
  return {
    id: 'db_1',
    fullName: 'Sagar',
    mobileNumber: '9000000001',
    primaryRouteName: 'Route A',
    joiningDate: '2026-01-01',
    status: 'Active',
    salaryType: 'Fixed Monthly Salary',
    monthlySalary: 15000,
    attendance: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as DeliveryBoyResponse;
}

function product(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id: 'prod_1',
    name: 'Cow Milk',
    price: 56,
    unit: 'ml',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as ProductResponse;
}

describe('computeTodayMetrics', () => {
  it('counts due, delivered, missed and what is still left', () => {
    const items = [
      customer({ ...TS, id: 'c1', subscriptionPlans: [plan()] }),
      customer({
        id: 'c2',
        subscriptionPlans: [plan()],
        deliveries: [{ ...TS, id: 'd1', deliveryDate: TODAY, productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Delivered' }],
      }),
      customer({
        id: 'c3',
        subscriptionPlans: [plan()],
        deliveries: [{ ...TS, id: 'd2', deliveryDate: TODAY, productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Missed' }],
      }),
    ] as CustomerResponse[];

    expect(computeTodayMetrics(items, TODAY)).toMatchObject({ due: 3, delivered: 1, notDelivered: 1, remaining: 1 });
  });

  it('counts add-on orders for the day but not cancelled ones', () => {
    const items = [
      customer({
        extraOrders: [
          { ...TS, id: 'o1', orderDate: TODAY, productName: 'Curd', quantityLabel: '200 g', price: 30, status: 'Pending' },
          { ...TS, id: 'o2', orderDate: TODAY, productName: 'Ghee', quantityLabel: '500 ml', price: 300, status: 'Cancelled' },
          { ...TS, id: 'o3', orderDate: '2026-09-15', productName: 'Curd', quantityLabel: '200 g', price: 30, status: 'Pending' },
        ],
      }),
    ] as CustomerResponse[];

    expect(computeTodayMetrics(items, TODAY).addOnOrders).toBe(1);
  });
});

describe('computeMoneyMetrics', () => {
  it('reads money from plans, deliveries and payments — the figures the customer sees', () => {
    const items = [
      // ₹30 a day from 1 Aug. August delivered in full (₹900) and paid; ₹400 paid in September against ₹150 so far.
      customer({
        id: 'c1',
        monthlyBillAmount: 5000,
        pendingAmount: 999,
        subscriptionPlans: [plan({ startDate: '2026-08-01', endDate: undefined, openEnded: true, originalPrice: 30, numberOfItems: 1 })],
        deliveries: [...deliveredDays('2026-08', 1, 30), ...deliveredDays('2026-09', 1, 5)],
        payments: [
          { ...TS, id: 'p1', paymentDate: '2026-09-05T00:00:00.000Z', amountPaid: 400, paymentMode: 'Cash' },
          { ...TS, id: 'p2', paymentDate: '2026-08-05T00:00:00.000Z', amountPaid: 900, paymentMode: 'Cash' },
        ],
      }),
      // Inactive, and still owes for five days at ₹50.
      customer({
        id: 'c2',
        status: 'Inactive',
        subscriptionPlans: [plan({ startDate: '2026-09-01', originalPrice: 50, numberOfItems: 1 })],
        deliveries: deliveredDays('2026-09', 1, 5),
      }),
    ] as CustomerResponse[];

    expect(computeMoneyMetrics(items, monthKeyOf(TODAY), 'expected', TODAY)).toEqual({
      expected: 900,
      collected: 400,
      outstanding: 250,
      outstandingCustomers: 1,
      advances: 250,
    });
  });
});

describe('computeTeamToday', () => {
  it('splits the active team into present, absent and not yet marked', () => {
    const boys = [
      boy({ ...TS, id: 'b1', attendance: [{ ...TS, id: 'a1', date: TODAY, attendanceStatus: 'Present' }] }),
      boy({ ...TS, id: 'b2', attendance: [{ ...TS, id: 'a2', date: TODAY, attendanceStatus: 'Absent' }] }),
      boy({ ...TS, id: 'b3' }),
      boy({ ...TS, id: 'b4', status: 'Inactive' }),
    ] as DeliveryBoyResponse[];

    expect(computeTeamToday(boys, TODAY)).toEqual({ present: 1, absent: 1, unmarked: 1 });
  });
});

describe('computeDashboardAlerts', () => {
  it('reports only the problems that exist', () => {
    const customers = [
      customer({ ...TS, id: 'c1', routeName: '', assignedDeliveryBoyId: '', subscriptionPlans: [plan()] }),
      customer({ ...TS, id: 'c2', subscriptionPlans: [] }),
      customer({ ...TS, id: 'c3', subscriptionPlans: [plan({ productName: 'Buffalo Milk' })] }),
      customer({
        id: 'c4',
        subscriptionPlans: [plan()],
        complaints: [{ ...TS, id: 'x1', complaintDate: TODAY, type: 'Late', status: 'Open' }],
      }),
    ] as CustomerResponse[];

    const alerts = computeDashboardAlerts({
      customers,
      products: [product()] as ProductResponse[],
      boys: [boy()] as DeliveryBoyResponse[],
      ymd: TODAY,
    });
    const byKey = Object.fromEntries(alerts.map((a) => [a.key, a.count]));

    expect(byKey.customersWithoutRoute).toBe(1);
    expect(byKey.customersWithoutPlan).toBe(1);
    // "Buffalo Milk" is not an active product.
    expect(byKey.plansOnInactiveProducts).toBe(1);
    expect(byKey.openComplaints).toBe(1);
    // Every delivery boy has a route, so that row is absent rather than zero.
    expect(byKey.boysWithoutRoute).toBeUndefined();
  });

  it('is empty when the data is clean', () => {
    const clean = [customer({ subscriptionPlans: [plan()] })] as CustomerResponse[];
    const alerts = computeDashboardAlerts({
      customers: clean,
      products: [product()] as ProductResponse[],
      boys: [boy({ attendance: [{ ...TS, id: 'a1', date: TODAY, attendanceStatus: 'Present' }] })] as DeliveryBoyResponse[],
      ymd: TODAY,
    });
    expect(alerts).toEqual([]);
  });
});

describe('todayYmd', () => {
  it('uses the local calendar date', () => {
    expect(todayYmd(new Date(2026, 8, 16, 23, 30))).toBe('2026-09-16');
  });
});

describe('buildTodayEntries', () => {
  const items = [
    customer({
      id: 'c1',
      name: 'Asha',
      subscriptionPlans: [plan()],
      deliveries: [{ ...TS, id: 'd1', deliveryDate: TODAY, productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Delivered' }],
    }),
    customer({
      id: 'c2',
      name: 'Bhavna',
      subscriptionPlans: [plan()],
      deliveries: [{ ...TS, id: 'd2', deliveryDate: TODAY, productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Missed' }],
    }),
    customer({ id: 'c3', name: 'Chetan', subscriptionPlans: [plan()] }),
    customer({
      id: 'c4',
      name: 'Deepa',
      subscriptionPlans: [],
      extraOrders: [{ ...TS, id: 'o1', orderDate: TODAY, productName: 'Curd', quantityLabel: '200 g', price: 30, status: 'Pending' }],
    }),
    customer({ id: 'c5', name: 'Esha', subscriptionPlans: [] }),
  ] as CustomerResponse[];

  it('lists only customers with something happening today, sorted by name', () => {
    const entries = buildTodayEntries(items, TODAY);
    expect(entries.map((e) => e.name)).toEqual(['Asha', 'Bhavna', 'Chetan', 'Deepa']);
  });

  it('marks each row delivered, not delivered or pending', () => {
    const byName = Object.fromEntries(buildTodayEntries(items, TODAY).map((e) => [e.name, e.status]));
    expect(byName).toMatchObject({ Asha: 'Delivered', Bhavna: 'Not delivered', Chetan: 'Pending', Deepa: 'Pending' });
  });

  it('describes the lines behind the row', () => {
    const asha = buildTodayEntries(items, TODAY).find((e) => e.name === 'Asha')!;
    expect(asha.planItems).toEqual(['Cow Milk · 500 ml']);
    const deepa = buildTodayEntries(items, TODAY).find((e) => e.name === 'Deepa')!;
    expect(deepa.addOnItems).toEqual(['Curd · 200 g']);
  });

  it('splits into the four buckets the tiles open', () => {
    const entries = buildTodayEntries(items, TODAY);
    expect(filterTodayEntries(entries, 'due').map((e) => e.name)).toEqual(['Asha', 'Bhavna', 'Chetan']);
    expect(filterTodayEntries(entries, 'delivered').map((e) => e.name)).toEqual(['Asha']);
    expect(filterTodayEntries(entries, 'missed').map((e) => e.name)).toEqual(['Bhavna']);
    expect(filterTodayEntries(entries, 'addons').map((e) => e.name)).toEqual(['Deepa']);
  });

  it('keeps the tile counts and the bucket rows in step', () => {
    const entries = buildTodayEntries(items, TODAY);
    const metrics = computeTodayMetrics(items, TODAY);
    expect(metrics.due).toBe(filterTodayEntries(entries, 'due').length);
    expect(metrics.delivered).toBe(filterTodayEntries(entries, 'delivered').length);
    expect(metrics.notDelivered).toBe(filterTodayEntries(entries, 'missed').length);
  });
});

describe('buildTeamTodayEntries', () => {
  const boys = [
    boy({ id: 'b1', fullName: 'Sagar', attendance: [{ ...TS, id: 'a1', date: TODAY, attendanceStatus: 'Present' }] }),
    boy({ id: 'b2', fullName: 'Nitin', attendance: [{ ...TS, id: 'a2', date: TODAY, attendanceStatus: 'Absent' }] }),
    boy({ id: 'b3', fullName: 'Amit', primaryRouteName: '' }),
    boy({ id: 'b4', fullName: 'Zubin', status: 'Inactive' }),
    boy({ id: 'b5', fullName: 'Kiran', attendance: [{ ...TS, id: 'a3', date: '2026-09-15', attendanceStatus: 'Present' }] }),
  ] as DeliveryBoyResponse[];

  it('lists the active team by name with today resolved', () => {
    const entries = buildTeamTodayEntries(boys, TODAY);
    expect(entries.map((e) => e.name)).toEqual(['Amit', 'Kiran', 'Nitin', 'Sagar']);
  });

  it('treats a missing row for today as not marked, even when older rows exist', () => {
    const byName = Object.fromEntries(buildTeamTodayEntries(boys, TODAY).map((e) => [e.name, e.status]));
    expect(byName).toMatchObject({ Sagar: 'Present', Nitin: 'Absent', Amit: 'Not marked', Kiran: 'Not marked' });
  });

  it('splits into the buckets the dashboard line opens', () => {
    const entries = buildTeamTodayEntries(boys, TODAY);
    expect(filterTeamEntries(entries, 'all')).toHaveLength(4);
    expect(filterTeamEntries(entries, 'present').map((e) => e.name)).toEqual(['Sagar']);
    expect(filterTeamEntries(entries, 'absent').map((e) => e.name)).toEqual(['Nitin']);
    expect(filterTeamEntries(entries, 'unmarked').map((e) => e.name)).toEqual(['Amit', 'Kiran']);
  });

  it('keeps the dashboard counts and the bucket rows in step', () => {
    const entries = buildTeamTodayEntries(boys, TODAY);
    const counts = computeTeamToday(boys, TODAY);
    expect(counts.present).toBe(filterTeamEntries(entries, 'present').length);
    expect(counts.absent).toBe(filterTeamEntries(entries, 'absent').length);
    expect(counts.unmarked).toBe(filterTeamEntries(entries, 'unmarked').length);
  });
});

describe('buildMonthRows', () => {
  const customers = [
    // ₹30 a day since 1 Aug: ₹900 planned for September. Billed ₹1,200 so far, paid ₹950 — ₹250 owed.
    customer({
      id: 'c1',
      name: 'Asha',
      routeName: 'Route A',
      billingType: 'Postpaid',
      subscriptionPlans: [plan({ startDate: '2026-08-01', endDate: undefined, openEnded: true, originalPrice: 30, numberOfItems: 1 })],
      deliveries: [...deliveredDays('2026-08', 1, 30), ...deliveredDays('2026-09', 1, 10)],
      payments: [
        { ...TS, id: 'p1', paymentDate: '2026-09-05T00:00:00.000Z', amountPaid: 300, paymentMode: 'Cash' },
        { ...TS, id: 'p2', paymentDate: '2026-09-12T00:00:00.000Z', amountPaid: 100, paymentMode: 'UPI' },
        { ...TS, id: 'p3', paymentDate: '2026-08-05T00:00:00.000Z', amountPaid: 550, paymentMode: 'Cash' },
      ],
    }),
    // ₹40 a day from 1 Sep: ₹1,200 planned, nothing delivered or owed yet.
    customer({ id: 'c2', name: 'Bhavna', subscriptionPlans: [plan({ originalPrice: 40, numberOfItems: 1 })] }),
    // Inactive: nothing expected, but three delivered days at ₹25 are still owed.
    customer({
      id: 'c3',
      name: 'Inactive One',
      status: 'Inactive',
      subscriptionPlans: [plan({ originalPrice: 25, numberOfItems: 1 })],
      deliveries: deliveredDays('2026-09', 1, 3),
    }),
  ] as CustomerResponse[];
  const boys = [boy({ id: 'b1', fullName: 'Sagar' }), boy({ id: 'b2', fullName: 'Zubin', status: 'Inactive' })] as DeliveryBoyResponse[];
  const input = { customers, boys, monthKey: '2026-09', today: TODAY };

  it('lists expected billing for active customers, largest first', () => {
    const rows = buildMonthRows(input, 'expected');
    expect(rows.map((r) => [r.title, r.amount])).toEqual([
      ['Bhavna', 1200],
      ['Asha', 900],
    ]);
  });

  it('lists the payments of this month newest first, with the mode as the tag', () => {
    const rows = buildMonthRows(input, 'collected');
    expect(rows.map((r) => r.id)).toEqual(['p2', 'p1']);
    expect(rows[0]).toMatchObject({ title: 'Asha', amount: 100, tag: 'UPI', subtitle: '2026-09-12' });
  });

  it('lists every outstanding balance, including inactive customers', () => {
    const rows = buildMonthRows(input, 'outstanding');
    expect(rows.map((r) => [r.title, r.amount])).toEqual([
      ['Asha', 250],
      ['Inactive One', 75],
    ]);
  });

  it('lists the active team for payroll and opens the delivery boy', () => {
    const rows = buildMonthRows(input, 'payroll');
    expect(rows.map((r) => r.title)).toEqual(['Sagar']);
    expect(rows[0]!.target).toEqual({ kind: 'deliveryBoy', id: 'b1' });
  });

  it('opens the customer behind a money row', () => {
    expect(buildMonthRows(input, 'expected')[0]!.target).toEqual({ kind: 'customer', id: 'c2' });
  });

  it('keeps the tile totals and the row amounts in step', () => {
    const totals = computeMoneyMetrics(customers, '2026-09', 'expected', TODAY);
    const sum = (bucket: 'expected' | 'collected' | 'outstanding') =>
      buildMonthRows(input, bucket).reduce((acc, r) => acc + r.amount, 0);
    expect(sum('expected')).toBe(totals.expected);
    expect(sum('collected')).toBe(totals.collected);
    expect(sum('outstanding')).toBe(totals.outstanding);
  });
});

describe('looking at earlier periods', () => {
  it('steps a day across month and year boundaries', () => {
    expect(shiftYmd('2026-09-16', -1)).toBe('2026-09-15');
    expect(shiftYmd('2026-09-01', -1)).toBe('2026-08-31');
    expect(shiftYmd('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftYmd('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('bills a settled month from deliveries, and the running month from the monthly bill', () => {
    expect(monthBillingBasis('2026-09', '2026-09')).toBe('expected');
    expect(monthBillingBasis('2026-08', '2026-09')).toBe('billed');
  });

  it('reads an earlier day from the same records', () => {
    const items = [
      customer({
        id: 'c1',
        name: 'Asha',
        subscriptionPlans: [plan({ startDate: '2026-09-01', endDate: '2026-09-30' })],
        deliveries: [
          { ...TS, id: 'd1', deliveryDate: '2026-09-15', productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Delivered' },
          { ...TS, id: 'd2', deliveryDate: '2026-09-14', productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Missed' },
        ],
      }),
    ] as CustomerResponse[];

    expect(computeTodayMetrics(items, '2026-09-15')).toMatchObject({ due: 1, delivered: 1, notDelivered: 0 });
    expect(computeTodayMetrics(items, '2026-09-14')).toMatchObject({ due: 1, delivered: 0, notDelivered: 1 });
    expect(computeTodayMetrics(items, '2026-09-13')).toMatchObject({ due: 1, delivered: 0, notDelivered: 0 });
  });

  it('reads an earlier month of payments', () => {
    const items = [
      customer({
        id: 'c1',
        payments: [
          { ...TS, id: 'p1', paymentDate: '2026-09-05T00:00:00.000Z', amountPaid: 400, paymentMode: 'Cash' },
          { ...TS, id: 'p2', paymentDate: '2026-08-05T00:00:00.000Z', amountPaid: 900, paymentMode: 'Cash' },
        ],
      }),
    ] as CustomerResponse[];

    expect(computeMoneyMetrics(items, '2026-09').collected).toBe(400);
    expect(computeMoneyMetrics(items, '2026-08').collected).toBe(900);
  });

  it('bills a past month from what was delivered, not from the current monthly bill', () => {
    const items = [
      customer({
        id: 'c1',
        monthlyBillAmount: 5000,
        subscriptionPlans: [plan({ startDate: '2026-08-01', endDate: '2026-08-31', originalPrice: 30, numberOfItems: 1 })],
        deliveries: [
          { ...TS, id: 'd1', deliveryDate: '2026-08-03', productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Delivered' },
          { ...TS, id: 'd2', deliveryDate: '2026-08-04', productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Delivered' },
        ],
      }),
    ] as CustomerResponse[];

    const billed = computeMoneyMetrics(items, '2026-08', 'billed').expected;
    expect(billed).toBeGreaterThan(0);
    expect(billed).toBeLessThan(5000);
    // The running month is what is planned for it — nothing, the plan ended in August — not a stale stored bill.
    expect(computeMoneyMetrics(items, '2026-09', 'expected', TODAY).expected).toBe(0);
  });
});
