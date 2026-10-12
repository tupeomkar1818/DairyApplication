import { describe, expect, it } from 'vitest';

import { buildBillingTimeline, summarizeBilling } from '@/src/components/admin/billingTimeline';
import { computeCustomerMonthBillTotal } from '@/src/components/admin/customerSubscriptionMonthUtils';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { DeliveryBoyResponse } from '@/src/domain/deliveryBoys/dtos';
import type { Offer } from '@/src/domain/offers/entities';
import type { ProductResponse } from '@/src/domain/products/dtos';
import { reportsFor, type ReportAudience } from '@/src/domain/reports/catalog';
import { deliveredLinesForCustomer, type ReportData } from '@/src/domain/reports/data';
import {
  daysOfRange,
  formatRange,
  matchPreset,
  monthsOfRange,
  presetRange,
  previousRange,
  trendBuckets,
  validateRange,
} from '@/src/domain/reports/dateRange';
import { buildDeliveriesReport, buildDispatchReport } from '@/src/domain/reports/deliveryReports';
import { reportFileName, reportToCsv, reportToHtml } from '@/src/domain/reports/export';
import { buildCollectionsReport, buildDuesReport } from '@/src/domain/reports/moneyReports';
import { buildOffersReport } from '@/src/domain/reports/offerReports';
import { buildProductSalesReport, buildSalesReport, buildTaxReport } from '@/src/domain/reports/salesReports';
import { buildBillsReport, buildStatementReport } from '@/src/domain/reports/statementReports';
import { buildAttendanceReport, buildSalaryReport } from '@/src/domain/reports/teamReports';

const TODAY = '2026-09-17';
const TS = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };

