import { describe, expect, it } from 'vitest';

import type { BillRow } from '@/billing/timeline';
import { billKey, billMonthDueToday, buildBillNotification, buildBillsAdminSummary } from '@/jobs/bills';
import type { Customer } from '@/customers/mapping';

const TS = '2026-09-01T00:00:00.000Z';

const customer = (over: Partial<Customer> = {}): Customer => ({
  id: 'cust_1',
  name: 'Asha',
  mobile: '9876543210',
  status: 'Active',
  createdAt: TS,
  updatedAt: TS,
  ...over,
});

const row = (over: Partial<BillRow> = {}): BillRow => ({
  month: '2026-09',
  billDateYmd: '2026-09-30',
  dueDateYmd: '2026-10-15',
  baseAmount: 780,
  offerDiscount: 0,
  carryForwardIn: 0,
  invoiceTotal: 780,
  paidApplied: 0,
  pending: 780,
  status: 'Pending',
  ...over,
});

describe('when a bill goes out', () => {
  it('on the 1st for a dairy that set no billing day, for the month just gone', () => {
    expect(billMonthDueToday(customer(), '2026-10-01')).toBe('2026-09');
    expect(billMonthDueToday(customer(), '2026-10-02')).toBeNull();
  });

  it('on the customer’s own billing day', () => {
    const fifth = customer({ billingCycleDate: 5 });
    expect(billMonthDueToday(fifth, '2026-10-05')).toBe('2026-09');
    expect(billMonthDueToday(fifth, '2026-10-01')).toBeNull();
  });

  it('on the last day of a short month when the billing day is past its end', () => {
    const thirtyFirst = customer({ billingCycleDate: 31 });
    expect(billMonthDueToday(thirtyFirst, '2026-02-28')).toBe('2026-01');
    expect(billMonthDueToday(thirtyFirst, '2026-03-31')).toBe('2026-02');
  });

  it('turns the year over', () => {
    expect(billMonthDueToday(customer(), '2027-01-01')).toBe('2026-12');
  });
});

describe('what the bill says', () => {
  it('names the month, the amount and the day to pay by — in both languages', () => {
    const bill = buildBillNotification(customer(), row())!;
    expect(bill.title).toBe('Bill for September 2026');
    expect(bill.body).toBe('₹780, due 15 Oct.');
    const mr = (bill.translations as { mr: { title: string; body: string } }).mr;
    expect(mr.title).toBe('सप्टेंबर 2026 चे बिल');
    expect(mr.body).toBe('₹780, 15 ऑक्टो पर्यंत भरा.');
  });

  it('opens the customer’s bills, and is about that month', () => {
    expect(buildBillNotification(customer(), row())).toMatchObject({
      audience: 'Customer',
      customerId: 'cust_1',
      type: 'MonthlyBillGenerated',
      link: '/(customer)/bills',
      monthYyyyMm: '2026-09',
      subjectKey: billKey('cust_1', '2026-09'),
    });
  });

  it('carries what was owed from before, because that is what the bill comes to', () => {
    const bill = buildBillNotification(customer(), row({ baseAmount: 260, carryForwardIn: 520, invoiceTotal: 780 }))!;
    expect(bill.body).toContain('₹780');
  });

  it('says nothing to a customer who owes nothing', () => {
    expect(buildBillNotification(customer(), row({ baseAmount: 0, invoiceTotal: 0 }))).toBeNull();
  });
});

describe('the dairy’s line', () => {
  it('counts the bills and what they came to', () => {
    const summary = buildBillsAdminSummary('2026-09', 12, 9360);
    expect(summary.title).toBe('Bills for September 2026');
    expect(summary.body).toBe('12 bills came to ₹9,360 in all.');
    expect((summary.translations as { mr: { title: string } }).mr.title).toBe('सप्टेंबर 2026 ची बिले');
  });

  it('reads right for one bill', () => {
    expect(buildBillsAdminSummary('2026-09', 1, 780).body).toBe('1 bill came to ₹780 in all.');
  });
});
