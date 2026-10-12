import { buildBillingTimeline, summarizeBilling, type BillingTimelineRow } from '@/src/components/admin/billingTimeline';
import { addOnDateYmd } from '@/src/domain/customers/addOns';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { Offer } from '@/src/domain/offers/entities';
import {
  changeHint,
  filterCustomers,
  filterValue,
  groupBy,
  routeOf,
  sum,
  type ReportData,
} from '@/src/domain/reports/data';
import { dateOfYmd, dayOf, inRange, previousRange, trendBuckets, type ReportRange } from '@/src/domain/reports/dateRange';
import { formatReportDate, paymentModeLabel, percentOf, reportStatusLabel } from '@/src/domain/reports/format';
import { ALL, type ReportDocument, type ReportFilterDef, type ReportFilterValues } from '@/src/domain/reports/model';
import { strings } from '@/src/i18n/strings';

/**
 * Money in and money owed. Collections read payments by the day they were paid; dues read the same billing timeline
 * as the admin's Billing tab and the customer's My bills (unpaid bills carried forward, payments settling the oldest
 * bill first), as it stood at the end of the range.
 */

export const PAYMENT_MODES = ['Cash', 'UPI', 'Bank', 'Other'] as const;

export function paymentModeFilterDef(): ReportFilterDef {
  const t = strings('reports').filters;
  return {
    key: 'mode',
    label: t.paymentMode,
    options: [{ value: ALL, label: t.allModes }, ...PAYMENT_MODES.map((m) => ({ value: m, label: paymentModeLabel(m) }))],
  };
}

type PaymentRow = {
  ymd: string;
  customer: CustomerResponse;
  amount: number;
  mode: string;
  collectedBy: string;
  transactionId: string;
  notes: string;
};

function paymentsIn(customers: readonly CustomerResponse[], range: ReportRange, mode: string): PaymentRow[] {
  const out: PaymentRow[] = [];
  for (const c of customers) {
    for (const p of c.payments ?? []) {
      const ymd = dayOf(p.paymentDate);
      if (!inRange(ymd, range)) continue;
      const amount = Math.max(0, Number(p.amountPaid ?? 0));
      if (amount <= 0) continue;
      const m = String(p.paymentMode ?? 'Other');
      if (mode !== ALL && m !== mode) continue;
      out.push({
        ymd,
        customer: c,
        amount,
        mode: m,
        collectedBy: String(p.collectedBy ?? '').trim(),
        transactionId: String(p.transactionId ?? '').trim(),
        notes: String(p.notes ?? '').trim(),
      });
    }
  }
  return out.sort((a, b) => b.ymd.localeCompare(a.ymd));
}

