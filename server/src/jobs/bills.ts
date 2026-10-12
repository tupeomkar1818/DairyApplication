import { buildBillingTimeline, daysInMonth, shiftMonth, type BillRow } from '@/billing/timeline';
import { loadEveryCustomer } from '@/customers/read';
import type { Customer } from '@/customers/mapping';
import type { Env } from '@/http';
import { indiaYmd } from '@/jobs/reminders';
import { remindable } from '@/jobs/schedule';
import { formatDay, formatMonth, inEveryLanguage, money, WORDS, type Lang } from '@/jobs/words';
import { offerFromRow, type Offer, type OfferRow } from '@/offers/mapping';
import type { Notification } from '@/notifications/mapping';
import { raiseNotifications } from '@/notifications/raise';
import { sendPush } from '@/push/send';

/**
 * The monthly bill: once a month, each customer is told what the month came to and by when to pay.
 *
 * The numbers are the apps' own — `src/billing/` is a port of the billing the admin's billing tab and the
 * customer's My bills already show, so the bill in the notification is the bill in the app, to the rupee.
 *
 * When it goes out is the one thing decided here: a bill is announced once the month it covers is over, on the
 * dairy's billing day — the customer's `billingCycleDate` in the month after it, or the 1st when the dairy has set
 * no day. The amount and the due date come from that month's row, carried-forward arrears included.
 */

export function billKey(customerId: string, month: string): string {
  return `bill:${customerId}:${month}`;
}

export function billsAdminKey(month: string): string {
  return `bill:admin:${month}`;
}

/** The month a customer's bill is announced today, or null when today is not their billing day. */
export function billMonthDueToday(customer: Customer, todayYmd: string): string | null {
  const thisMonth = todayYmd.slice(0, 7);
  const day = Number(todayYmd.slice(8, 10));
  const cycle = Number(customer.billingCycleDate);
  const billingDay = Number.isInteger(cycle) && cycle >= 1 ? Math.min(cycle, daysInMonth(thisMonth)) : 1;
  return day === billingDay ? shiftMonth(thisMonth, -1) : null;
}

/** The bill for one customer and month, in both languages, or null when the month came to nothing. */
export function buildBillNotification(customer: Customer, row: BillRow): Notification | null {
  if (row.invoiceTotal <= 0) return null;
  const words = inEveryLanguage((lang: Lang) => ({
    title: WORDS[lang].billTitle(formatMonth(row.month, lang)),
    body: WORDS[lang].billDueBody(money(row.invoiceTotal), formatDay(row.dueDateYmd, lang)),
  }));
  return {
    id: '',
    audience: 'Customer',
    customerId: customer.id,
    type: 'MonthlyBillGenerated',
    ...words,
    link: '/(customer)/bills',
    monthYyyyMm: row.month,
    subjectKey: billKey(customer.id, row.month),
    createdAt: '',
    updatedAt: '',
  };
}

/** The dairy's line: how many bills went out for a month, and what they came to in all. */
export function buildBillsAdminSummary(month: string, count: number, total: number): Notification {
  const words = inEveryLanguage((lang: Lang) => ({
    title: WORDS[lang].billsAdminTitle(formatMonth(month, lang)),
    body: WORDS[lang].billsAdminBody(count, money(total)),
  }));
  return {
    id: '',
    audience: 'Admin',
    type: 'MonthlyBillGenerated',
    ...words,
    monthYyyyMm: month,
    subjectKey: billsAdminKey(month),
    createdAt: '',
    updatedAt: '',
  };
}

/** Sends the bills due today. Returns how many customers were billed. */
export async function sendMonthlyBills(env: Env, now: Date = new Date()): Promise<number> {
  const today = indiaYmd(now);
  const [customers, offerRows] = await Promise.all([
    loadEveryCustomer(env),
    env.DB.prepare('select * from offers').all<OfferRow>(),
  ]);
  const offers: Offer[] = offerRows.results.map(offerFromRow);

  const due = customers
    .filter((customer) => remindable(customer))
    .map((customer) => ({ customer, month: billMonthDueToday(customer, today) }))
    .filter((entry): entry is { customer: Customer; month: string } => !!entry.month);
  if (!due.length) return 0;

  // One bill per customer per month, whatever else happens to run today.
  const already = await env.DB.prepare(
    `select subject_key from notifications where audience = 'Customer' and type = 'MonthlyBillGenerated'
       and subject_key in (${due.map(() => '?').join(', ')})`,
  )
    .bind(...due.map((entry) => billKey(entry.customer.id, entry.month)))
    .all<{ subject_key: string | null }>();
  const sent = new Set(already.results.map((row) => row.subject_key ?? ''));

  const rows: Notification[] = [];
  const totals = new Map<string, { count: number; total: number }>();
  for (const { customer, month } of due) {
    if (sent.has(billKey(customer.id, month))) continue;
    // The timeline is read up to the month being billed: later months are not on this bill.
    const billRow = buildBillingTimeline(customer, month, offers).find((row) => row.month === month);
    if (!billRow) continue;
    const notification = buildBillNotification(customer, billRow);
    if (!notification) continue;
    rows.push(notification);
    const tally = totals.get(month) ?? { count: 0, total: 0 };
    totals.set(month, { count: tally.count + 1, total: tally.total + billRow.invoiceTotal });
  }
  if (!rows.length) return 0;

  const summaries: Notification[] = [];
  for (const [month, tally] of totals) {
    const summarySent = await env.DB.prepare("select id from notifications where audience = 'Admin' and subject_key = ?")
      .bind(billsAdminKey(month))
      .first<{ id: string }>();
    if (!summarySent) summaries.push(buildBillsAdminSummary(month, tally.count, tally.total));
  }

  const saved = await raiseNotifications(env, [...rows, ...summaries], now);
  await sendPush(
    env,
    saved.filter((row) => row.audience === 'Customer'),
  );
  return rows.length;
}