type ExtraOrder = NonNullable<CustomerResponse['extraOrders']>[number];

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
    assignedDeliveryBoyId: 'db_1',
    subscription: [],
    monthlyBillAmount: 0,
    nextDeliveryDate: TODAY,
    subscriptionPlans: [
      {
        ...TS,
        id: 'sub_1',
        productName: 'Cow Milk',
        quantityLabel: '500 ml',
        numberOfItems: 1,
        originalPrice: 30,
        deliveryTime: 'Morning',
        frequency: 'Daily',
        startDate: '2026-09-01',
        openEnded: true,
        status: 'Active',
      },
    ] as CustomerResponse['subscriptionPlans'],
    deliveries: [
      { ...TS, id: 'd1', deliveryDate: '2026-09-01', productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Delivered', subscriptionItems: 1, numberOfItems: 1, deliveryBoyName: 'Sagar' },
      // Two packs of the subscription, plus two add-on packs of the same milk that day.
      { ...TS, id: 'd2', deliveryDate: '2026-09-02', productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Delivered', subscriptionItems: 2, numberOfItems: 4 },
      { ...TS, id: 'd3', deliveryDate: '2026-09-03', productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Missed', missedReason: 'Door locked', deliveryBoyName: 'Sagar' },
      // A row written before per-day quantities existed bills at the usual quantity.
      { ...TS, id: 'd5', deliveryDate: '2026-09-05', productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Delivered' },
    ],
    extraOrders: [
      { ...TS, id: 'x1', orderDate: '2026-09-02', productName: 'Cow Milk', quantityLabel: '500 ml', numberOfItems: 2, price: 25, status: 'Delivered', placedBy: 'customer' },
      { ...TS, id: 'x2', orderDate: '2026-09-18', productName: 'Paneer', quantityLabel: '200 g', numberOfItems: 1, price: 90, status: 'Pending', placedBy: 'admin' },
    ],
    subscriptionExceptions: [
      { ...TS, id: 'ex1', kind: 'skip', fromYmd: '2026-09-04', toYmd: '2026-09-04', reason: 'Travelling', createdBy: 'customer' },
    ],
    payments: [
      { ...TS, id: 'p1', paymentDate: '2026-09-05T10:00:00.000Z', amountPaid: 60, paymentMode: 'UPI' },
      { ...TS, id: 'p2', paymentDate: '2026-08-20', amountPaid: 10, paymentMode: 'Cash', collectedBy: 'Sagar' },
    ],
    complaints: [],
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
    ...overrides,
  } as CustomerResponse;
}

function boy(overrides: Partial<DeliveryBoyResponse> = {}): DeliveryBoyResponse {
  return {
    id: 'db_1',
    fullName: 'Sagar',
    mobileNumber: '9000000001',
    primaryRouteName: 'Route A',
    assignedRoutes: ['Route A'],
    joiningDate: '2026-01-01',
    status: 'Active',
    salaryType: 'Attendance Based Salary',
    perDaySalary: 500,
    attendance: [
      { ...TS, id: 'a1', date: '2026-09-01', attendanceStatus: 'Present' },
      { ...TS, id: 'a2', date: '2026-09-02', attendanceStatus: 'Absent' },
      { ...TS, id: 'a3', date: '2026-09-03', attendanceStatus: 'Present' },
    ],
    salaryHistory: [
      {
        ...TS,
        id: 's1',
        salaryMonth: '2026-09',
        salaryType: 'Attendance Based Salary',
        baseSalary: 0,
        finalSalary: 1000,
        paidAmount: 300,
        paymentStatus: 'Partial',
        advanceSalaryEntries: [{ ...TS, id: 'adv1', date: '2026-09-04', amount: 200, paymentMode: 'Cash' }],
        payments: [{ ...TS, id: 'pay1', date: '2026-09-10', amountPaid: 300, paymentMode: 'UPI', remainingPendingAmount: 500, status: 'Partial' }],
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as DeliveryBoyResponse;
}

const products = [
  { id: 'p_milk', name: 'Cow Milk', unit: 'ml', price: 30, isActive: true, taxApplicable: true, taxPercentage: '5%', packs: [{ id: 'pk', label: '500 ml', unit: 'ml', quantity: 500, price: 30, isActive: true }], ...TS },
] as unknown as ProductResponse[];

function data(overrides: Partial<ReportData> = {}): ReportData {
  return { customers: [customer()], boys: [boy()], products, notifications: [], offers: [], today: TODAY, nowIso: `${TODAY}T09:00:00.000Z`, ...overrides };
}

const SEPT = { fromYmd: '2026-09-01', toYmd: '2026-09-17' };

describe('date ranges', () => {
  const thursday = new Date(2026, 8, 17, 10, 0);

  it('resolves presets on the local calendar, weeks starting Monday', () => {
    expect(presetRange('today', thursday)).toEqual({ fromYmd: '2026-09-17', toYmd: '2026-09-17' });
    expect(presetRange('thisWeek', thursday)).toEqual({ fromYmd: '2026-09-14', toYmd: '2026-09-17' });
    expect(presetRange('lastMonth', thursday)).toEqual({ fromYmd: '2026-08-01', toYmd: '2026-08-31' });
    expect(presetRange('tomorrow', thursday)).toEqual({ fromYmd: '2026-09-18', toYmd: '2026-09-18' });
    expect(matchPreset({ fromYmd: '2026-09-01', toYmd: '2026-09-17' }, thursday)).toBe('thisMonth');
    expect(matchPreset({ fromYmd: '2026-09-02', toYmd: '2026-09-17' }, thursday)).toBe('custom');
  });

  it('validates and walks ranges', () => {
    expect(validateRange({ fromYmd: '2026-09-10', toYmd: '2026-09-01' })).toMatch(/on or before/);
    expect(validateRange({ fromYmd: '2025-01-01', toYmd: '2026-09-01' })).toMatch(/366/);
    expect(daysOfRange({ fromYmd: '2026-02-27', toYmd: '2026-03-02' })).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    expect(monthsOfRange({ fromYmd: '2025-12-15', toYmd: '2026-02-01' })).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(previousRange({ fromYmd: '2026-09-11', toYmd: '2026-09-20' })).toEqual({ fromYmd: '2026-09-01', toYmd: '2026-09-10' });
    expect(formatRange({ fromYmd: '2025-12-15', toYmd: '2026-01-10' })).toBe('15 Dec 2025 – 10 Jan 2026');
  });

  it('buckets long ranges by week, then by month', () => {
    expect(trendBuckets(SEPT)).toHaveLength(17);
    expect(trendBuckets({ fromYmd: '2026-06-01', toYmd: '2026-08-31' }).length).toBeLessThanOrEqual(14);
    expect(trendBuckets({ fromYmd: '2025-10-01', toYmd: '2026-09-17' })).toHaveLength(12);
  });
});

describe('delivered lines follow the bill', () => {
  it('adds up to the month bill total', () => {
    const c = customer();
    const lines = deliveredLinesForCustomer(c);
    const sept = lines.filter((l) => l.ymd.startsWith('2026-09')).reduce((s, l) => s + l.amount, 0);
    expect(Math.round(sept)).toBe(computeCustomerMonthBillTotal(c, '2026-09'));
    // 30 + 60 (two packs) + 30 (legacy row) + 50 add-on
    expect(Math.round(sept)).toBe(170);
  });
});

describe('sales reports', () => {
  it('totals subscription and add-on sales, grouped by route', () => {
    const doc = buildSalesReport(data(), SEPT, {});
    expect(doc.stats.find((s) => s.label === 'Total sales')?.value).toBe(170);
    expect(doc.stats.find((s) => s.label === 'Add-on orders')?.value).toBe(50);
    expect(doc.tables.find((t) => t.id === 'byRoute')?.rows[0]).toMatchObject({ name: 'Route A', total: 170 });
    expect(doc.tables.find((t) => t.id === 'byBoy')?.rows[0]).toMatchObject({ name: 'Sagar' });
  });

  it('filters by route', () => {
    const doc = buildSalesReport(data(), SEPT, { route: 'Route B' });
    expect(doc.stats[0]?.value).toBe(0);
  });

  it('counts packs and litres per product', () => {
    const doc = buildProductSalesReport(data(), SEPT, {});
    // 1 + 2 + 1 subscription packs + 2 add-on packs of 500 ml = 3 L
    expect(doc.stats.find((s) => s.label === 'Packs delivered')?.value).toBe(6);
    expect(doc.stats.find((s) => s.label === 'Litres')?.value).toBe(3);
    expect(doc.tables.find((t) => t.id === 'byPack')?.rows[0]).toMatchObject({ subscriptionPacks: 4, addonPacks: 2, quantity: '3 L' });
  });

  it('takes tax out of tax-inclusive prices', () => {
    const doc = buildTaxReport(data(), SEPT, {});
    const tax = doc.stats.find((s) => s.label === 'Tax included')?.value as number;
    expect(Math.round(tax * 100) / 100).toBe(8.1);
  });
});

describe('delivery reports', () => {
  it('counts delivered, not delivered, not marked and paused', () => {
    const doc = buildDeliveriesReport(data(), SEPT, {});
    const stat = (label: string) => doc.stats.find((s) => s.label === label)?.value;
    expect(stat('Delivered')).toBe(3);
    expect(stat('Not delivered')).toBe(1);
    // 17 days, minus the paused 4th = 16 stops; 3 delivered + 1 missed + today's stop still to come leaves 11 unmarked.
    expect(stat('Stops')).toBe(16);
    expect(stat('Not marked')).toBe(11);
    expect(stat('Lines paused')).toBe(1);
    expect(doc.tables.find((t) => t.id === 'missed')?.rows[0]).toMatchObject({ reason: 'Door locked', by: 'Sagar' });
  });

  it('plans upcoming days on the load sheet, add-ons included', () => {
    const doc = buildDispatchReport(data(), { fromYmd: '2026-09-18', toYmd: '2026-09-18' }, {});
    expect(doc.stats.find((s) => s.label === 'Packs to load')?.value).toBe(2);
    expect(doc.tables[0]?.rows.map((r) => r.item)).toEqual(['Cow Milk · 500 ml', 'Paneer · 200 g']);
  });
});

describe('money reports', () => {
  it('collects payments by the day they were paid', () => {
    const doc = buildCollectionsReport(data(), SEPT, {});
    expect(doc.stats[0]?.value).toBe(60);
    expect(doc.tables.find((t) => t.id === 'byMode')?.rows).toEqual([{ name: 'UPI', payments: 1, amount: 60, share: 100 }]);
    expect(buildCollectionsReport(data(), SEPT, { mode: 'Cash' }).stats[0]?.value).toBe(0);
  });

  it('reads dues from the billing timeline as of the range end', () => {
    const c = customer();
    const expected = summarizeBilling(c, buildBillingTimeline(c, '2026-09'), TODAY).outstanding;
    const doc = buildDuesReport(data(), SEPT, {});
    expect(doc.stats[0]?.value).toBe(expected);
    // Before the 5 Sep payment: 140 billed by then (30, then 60 + the 50 add-on), 10 paid in August.
    const early = buildDuesReport(data(), { fromYmd: '2026-09-01', toYmd: '2026-09-02' }, {});
    expect(early.stats[0]?.value).toBe(130);
  });
});

describe('customer reports', () => {
  it('needs one customer', () => {
    const two = data({ customers: [customer(), customer({ id: 'cust_2', name: 'Ravi' })] });
    expect(buildStatementReport(two, SEPT, {}).tables).toHaveLength(0);
    expect(buildStatementReport(two, SEPT, { customer: 'cust_2' }).subject).toContain('Ravi');
  });

  it('lists deliveries and the days that did not happen', () => {
    const doc = buildStatementReport(data(), SEPT, { customer: 'cust_1' });
    expect(doc.stats[0]?.value).toBe(170);
    const exceptions = doc.tables.find((t) => t.id === 'exceptions')?.rows ?? [];
    expect(exceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-09-03', status: 'Not delivered' }),
        expect.objectContaining({ date: '2026-09-04', status: 'Paused · Travelling' }),
      ]),
    );
  });

  it('shows monthly bills for the months the range touches', () => {
    const doc = buildBillsReport(data(), SEPT, { customer: 'cust_1' });
    expect(doc.tables[0]?.rows.map((r) => r.month)).toEqual(['2026-09']);
    expect(doc.tables[0]?.rows[0]).toMatchObject({ charges: 170 });
  });
});

describe('team reports', () => {
  it('counts attendance and pay inside the range', () => {
    const att = buildAttendanceReport(data(), SEPT, {});
    expect(att.stats.find((s) => s.label === 'Present days')?.value).toBe(2);
    expect(att.stats.find((s) => s.label === 'Absent days')?.value).toBe(1);

    const sal = buildSalaryReport(data(), SEPT, {});
    expect(sal.stats.find((s) => s.label === 'Earned in period')?.value).toBe(1000);
    expect(sal.stats.find((s) => s.label === 'Advances paid')?.value).toBe(200);
    expect(sal.stats.find((s) => s.label === 'Salary paid')?.value).toBe(300);
  });
});

describe('export', () => {
  it('writes a CSV spreadsheets can read, and a printable page', () => {
    const doc = buildCollectionsReport(data({ customers: [customer({ name: 'Asha, "Didi"' })] }), SEPT, {});
    const csv = reportToCsv(doc);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Asha, ""Didi"""');
    expect(csv).toContain('2026-09-05');
    const page = reportToHtml(doc);
    expect(page).toContain('<h1>Collections</h1>');
    expect(page).toContain('Asha, &quot;Didi&quot;');
    expect(reportFileName(doc, 'pdf')).toBe('collections-2026-09-01-to-2026-09-17.pdf');
  });
});

describe('offers in reports', () => {
  /** ₹50 off every monthly bill. */
  const flat: Offer = {
    ...TS,
    id: 'flat',
    kind: 'bill',
    title: { en: 'Festival offer', mr: 'सण ऑफर' },
    startYmd: '2026-09-01',
    endYmd: '2026-09-30',
    discount: { type: 'flat', value: 50 },
  };
  const box: Offer = {
    ...TS,
    id: 'box',
    kind: 'combo',
    title: { en: 'Diwali box' },
    startYmd: '2026-09-01',
    endYmd: '2026-09-30',
    comboItems: [
      { productId: 'p1', packId: 'ghee', productName: 'Ghee', packLabel: '500 ml', quantity: 1, listPrice: 450 },
      { productId: 'p2', packId: 'paneer', productName: 'Paneer', packLabel: '200 g', quantity: 2, listPrice: 100 },
    ],
    comboPrice: 599,
  };
  const later: Offer = { ...flat, id: 'later', startYmd: '2026-11-01', endYmd: '2026-11-30' };
  const comboOrder = (overrides: Partial<ExtraOrder> = {}): ExtraOrder =>
    ({
      ...TS,
      id: 'combo_1',
      orderDate: '2026-09-10',
      deliveryDate: '2026-09-10',
      productName: 'Diwali box',
      quantityLabel: 'Combo',
      numberOfItems: 2,
      price: 599,
      offer: { offerId: 'box', kind: 'combo', title: { en: 'Diwali box' }, listPrice: 650 },
      comboItems: [
        { productName: 'Ghee', packLabel: '500 ml', quantity: 1 },
        { productName: 'Paneer', packLabel: '200 g', quantity: 2 },
      ],
      status: 'Delivered',
      placedBy: 'customer',
      ...overrides,
    }) as ExtraOrder;

  function withOffers() {
    const base = customer();
    const c = customer({
      extraOrders: [...(base.extraOrders ?? []), comboOrder(), comboOrder({ id: 'combo_2', status: 'Pending', deliveryDate: '2026-09-16', orderDate: '2026-09-16' })],
    });
    return data({ customers: [c], offers: [flat, box, later] });
  }

  it('takes offer discounts off the bills in dues, matching the billing timeline', () => {
    const d = withOffers();
    const c = d.customers[0]!;
    const expected = summarizeBilling(c, buildBillingTimeline(c, '2026-09', { offers: d.offers }), TODAY).outstanding;
    const doc = buildDuesReport(d, SEPT, {});
    expect(doc.stats[0]?.value).toBe(expected);
    expect(doc.stats.find((s) => s.label === 'Offer discounts')?.value).toBe(0); // Sept bill date (30th) is after the range.
    const whole = buildDuesReport({ ...d, today: '2026-10-05' }, { fromYmd: '2026-09-01', toYmd: '2026-09-30' }, {});
    const bill = whole.tables.find((t) => t.id === 'bills')?.rows[0];
    // 170 delivered + 2 combos × 599 = 1368, less the ₹50 offer.
    expect(bill).toMatchObject({ offerDiscount: 50, charges: 1318 });
  });

  it('shows offer discounts next to sales, and one-off orders at the offer price', () => {
    const doc = buildSalesReport(withOffers(), SEPT, {});
    const stat = (label: string) => doc.stats.find((s) => s.label === label)?.value;
    expect(stat('Total sales')).toBe(170 + 1198);
    expect(stat('Offer discounts')).toBe(50);
    expect(stat('After offer discounts')).toBe(170 + 1198 - 50);
    expect(doc.tables.find((t) => t.id === 'topCustomers')?.rows[0]).toMatchObject({ total: 1368, offerDiscount: 50, net: 1318 });
    // No offers at all: no offer columns or figures.
    expect(buildSalesReport(data(), SEPT, {}).stats.find((s) => s.label === 'Offer discounts')).toBeUndefined();
  });

  it('lists offer discount lines and savings on the customer bills', () => {
    const doc = buildBillsReport(withOffers(), SEPT, { customer: 'cust_1' });
    expect(doc.tables[0]?.rows[0]).toMatchObject({ offerDiscount: 50, charges: 1318 });
    expect(doc.tables.find((t) => t.id === 'offers')?.rows).toEqual([{ month: '2026-09', offer: 'Offer: Festival offer', amount: -50 }]);
    // (650 − 599) × 2 on the delivered combos + ₹50 off the bill.
    expect(doc.stats.find((s) => s.label === 'Saved with offers')?.value).toBe(152);
    const mine = reportsFor('customer').find((r) => r.id === 'myBills')!.build(withOffers(), SEPT, { customer: 'cust_1' });
    expect(mine.stats.find((s) => s.label === 'You saved')?.value).toBe(152);
    const items = doc.tables.find((t) => t.id === 'items')?.rows ?? [];
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ item: 'Diwali box (Ghee · 500 ml, Paneer · 200 g × 2)', type: 'Add-on · Offer: Diwali box', packs: 2, amount: 1198 }),
      ]),
    );
  });

  it('reports each offer: orders, sales at the offer price, savings and bill discounts', () => {
    const doc = buildOffersReport(withOffers(), SEPT, {});
    const rows = doc.tables.find((t) => t.id === 'offers')?.rows ?? [];
    // `later` starts after the range and is left out.
    expect(rows.map((r) => r.offer)).toEqual(['Diwali box', 'Festival offer']);
    expect(rows.find((r) => r.offer === 'Diwali box')).toMatchObject({
      kind: 'Combo offer',
      status: 'Live',
      from: '2026-09-01',
      to: '2026-09-30',
      orders: 2,
      deliveredOrders: 1,
      packs: 2,
      sales: 1198,
      savings: 102,
      billDiscounts: 0,
      customers: 1,
    });
    expect(rows.find((r) => r.offer === 'Festival offer')).toMatchObject({ kind: 'Bill discount', orders: 0, billDiscounts: 50, customers: 1 });
    const stat = (label: string) => doc.stats.find((s) => s.label === label)?.value;
    expect(stat('Sales at offer price')).toBe(1198);
    expect(stat('Total saved by customers')).toBe(152);
    expect(stat('Customers reached')).toBe(1);
    expect(doc.tables.find((t) => t.id === 'billDiscountsByMonth')?.rows).toEqual([
      { month: '2026-09', offer: 'Festival offer', customers: 1, amount: 50 },
    ]);
    expect(doc.notes?.some((n) => n.includes('by bill month'))).toBe(true);
    // Exports like any other report.
    expect(reportToCsv(doc)).toContain('Diwali box');
    expect(reportFileName(doc, 'csv')).toBe('offers-2026-09-01-to-2026-09-17.csv');
    // A route with no customers still lists the offers, with nothing against them.
    const other = buildOffersReport(withOffers(), SEPT, { route: 'Route B' });
    expect(other.tables[0]?.rows.map((r) => r.orders)).toEqual([0, 0]);
  });

  it('marks orders under an offer on the statement', () => {
    const doc = buildStatementReport(withOffers(), SEPT, { customer: 'cust_1' });
    expect(doc.stats.find((s) => s.label === 'Saved on offer orders')?.value).toBe(102);
    const combo = doc.tables.find((t) => t.id === 'lines')?.rows.find((r) => r.date === '2026-09-10');
    expect(combo).toMatchObject({ item: 'Diwali box (Ghee · 500 ml, Paneer · 200 g × 2)', packs: 2, amount: 1198 });
  });
});

describe('every catalogued report runs', () => {
  const audiences: ReportAudience[] = ['admin', 'delivery', 'customer'];
  const ranges = [SEPT, { fromYmd: '2025-10-01', toYmd: '2026-09-30' }, { fromYmd: TODAY, toYmd: TODAY }];

  for (const audience of audiences) {
    for (const def of reportsFor(audience)) {
      it(`${audience}: ${def.title}`, () => {
        const d = data();
        const filters = { customer: 'cust_1', boy: 'db_1' };
        for (const range of ranges) {
          const doc = def.build(d, range, filters);
          expect(doc.title).toBeTruthy();
          expect(() => reportToHtml(doc)).not.toThrow();
          expect(() => reportToCsv(doc)).not.toThrow();
          for (const t of doc.tables) for (const row of t.rows) for (const col of t.columns) expect(row).toHaveProperty(col.key);
        }
        // Filter options build from the data without throwing.
        expect(Array.isArray(def.filters(d))).toBe(true);
        // Empty data never crashes a report.
        expect(() => def.build(data({ customers: [], boys: [], products: [] }), SEPT, {})).not.toThrow();
        // Nor does a running offer.
        const offer = { ...TS, id: 'o1', kind: 'bill', title: { en: 'Sale' }, startYmd: '2026-09-01', discount: { type: 'flat', value: 10 } } as Offer;
        for (const range of ranges) {
          const doc = def.build(data({ offers: [offer] }), range, filters);
          for (const t of doc.tables) for (const row of t.rows) for (const col of t.columns) expect(row).toHaveProperty(col.key);
        }
      });
    }
  }
});
