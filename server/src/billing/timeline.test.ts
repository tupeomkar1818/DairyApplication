import { describe, expect, it } from 'vitest';

import { billDateForMonth, buildBillingTimeline, firstBillingMonth, summarizeBilling } from '@/billing/timeline';
import type { Customer, Plan } from '@/customers/mapping';
import type { Row } from '@/customers/selfService';

/**
 * The same cases as the apps' own billing tests (`mobile/src/components/admin/billingTimeline.test.ts`), with the
 * same numbers. This is a port, so the numbers are the test: a difference here is a bill that does not match the
 * one the customer is reading.
 */

const TS = { createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' };
const TODAY = '2026-09-16';

/** Cow Milk 500 ml at ₹52 a day, subscribed from 1 Aug. */
function customer(over: Partial<Customer> = {}): Customer {
  return {
    id: 'cust_1',
    name: 'Asha',
    mobile: '9876543210',
    status: 'Active',
    subscriptionStartDate: '2026-08-01',
    subscriptionPlans: [
      {
        id: 'sub_milk',
        productName: 'Cow Milk',
        quantityLabel: '500 ml',
        numberOfItems: 1,
        deliveryTime: 'Morning',
        frequency: 'Daily',
        startDate: '2026-08-01',
        openEnded: true,
        originalPrice: 56,
        discountedPrice: 52,
        status: 'Active',
        ...TS,
      } as Plan,
    ],
    extraOrders: [],
    subscriptionExceptions: [],
    deliveries: [],
    payments: [],
    ...TS,
    ...over,
  };
}

/** Milk delivered on these days of a month. */
function delivered(month: string, days: number[]): Row[] {
  return days.map((day) => ({
    id: `d_${month}_${day}`,
    deliveryDate: `${month}-${String(day).padStart(2, '0')}`,
    productName: 'Cow Milk',
    quantityLabel: '500 ml',
    status: 'Delivered',
    ...TS,
  }));
}

function paid(date: string, amount: number): Row {
  return { id: `p_${date}_${amount}`, paymentDate: date, amountPaid: amount, paymentMode: 'Cash', ...TS };
}

const tenAugustDays = delivered('2026-08', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // ₹520
const fiveSeptemberDays = delivered('2026-09', [1, 2, 3, 4, 5]); // ₹260

describe('an unpaid bill from last month', () => {
  const c = customer({ deliveries: [...tenAugustDays, ...fiveSeptemberDays] });

  it('is carried into this month', () => {
    const [sep, aug] = buildBillingTimeline(c, '2026-09');
    expect(aug).toMatchObject({ month: '2026-08', baseAmount: 520, carryForwardIn: 0, invoiceTotal: 520, pending: 520, status: 'Pending' });
    expect(sep).toMatchObject({ month: '2026-09', baseAmount: 260, carryForwardIn: 520, invoiceTotal: 780, pending: 780 });
  });

  it('shows the total owed, and the overdue part of it', () => {
    const summary = summarizeBilling(c, '2026-09', TODAY);
    // August's bill (31 Aug) was due 15 Sep.
    expect(summary.outstanding).toBe(780);
    expect(summary.overdue).toBe(520);
    expect(summary.unpaid).toEqual([
      expect.objectContaining({ month: '2026-08', amount: 520, issued: true, overdue: true }),
      expect.objectContaining({ month: '2026-09', amount: 260, issued: false, overdue: false }),
    ]);
  });
});

describe('payments', () => {
  it('settle the oldest bill first, even when made in a later month', () => {
    const c = customer({ deliveries: [...tenAugustDays, ...fiveSeptemberDays], payments: [paid('2026-09-10', 520)] });
    const [sep, aug] = buildBillingTimeline(c, '2026-09');
    expect(aug).toMatchObject({ paidApplied: 520, pending: 0, status: 'Paid' });
    expect(sep).toMatchObject({ carryForwardIn: 0, invoiceTotal: 260, pending: 260 });
    expect(summarizeBilling(c, '2026-09', TODAY)).toMatchObject({ outstanding: 260, overdue: 0 });
  });

  it('leave the unpaid rest of an old bill overdue after a part payment', () => {
    const c = customer({ deliveries: [...tenAugustDays, ...fiveSeptemberDays], payments: [paid('2026-09-05', 300)] });
    const timeline = buildBillingTimeline(c, '2026-09');
    expect(timeline[1]).toMatchObject({ paidApplied: 300, pending: 220, status: 'Partial' });
    expect(timeline[0]).toMatchObject({ carryForwardIn: 220, invoiceTotal: 480, pending: 480 });

    const summary = summarizeBilling(c, '2026-09', TODAY);
    expect(summary.outstanding).toBe(480);
    expect(summary.unpaid.map((bill) => [bill.month, bill.amount, bill.overdue])).toEqual([
      ['2026-08', 220, true],
      ['2026-09', 260, false],
    ]);
    expect(summary.overdue).toBe(220);
  });

  it('can pay several bills at once', () => {
    const c = customer({ deliveries: [...tenAugustDays, ...fiveSeptemberDays], payments: [paid('2026-09-15', 780)] });
    expect(buildBillingTimeline(c, '2026-09').map((row) => row.status)).toEqual(['Paid', 'Paid']);
    expect(summarizeBilling(c, '2026-09', TODAY)).toMatchObject({ outstanding: 0, overdue: 0, unpaid: [] });
  });

  it('keep what is paid beyond the bills as an advance for the next ones', () => {
    const c = customer({ deliveries: tenAugustDays, payments: [paid('2026-08-20', 1000)] });
    expect(summarizeBilling(c, '2026-09', TODAY)).toMatchObject({ outstanding: 0, advance: 480 });

    const later = customer({ deliveries: [...tenAugustDays, ...fiveSeptemberDays], payments: [paid('2026-08-20', 1000)] });
    expect(buildBillingTimeline(later, '2026-09')[0]).toMatchObject({ paidApplied: 260, pending: 0, status: 'Paid' });
    expect(summarizeBilling(later, '2026-09', TODAY)).toMatchObject({ outstanding: 0, advance: 220 });
  });
});

describe('the months billed', () => {
  it('reach back to the first activity, however long ago, so an old unpaid bill is not lost', () => {
    const c = customer({
      subscriptionStartDate: undefined,
      subscriptionPlans: (customer().subscriptionPlans ?? []).map((plan) => ({ ...plan, startDate: '2025-12-01' })),
      deliveries: [...delivered('2025-12', [1, 2]), ...fiveSeptemberDays],
    });
    expect(firstBillingMonth(c, '2026-09')).toBe('2025-12');

    const summary = summarizeBilling(c, '2026-09', TODAY);
    expect(summary.outstanding).toBe(104 + 260);
    expect(summary.unpaid[0]).toMatchObject({ month: '2025-12', amount: 104, overdue: true });
  });

  it('start this month for a brand-new customer', () => {
    const c = customer({ subscriptionStartDate: undefined, subscriptionPlans: [] });
    expect(firstBillingMonth(c, '2026-09')).toBe('2026-09');
    expect(buildBillingTimeline(c, '2026-09')).toHaveLength(1);
  });
});

describe('charges on a bill', () => {
  it('include delivered one-off orders', () => {
    const c = customer({
      deliveries: fiveSeptemberDays,
      extraOrders: [
        { id: 'x', orderDate: '2026-09-03', productName: 'Paneer', quantityLabel: '200 g', price: 90, status: 'Delivered', ...TS },
        { id: 'y', orderDate: '2026-09-04', productName: 'Curd', quantityLabel: '500 g', price: 40, status: 'Pending', ...TS },
      ],
    });
    expect(buildBillingTimeline(c, '2026-09')[0]!.baseAmount).toBe(260 + 90);
  });

  it('take off the discount each month, never below zero', () => {
    const c = customer({ deliveries: [...tenAugustDays, ...delivered('2026-09', [1])], discountAmount: 100 });
    const [sep, aug] = buildBillingTimeline(c, '2026-09');
    expect(aug!.baseAmount).toBe(420);
    expect(sep!.baseAmount).toBe(0);
  });

  it('bill the packs a day recorded, not the line’s usual', () => {
    const c = customer({
      deliveries: delivered('2026-09', [1, 2]).map((row, index) => (index === 0 ? { ...row, subscriptionItems: 3 } : row)),
    });
    // One day at 3 packs (₹156) and one recorded before per-day quantities existed (₹52).
    expect(buildBillingTimeline(c, '2026-09')[0]!.baseAmount).toBe(208);
  });

  it('are dated on the customer’s billing day, and due 15 days later', () => {
    expect(billDateForMonth('2026-09', 5)).toBe('2026-09-05');
    expect(billDateForMonth('2026-02', 31)).toBe('2026-02-28');
    expect(billDateForMonth('2026-09')).toBe('2026-09-30');

    const row = buildBillingTimeline(customer({ billingCycleDate: 5 }), '2026-09')[0]!;
    expect([row.billDateYmd, row.dueDateYmd]).toEqual(['2026-09-05', '2026-09-20']);
  });
});

describe('what the offers take off', () => {
  const offer = (over: Record<string, unknown>) => ({
    id: 'offer_1',
    kind: 'bill',
    title: { en: 'Ten percent off' },
    startYmd: '2026-09-01',
    endYmd: '2026-09-30',
    createdAt: TS.createdAt,
    updatedAt: TS.updatedAt,
    ...over,
  });

  it('takes a percent off the month, up to its cap', () => {
    const c = customer({ deliveries: fiveSeptemberDays });
    const rows = buildBillingTimeline(c, '2026-09', [offer({ discount: { type: 'percent', value: 10 } })]);
    expect(rows[0]).toMatchObject({ offerDiscount: 26, baseAmount: 234 });

    const capped = buildBillingTimeline(c, '2026-09', [offer({ discount: { type: 'percent', value: 10, maxDiscount: 10 } })]);
    expect(capped[0]).toMatchObject({ offerDiscount: 10, baseAmount: 250 });
  });

  it('gives a subscription reward per pack, and never more than the day is worth', () => {
    const c = customer({ deliveries: fiveSeptemberDays });
    const reward = offer({ id: 'offer_2', kind: 'subscription', discount: { type: 'flat', value: 2 } });
    expect(buildBillingTimeline(c, '2026-09', [reward])[0]).toMatchObject({ offerDiscount: 10, baseAmount: 250 });
  });

  it('is only for the customers who typed the code', () => {
    const coded = offer({ code: 'SEPT10', discount: { type: 'percent', value: 10 } });
    const c = customer({ deliveries: fiveSeptemberDays });
    expect(buildBillingTimeline(c, '2026-09', [coded])[0]!.offerDiscount).toBe(0);

    const claimed = customer({
      deliveries: fiveSeptemberDays,
      offerClaims: [{ offerId: 'offer_1', code: 'SEPT10', claimedAt: TS.createdAt }],
    });
    expect(buildBillingTimeline(claimed, '2026-09', [coded])[0]!.offerDiscount).toBe(26);
  });

  it('never takes a bill below zero', () => {
    const c = customer({ deliveries: delivered('2026-09', [1]), discountAmount: 40 });
    const big = offer({ discount: { type: 'flat', value: 500 } });
    expect(buildBillingTimeline(c, '2026-09', [big])[0]).toMatchObject({ baseAmount: 0 });
  });
});