export function buildCollectionsReport(
  data: ReportData,
  range: ReportRange,
  filters: ReportFilterValues,
  options: { title?: string; kind?: string; subject?: string } = {},
): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const customers = filterCustomers(data.customers, data.boys, filters);
  const mode = filterValue(filters, 'mode');
  const rows = paymentsIn(customers, range, mode);
  const previous = paymentsIn(customers, previousRange(range), mode);
  const total = sum(rows, (r) => r.amount);
  const payers = new Set(rows.map((r) => r.customer.id)).size;

  const groupRows = (keyOf: (r: PaymentRow) => string) =>
    Array.from(groupBy(rows, keyOf))
      .map(([name, group]) => ({
        name,
        payments: group.length,
        amount: sum(group, (g) => g.amount),
        share: percentOf(sum(group, (g) => g.amount), total),
      }))
      .sort((a, b) => b.amount - a.amount);

  return {
    kind: options.kind ?? 'collections',
    title: options.title ?? t.catalog.collections.title,
    subject: options.subject,
    range,
    generatedAtIso: data.nowIso,
    stats: [
      { label: L.collected, value: total, kind: 'money', tone: 'good', hint: changeHint(total, sum(previous, (p) => p.amount)) },
      { label: L.payments, value: rows.length, kind: 'number' },
      { label: L.customersWhoPaid, value: payers, kind: 'number' },
      { label: L.averagePayment, value: rows.length ? total / rows.length : 0, kind: 'money' },
    ],
    trend: {
      title: L.collected,
      kind: 'money',
      points: trendBuckets(range).map((b) => ({ label: b.label, value: Math.round(sum(rows.filter((r) => r.ymd >= b.fromYmd && r.ymd <= b.toYmd), (r) => r.amount)) })),
    },
    tables: [
      {
        id: 'byMode',
        title: t.collections.byModeTitle,
        columns: [
          { key: 'name', label: L.mode, kind: 'text', primary: true },
          { key: 'payments', label: L.payments, kind: 'number' },
          { key: 'amount', label: L.amount, kind: 'money' },
          { key: 'share', label: L.share, kind: 'percent' },
        ],
        rows: groupRows((r) => paymentModeLabel(r.mode)),
        totals: { name: null, payments: rows.length, amount: total, share: total > 0 ? 100 : 0 },
        emptyText: t.collections.empty,
      },
      {
        id: 'byCollector',
        title: t.collections.byCollectorTitle,
        columns: [
          { key: 'name', label: L.collectedBy, kind: 'text', primary: true },
          { key: 'payments', label: L.payments, kind: 'number' },
          { key: 'amount', label: L.amount, kind: 'money' },
          { key: 'share', label: L.share, kind: 'percent' },
        ],
        rows: groupRows((r) => r.collectedBy || t.collections.notRecorded),
        totals: { name: null, payments: rows.length, amount: total, share: total > 0 ? 100 : 0 },
        emptyText: t.collections.empty,
      },
      {
        id: 'byRoute',
        title: t.tables.byRoute,
        columns: [
          { key: 'name', label: L.route, kind: 'text', primary: true },
          { key: 'payments', label: L.payments, kind: 'number' },
          { key: 'amount', label: L.amount, kind: 'money' },
          { key: 'share', label: L.share, kind: 'percent' },
        ],
        rows: groupRows((r) => routeOf(r.customer)),
        totals: { name: null, payments: rows.length, amount: total, share: total > 0 ? 100 : 0 },
        emptyText: t.collections.empty,
      },
      {
        id: 'payments',
        title: t.collections.paymentsTitle,
        columns: [
          { key: 'date', label: L.date, kind: 'date' },
          { key: 'customer', label: L.customer, kind: 'text', primary: true },
          { key: 'route', label: L.route, kind: 'text' },
          { key: 'mode', label: L.mode, kind: 'text' },
          { key: 'reference', label: L.reference, kind: 'text' },
          { key: 'collectedBy', label: L.collectedBy, kind: 'text' },
          { key: 'amount', label: L.amount, kind: 'money' },
        ],
        rows: rows.map((r) => ({
          date: r.ymd,
          customer: r.customer.name,
          route: routeOf(r.customer),
          mode: paymentModeLabel(r.mode),
          reference: r.transactionId || '—',
          collectedBy: r.collectedBy || '—',
          amount: r.amount,
        })),
        totals: { date: null, customer: null, route: null, mode: null, reference: null, collectedBy: null, amount: total },
        emptyText: t.collections.empty,
      },
    ],
    notes: [t.collections.note],
  };
}

