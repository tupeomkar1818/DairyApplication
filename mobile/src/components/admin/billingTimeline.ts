import {
  computeCustomerMonthBillTotal,
  daysInMonth,
  shiftMonth,
  type BillableDeliveryLineInput,
} from '@/src/components/admin/customerSubscriptionMonthUtils';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { Offer } from '@/src/domain/offers/entities';
import { offerDiscountTotalForMonth } from '@/src/domain/offers/offers';

/**
 * A customer's bills month by month, and what is still owed on them.
 *
 * Shared by the admin's Billing and Payments tabs and the customer's My bills, so both sides always see the same
 * numbers:
 * - each month's charges are what was delivered (subscription packs and one-off orders), less the customer's discount
 *   and what the dairy's offers take off (pass `offers`, or bills come out without them);
 * - whatever a month leaves unpaid is carried into the next bill;
 * - payments pay the oldest bill first, whatever month they were made in — paying September's bill in October
 *   settles September.
 */

/** Days after the bill date that payment is due. */
export const BILL_DUE_GRACE_DAYS = 15;

type BillingCustomer = Pick<
  CustomerResponse,
  | 'subscriptionPlans'
  | 'deliveries'
  | 'extraOrders'
  | 'payments'
  | 'discountAmount'
  | 'billingCycleDate'
  | 'subscriptionStartDate'
  | 'offerClaims'
>;

function ymdOf(value: string | undefined | null): string {
  const s = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/** The customer's billing day in that month, clamped to the month; its last day when none is set. */
export function billDateYmdForMonth(yyyyMm: string, billingCycleDate?: number): string {
  const dim = daysInMonth(yyyyMm);
  const day = Number(billingCycleDate);
  const clamped = Number.isInteger(day) && day >= 1 ? Math.min(day, dim) : dim;
  return `${yyyyMm}-${String(clamped).padStart(2, '0')}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The first month anything was billable or paid: the earliest subscription start, delivery, one-off order or
 * payment. Starting any later would drop an old unpaid bill — and credit its payment to a newer one.
 */
export function firstBillingMonth(customer: BillingCustomer, currentMonth: string): string {
  const candidates = [
    ymdOf(customer.subscriptionStartDate),
    ...(customer.subscriptionPlans ?? []).map((p) => ymdOf(p.startDate)),
    ...(customer.deliveries ?? []).map((d) => ymdOf(d.deliveryDate)),
    ...(customer.extraOrders ?? []).map((o) => ymdOf(o.deliveryDate || o.orderDate)),
    ...(customer.payments ?? []).map((p) => ymdOf(p.paymentDate)),
  ]
    .filter(Boolean)
    .map((ymd) => ymd.slice(0, 7))
    .filter((month) => month <= currentMonth)
    .sort();
  return candidates[0] ?? currentMonth;
}

export type BillStatus = 'Paid' | 'Partial' | 'Pending';

export type BillingTimelineRow = {
  month: string;
  billDateYmd: string;
  dueDateYmd: string;
  /** This month's own charges: delivered subscription and one-off orders, less the discount and offer discounts. */
  baseAmount: number;
  /** What offers took off this month's charges (already out of `baseAmount`). */
  offerDiscount: number;
  /** Left unpaid from earlier bills and carried into this one. */
  carryForwardIn: number;
  /** baseAmount + carryForwardIn. */
  invoiceTotal: number;
  /** Payments that went towards this bill. */
  paidApplied: number;
  /** Still owed on this bill, earlier months' unpaid amounts included. */
  pending: number;
  status: BillStatus;
};

/** Every month from the first billable one to `currentMonth`, newest first. */
export function buildBillingTimeline(
  customer: BillingCustomer,
  currentMonth: string,
  options: { offers?: readonly Offer[]; dailyOrderLines?: BillableDeliveryLineInput[] } | BillableDeliveryLineInput[] = {},
): BillingTimelineRow[] {
  const { offers = [], dailyOrderLines = [] } = Array.isArray(options) ? { dailyOrderLines: options } : options;
  const months: string[] = [];
  for (let m = firstBillingMonth(customer, currentMonth); m <= currentMonth; m = shiftMonth(m, 1)) {
    months.push(m);
    if (months.length > 600) break; // 50 years: a guard against a malformed date, not a real limit
  }

  const discount = Math.max(0, Number(customer.discountAmount ?? 0));
  const payments = (customer.payments ?? [])
    .map((p) => ({ date: ymdOf(p.paymentDate), amount: Math.max(0, Number(p.amountPaid ?? 0)) }))
    .filter((p) => p.amount > 0 && p.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  let payIdx = 0;
  let payRemaining = payments[0]?.amount ?? 0;
  let carry = 0;
  const rows: BillingTimelineRow[] = [];

  for (const month of months) {
    const charges = computeCustomerMonthBillTotal(customer, month, dailyOrderLines);
    const offerDiscount = Math.min(
      Math.max(0, charges - discount),
      offerDiscountTotalForMonth(customer, month, offers, dailyOrderLines),
    );
    const baseAmount = Math.max(0, Math.round(charges - discount - offerDiscount));
    const billDateYmd = billDateYmdForMonth(month, customer.billingCycleDate);
    const invoiceTotal = Math.max(0, Math.round(baseAmount + carry));

    let paidApplied = 0;
    let pending = invoiceTotal;
    while (pending > 0 && payIdx < payments.length) {
      if (payRemaining <= 0) {
        payIdx += 1;
        payRemaining = payments[payIdx]?.amount ?? 0;
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
  /** The bill has been raised (its bill date has come). */
  issued: boolean;
  /** Past its due date and still unpaid. */
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
  /** Payments made so far, newest first. */
  payments: NonNullable<CustomerResponse['payments']>;
};

/**
 * What the customer owes and on which bills. Payments settle the oldest bills first, so whatever is still owed
 * belongs to the newest ones: walking back from the newest month, each takes up to its own charges.
 */
export function summarizeBilling(
  customer: Pick<CustomerResponse, 'payments'>,
  timeline: readonly BillingTimelineRow[],
  today: string,
): BillingSummary {
  const outstanding = timeline[0]?.pending ?? 0;

  let remaining = outstanding;
  const unpaid: UnpaidBill[] = [];
  for (const row of timeline) {
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

  const totalPaid = (customer.payments ?? []).reduce(
    (sum, p) => sum + (ymdOf(p.paymentDate) ? Math.max(0, Number(p.amountPaid ?? 0)) : 0),
    0,
  );
  const totalApplied = timeline.reduce((sum, row) => sum + row.paidApplied, 0);

  return {
    outstanding,
    overdue: unpaid.filter((b) => b.overdue).reduce((sum, b) => sum + b.amount, 0),
    advance: Math.max(0, Math.round(totalPaid - totalApplied)),
    unpaid,
    payments: [...(customer.payments ?? [])].sort((a, b) =>
      String(b.paymentDate ?? '').localeCompare(String(a.paymentDate ?? '')),
    ),
  };
}
