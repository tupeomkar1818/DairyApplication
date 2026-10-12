import { monthCharges } from '@/billing/charges';
import { offerDiscountTotalForMonth } from '@/billing/offerDiscounts';
import type { Customer } from '@/customers/mapping';
import type { Row } from '@/customers/selfService';
import type { Offer } from '@/offers/mapping';

/**
 * A customer's bills month by month, and what is still owed on them — a port of
 * `mobile/src/components/admin/billingTimeline.ts`, which the admin's billing tab and the customer's My bills both
 * read, so every side shows the same numbers.
 *
 * - a month's charges are what was delivered, less the customer's own discount and what the offers took off;
 * - whatever a month leaves unpaid is carried into the next bill;
 * - payments settle the oldest bill first, whatever month they were made in.
 */

/** Days after the bill date that payment is due. */
export const BILL_DUE_GRACE_DAYS = 15;

const ymdOf = (value: unknown): string => {
  const s = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

export function daysInMonth(month: string): number {
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) return 31;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
}

export function shiftMonth(month: string, by: number): string {
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) return month;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + by, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  if (!ymdOf(ymd)) return ymd;
  return new Date(Date.parse(`${ymd}T00:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The customer's billing day in that month, kept inside it; its last day when the dairy set none. */
export function billDateForMonth(month: string, billingCycleDate?: unknown): string {
  const dim = daysInMonth(month);
  const day = Number(billingCycleDate);
  const clamped = Number.isInteger(day) && day >= 1 ? Math.min(day, dim) : dim;
  return `${month}-${String(clamped).padStart(2, '0')}`;
}

/**
 * The first month anything was billable or paid. Starting any later would drop an old unpaid bill — and credit its
 * payment to a newer one.
 */
export function firstBillingMonth(customer: Customer, currentMonth: string): string {
  const months = [
    ymdOf(customer.subscriptionStartDate),
    ...((customer.subscriptionPlans as Row[]) ?? []).map((plan) => ymdOf(plan.startDate)),
    ...((customer.deliveries as Row[]) ?? []).map((delivery) => ymdOf(delivery.deliveryDate)),
    ...((customer.extraOrders as Row[]) ?? []).map((order) => ymdOf(order.deliveryDate || order.orderDate)),
    ...((customer.payments as Row[]) ?? []).map((payment) => ymdOf(payment.paymentDate)),
  ]
    .filter(Boolean)
    .map((ymd) => ymd.slice(0, 7))
    .filter((month) => month <= currentMonth)
    .sort();
  return months[0] ?? currentMonth;
}

export type BillStatus = 'Paid' | 'Partial' | 'Pending';

export type BillRow = {
  month: string;
  billDateYmd: string;
  dueDateYmd: string;
  /** This month's own charges, less the discount and the offers. */
  baseAmount: number;
  /** What the offers took off (already out of `baseAmount`). */
  offerDiscount: number;
  /** Left unpaid from earlier bills and carried into this one. */
  carryForwardIn: number;
  invoiceTotal: number;
  paidApplied: number;
  /** Still owed on this bill, earlier months included. */
  pending: number;
  status: BillStatus;
};

/** Every month from the first billable one to `currentMonth`, newest first. */
export function buildBillingTimeline(customer: Customer, currentMonth: string, offers: readonly Offer[] = []): BillRow[] {
  const months: string[] = [];
  for (let month = firstBillingMonth(customer, currentMonth); month <= currentMonth; month = shiftMonth(month, 1)) {
    months.push(month);
    if (months.length > 600) break; // 50 years: a guard against a malformed date, not a real limit
  }

  const discount = Math.max(0, Number(customer.discountAmount ?? 0));
  const payments = ((customer.payments as Row[]) ?? [])
    .map((payment) => ({ date: ymdOf(payment.paymentDate), amount: Math.max(0, Number(payment.amountPaid ?? 0)) }))
    .filter((payment) => payment.amount > 0 && payment.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  let payIndex = 0;
  let payRemaining = payments[0]?.amount ?? 0;
  let carry = 0;
  const rows: BillRow[] = [];

  for (const month of months) {
    const charges = monthCharges(customer, month);
    const offerDiscount = Math.min(Math.max(0, charges - discount), offerDiscountTotalForMonth(customer, month, offers));
    const baseAmount = Math.max(0, Math.round(charges - discount - offerDiscount));
    const billDateYmd = billDateForMonth(month, customer.billingCycleDate);
    const invoiceTotal = Math.max(0, Math.round(baseAmount + carry));

    let paidApplied = 0;
    let pending = invoiceTotal;
    while (pending > 0 && payIndex < payments.length) {
      if (payRemaining <= 0) {
        payIndex += 1;
        payRemaining = payments[payIndex]?.amount ?? 0;
        continue;
      }
      const used = Math.min(pending, payRemaining);
      paidApplied += used;
      pending -= used;
      payRemaining -= used;
    }

    rows.push({
      month,
      billDateYmd,
      dueDateYmd: addDaysYmd(billDateYmd, BILL_DUE_GRACE_DAYS),
      baseAmount,
      offerDiscount: Math.round(offerDiscount),
      carryForwardIn: Math.round(carry),
      invoiceTotal,
      paidApplied: Math.round(paidApplied),
      pending: Math.round(Math.max(0, pending)),
      status: pending <= 0 && paidApplied > 0 ? 'Paid' : paidApplied > 0 ? 'Partial' : 'Pending',
    });
    carry = Math.round(Math.max(0, pending));
  }

  return rows.reverse();
}

export type UnpaidBill = {
  month: string;
  billDateYmd: string;
  dueDateYmd: string;
  /** How much of this month's own charges is still unpaid. */
  amount: number;
  /** The bill has been raised: its bill date has come. */
  issued: boolean;
  overdue: boolean;
};

export type BillingSummary = {
  /** Everything owed right now, the running month included. */
  outstanding: number;
  /** The part of it that is past due. */
  overdue: number;
  /** Paid beyond everything billed so far; it goes towards the next bills. */
  advance: number;
  /** Months with money still owed on their own charges, oldest first. */
  unpaid: UnpaidBill[];
  months: BillRow[];
};

/**
 * What the customer owes and on which bills. Payments settle the oldest bills first, so whatever is still owed
 * belongs to the newest ones: walking back from the newest month, each takes up to its own charges.
 */
export function summarizeBilling(customer: Customer, currentMonth: string, today: string, offers: readonly Offer[] = []): BillingSummary {
  const months = buildBillingTimeline(customer, currentMonth, offers);
  const outstanding = months[0]?.pending ?? 0;

  let remaining = outstanding;
  const unpaid: UnpaidBill[] = [];
  for (const row of months) {
    if (remaining <= 0) break;
    const amount = Math.min(row.baseAmount, remaining);
    remaining -= amount;
    if (amount <= 0) continue;
    unpaid.push({
      month: row.month,
      billDateYmd: row.billDateYmd,
      dueDateYmd: row.dueDateYmd,
      amount,
      issued: row.billDateYmd <= today,
      overdue: row.dueDateYmd < today,
    });
  }
  unpaid.reverse();

  const totalPaid = ((customer.payments as Row[]) ?? []).reduce(
    (sum, payment) => sum + (ymdOf(payment.paymentDate) ? Math.max(0, Number(payment.amountPaid ?? 0)) : 0),
    0,
  );
  const totalApplied = months.reduce((sum, row) => sum + row.paidApplied, 0);

  return {
    outstanding,
    overdue: unpaid.filter((bill) => bill.overdue).reduce((sum, bill) => sum + bill.amount, 0),
    advance: Math.max(0, Math.round(totalPaid - totalApplied)),
    unpaid,
    months,
  };
}