/** The customer's records as they stood at the end of `asOf`: later deliveries, orders and payments left out. */
function customerAsOf(c: CustomerResponse, asOf: string): CustomerResponse {
  return {
    ...c,
    deliveries: (c.deliveries ?? []).filter((d) => dayOf(d.deliveryDate) <= asOf),
    extraOrders: (c.extraOrders ?? []).filter((o) => addOnDateYmd(o) <= asOf),
    payments: (c.payments ?? []).filter((p) => dayOf(p.paymentDate) <= asOf),
  };
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = dateOfYmd(fromYmd);
  const b = dateOfYmd(toYmd);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export type CustomerBillingAsOf = {
  customer: CustomerResponse;
  asOf: string;
  timeline: BillingTimelineRow[];
  outstanding: number;
  overdue: number;
  advance: number;
  unpaid: ReturnType<typeof summarizeBilling>['unpaid'];
  lastPaymentYmd: string;
};

/** The customer's bills as they stood on `asOf`, offer discounts taken off — the same bills the customer sees. */
export function billingAsOf(c: CustomerResponse, asOf: string, offers: readonly Offer[] = []): CustomerBillingAsOf {
  const snapshot = customerAsOf(c, asOf);
  const timeline = buildBillingTimeline(snapshot, asOf.slice(0, 7), { offers });
  const summary = summarizeBilling(snapshot, timeline, asOf);
  const lastPaymentYmd = (snapshot.payments ?? []).map((p) => dayOf(p.paymentDate)).sort().pop() ?? '';
  return {
    customer: c,
    asOf,
    timeline,
    outstanding: summary.outstanding,
    overdue: summary.overdue,
    advance: summary.advance,
    unpaid: summary.unpaid,
    lastPaymentYmd,
  };
}

export function buildDuesReport(data: ReportData, range: ReportRange, filters: ReportFilterValues): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const customers = filterCustomers(data.customers, data.boys, filters);
  // Balances are read at the end of the range — or today, when the range runs into the future.
  const asOf = range.toYmd < data.today ? range.toYmd : data.today;
  const balances = customers.map((c) => billingAsOf(c, asOf, data.offers));
  const hasOffers = data.offers.length > 0;
  const owing = balances.filter((b) => b.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);

  const outstanding = sum(balances, (b) => b.outstanding);
  const overdue = sum(balances, (b) => b.overdue);
  const advances = sum(balances, (b) => b.advance);

  // Bills raised in the range (by bill date), from each customer's timeline.
  const billsInRange = balances.flatMap((b) =>
    b.timeline.filter((row) => inRange(row.billDateYmd, range) && row.billDateYmd <= asOf).map((row) => ({ b, row })),
  );
  const billed = sum(billsInRange, (x) => x.row.baseAmount);
  const offerDiscounts = sum(billsInRange, (x) => x.row.offerDiscount);
  const collected = sum(customers, (c) => sum((c.payments ?? []).filter((p) => inRange(dayOf(p.paymentDate), range)), (p) => Math.max(0, Number(p.amountPaid ?? 0))));

  const AGES = [
    { key: 'notDue', label: t.dues.ages.notDue, test: (d: number) => d <= 0 },
    { key: 'd30', label: t.dues.ages.d30, test: (d: number) => d >= 1 && d <= 30 },
    { key: 'd60', label: t.dues.ages.d60, test: (d: number) => d >= 31 && d <= 60 },
    { key: 'd90', label: t.dues.ages.d90, test: (d: number) => d >= 61 && d <= 90 },
    { key: 'd90p', label: t.dues.ages.d90p, test: (d: number) => d > 90 },
  ];
  const unpaidBills = balances.flatMap((b) => b.unpaid.map((u) => ({ b, u, age: daysBetween(u.dueDateYmd, asOf) })));

  return {
    kind: 'dues',
    title: t.catalog.dues.title,
    subject: t.dues.asOn(formatReportDate(asOf)),
    range,
    generatedAtIso: data.nowIso,
    stats: [
      { label: L.outstanding, value: outstanding, kind: 'money', tone: outstanding > 0 ? 'bad' : 'good' },
      { label: L.overdue, value: overdue, kind: 'money', tone: overdue > 0 ? 'bad' : 'default' },
      { label: L.customersOwing, value: owing.length, kind: 'number' },
      { label: L.advancesHeld, value: advances, kind: 'money' },
      { label: L.billedInPeriod, value: billed, kind: 'money' },
      { label: L.collectedInPeriod, value: collected, kind: 'money', tone: 'good' },
      ...(hasOffers ? [{ label: L.offerDiscounts, value: offerDiscounts, kind: 'money' as const, tone: 'warn' as const }] : []),
    ],
    tables: [
      {
        id: 'customers',
        title: L.customersOwing,
        columns: [
          { key: 'customer', label: L.customer, kind: 'text', primary: true },
          { key: 'route', label: L.route, kind: 'text' },
          { key: 'mobile', label: L.mobile, kind: 'text' },
          { key: 'outstanding', label: L.outstanding, kind: 'money' },
          { key: 'overdue', label: L.overdue, kind: 'money' },
          { key: 'oldest', label: L.oldestUnpaidBill, kind: 'date' },
          { key: 'daysOverdue', label: L.daysOverdue, kind: 'number' },
          { key: 'lastPayment', label: L.lastPayment, kind: 'date' },
        ],
        rows: owing.map((b) => {
          const oldest = b.unpaid[0];
          const overdueDays = oldest ? daysBetween(oldest.dueDateYmd, asOf) : 0;
          return {
            customer: b.customer.name,
            route: routeOf(b.customer),
            mobile: b.customer.mobile ?? '',
            outstanding: b.outstanding,
            overdue: b.overdue,
            oldest: oldest ? oldest.month : null,
            daysOverdue: overdueDays > 0 ? overdueDays : null,
            lastPayment: b.lastPaymentYmd || null,
          };
        }),
        totals: { customer: null, route: null, mobile: null, outstanding, overdue, oldest: null, daysOverdue: null, lastPayment: null },
        emptyText: t.dues.emptyCustomers,
      },
      {
        id: 'ageing',
        title: t.dues.ageingTitle,
        note: t.dues.ageingNote,
        columns: [
          { key: 'bucket', label: L.age, kind: 'text', primary: true },
          { key: 'bills', label: L.bills, kind: 'number' },
          { key: 'customers', label: L.customers, kind: 'number' },
          { key: 'amount', label: L.amount, kind: 'money' },
        ],
        rows: AGES.map((age) => {
          const group = unpaidBills.filter((x) => age.test(x.age));
          return { bucket: age.label, bills: group.length, customers: new Set(group.map((x) => x.b.customer.id)).size, amount: sum(group, (x) => x.u.amount) };
        }),
        totals: { bucket: null, bills: unpaidBills.length, customers: owing.length, amount: sum(unpaidBills, (x) => x.u.amount) },
        emptyText: t.dues.emptyAgeing,
      },
      {
        id: 'bills',
        title: t.dues.billsTitle,
        columns: [
          { key: 'customer', label: L.customer, kind: 'text', primary: true },
          { key: 'month', label: L.billMonth, kind: 'date' },
          { key: 'billDate', label: L.billDate, kind: 'date' },
          ...(hasOffers ? [{ key: 'offerDiscount', label: L.offerDiscounts, kind: 'money' as const }] : []),
          { key: 'charges', label: L.charges, kind: 'money' },
          { key: 'carried', label: L.carriedIn, kind: 'money' },
          { key: 'paid', label: L.paid, kind: 'money' },
          { key: 'pending', label: L.pending, kind: 'money' },
          { key: 'status', label: L.status, kind: 'text' },
        ],
        rows: billsInRange
          .filter((x) => x.row.invoiceTotal > 0)
          .sort((a, b) => b.row.billDateYmd.localeCompare(a.row.billDateYmd) || a.b.customer.name.localeCompare(b.b.customer.name))
          .map(({ b, row }) => ({
            customer: b.customer.name,
            month: row.month,
            billDate: row.billDateYmd,
            offerDiscount: row.offerDiscount,
            charges: row.baseAmount,
            carried: row.carryForwardIn,
            paid: row.paidApplied,
            pending: row.pending,
            status: reportStatusLabel(row.status),
          })),
        totals: { customer: null, month: null, billDate: null, offerDiscount: offerDiscounts, charges: billed, carried: null, paid: null, pending: null, status: null },
        emptyText: t.dues.emptyBills,
      },
    ],
    notes: [
      t.dues.noteAsOf(formatReportDate(asOf)),
      t.dues.noteOldestFirst,
      ...(hasOffers ? [t.dues.noteOfferDiscounts] : []),
    ],
  };
}
