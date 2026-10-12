import { buildTodayEntries } from '@/src/components/admin/dashboardMetrics';
import { isDaySkipped, planQuantityOn } from '@/src/domain/customers/daySchedule';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { subscriptionPlanActiveOnDateYmd } from '@/src/domain/customers/planSchedule';
import { billingAsOf } from '@/src/domain/reports/moneyReports';
import { offerText } from '@/src/domain/offers/offers';
import {
  deliveredLinesForCustomer,
  filterCustomers,
  groupBy,
  offerDiscountEntries,
  packSize,
  sum,
  type DeliveredLine,
  type ReportData,
} from '@/src/domain/reports/data';
import { dayOf, daysOfRange, inRange, monthsOfRange, trendBuckets, type ReportRange } from '@/src/domain/reports/dateRange';
import { formatQuantity, formatReportDate, formatReportMoney, paymentModeLabel, reportStatusLabel } from '@/src/domain/reports/format';
import type { ReportDocument, ReportFilterValues, ReportStat } from '@/src/domain/reports/model';
import { strings } from '@/src/i18n/strings';

/**
 * One household's own reports: the day-by-day statement, the bills, the payments and what they consumed. The admin
 * opens the same reports for any customer; the customer app only ever passes its own record.
 */

const text = (value: unknown) => String(value ?? '').trim();

function pickCustomer(data: ReportData, filters: ReportFilterValues): CustomerResponse | null {
  const list = filterCustomers(data.customers, data.boys, filters);
  return list.length === 1 ? list[0]! : null;
}

function emptyDocument(kind: string, title: string, data: ReportData, range: ReportRange): ReportDocument {
  return {
    kind,
    title,
    range,
    generatedAtIso: data.nowIso,
    stats: [],
    tables: [],
    notes: [strings('reports').statement.chooseCustomer],
  };
}

function subjectOf(c: CustomerResponse): string {
  return [text(c.name), text(c.mobile)].filter(Boolean).join(' · ');
}

/** How a delivered line reads: a one-off order as ordered (a combo with its contents), a subscription as product · pack. */
function lineItem(l: DeliveredLine): string {
  return l.label || [l.productName, l.packLabel].filter(Boolean).join(' · ');
}

/** "Add-on", or "Add-on · Offer: Diwali box" for an order placed under an offer. */
function lineType(l: DeliveredLine): string {
  const t = strings('reports').statement;
  if (l.kind === 'subscription') return t.subscription;
  return l.offerId ? `${t.addOn} · ${strings('offers').billLine(l.offerTitle ?? '')}` : t.addOn;
}

export function buildStatementReport(data: ReportData, range: ReportRange, filters: ReportFilterValues): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const c = pickCustomer(data, filters);
  if (!c) return emptyDocument('statement', t.statement.title, data, range);

  const lines = deliveredLinesForCustomer(c).filter((l) => inRange(l.ymd, range));
  const total = sum(lines, (l) => l.amount);
  const subscription = sum(lines.filter((l) => l.kind === 'subscription'), (l) => l.amount);
  const deliveredDays = new Set(lines.map((l) => l.ymd)).size;
  const savedOnOrders = sum(lines, (l) => l.savings ?? 0);
  const hasOfferOrders = lines.some((l) => l.offerId);

  // Days that did not happen: marked not delivered, or paused by the customer or the dairy.
  const exceptions: { date: string; what: string; status: string }[] = [];
  let pausedDays = 0;
  let missedDays = 0;
  for (const ymd of daysOfRange(range)) {
    if (ymd > data.today) break;
    const entry = buildTodayEntries([c], ymd)[0];
    if (entry?.status === 'Not delivered') {
      missedDays += 1;
      exceptions.push({ date: ymd, what: [...entry.planItems, ...entry.addOnItems].join(', '), status: t.statement.notDelivered });
      continue;
    }
    const paused = (c.subscriptionPlans ?? []).filter(
      (p) => subscriptionPlanActiveOnDateYmd(p, ymd) && planQuantityOn(p, ymd, c.subscriptionExceptions) <= 0,
    );
    if (paused.length) {
      const whole = !entry;
      if (whole) pausedDays += 1;
      const skip = (c.subscriptionExceptions ?? []).find((ex) => isDaySkipped([ex], ymd, paused[0]!.id));
      exceptions.push({
        date: ymd,
        what: paused.map((p) => [text(p.productName), text(p.quantityLabel)].filter(Boolean).join(' · ')).join(', '),
        status: `${whole ? t.statement.paused : t.statement.linePaused}${skip?.reason ? ` · ${text(skip.reason)}` : ''}`,
      });
    }
  }

  return {
    kind: 'statement',
    title: t.statement.title,
    subject: subjectOf(c),
    range,
    generatedAtIso: data.nowIso,
    stats: [
      { label: L.deliveredValue, value: total, kind: 'money', tone: 'good' },
      { label: L.subscription, value: subscription, kind: 'money' },
      { label: L.addOns, value: total - subscription, kind: 'money' },
      { label: L.daysDelivered, value: deliveredDays, kind: 'number' },
      { label: L.daysNotDelivered, value: missedDays, kind: 'number', tone: missedDays ? 'bad' : 'default' },
      { label: L.daysPaused, value: pausedDays, kind: 'number' },
      ...(savedOnOrders > 0 ? [{ label: L.savedOnOfferOrders, value: savedOnOrders, kind: 'money' as const, tone: 'good' as const }] : []),
    ],
    tables: [
      {
        id: 'lines',
        title: t.statement.linesTitle,
        columns: [
          { key: 'date', label: L.date, kind: 'date' },
          { key: 'item', label: L.item, kind: 'text', primary: true },
          { key: 'type', label: L.type, kind: 'text' },
          { key: 'packs', label: L.packs, kind: 'number' },
          { key: 'amount', label: L.amount, kind: 'money' },
        ],
        rows: lines.map((l) => ({
          date: l.ymd,
          item: lineItem(l),
          type: lineType(l),
          packs: l.packs,
          amount: l.amount,
        })),
        totals: { date: null, item: null, type: null, packs: sum(lines, (l) => l.packs), amount: total },
        emptyText: t.statement.emptyLines,
      },
      {
        id: 'exceptions',
        title: t.statement.exceptionsTitle,
        columns: [
          { key: 'date', label: L.date, kind: 'date', primary: true },
          { key: 'what', label: L.items, kind: 'text' },
          { key: 'status', label: L.whatHappened, kind: 'text' },
        ],
        rows: exceptions,
        emptyText: t.statement.emptyExceptions,
      },
    ],
    notes: [t.statement.noteDiscount, ...(hasOfferOrders || data.offers.length ? [t.statement.noteOffers] : [])],
  };
}

export function buildBillsReport(
  data: ReportData,
  range: ReportRange,
  filters: ReportFilterValues,
  options: { /** The customer reading their own bills ("You saved"). */ customerView?: boolean } = {},
): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const c = pickCustomer(data, filters);
  if (!c) return emptyDocument('bills', t.bills.title, data, range);

  const billing = billingAsOf(c, data.today, data.offers);
  const months = new Set(monthsOfRange(range));
  const rows = billing.timeline.filter((r) => months.has(r.month)).sort((a, b) => a.month.localeCompare(b.month));
  const lines = deliveredLinesForCustomer(c).filter((l) => months.has(l.ymd.slice(0, 7)));

  const hasOffers = data.offers.length > 0;
  const offerLines = offerDiscountEntries([c], rows.map((r) => r.month), data.offers);
  const offerDiscountTotal = sum(rows, (r) => r.offerDiscount);
  // Offer prices on delivered orders plus what offers took off the bills.
  const saved = sum(lines, (l) => l.savings ?? 0) + offerDiscountTotal;

  const billed = sum(rows, (r) => r.baseAmount);
  const stats: ReportStat[] = [
    { label: L.billed, value: billed, kind: 'money', hint: t.bills.billCount(rows.length) },
    { label: L.paidTowardsBills, value: sum(rows, (r) => r.paidApplied), kind: 'money', tone: 'good' },
    { label: L.outstandingToday, value: billing.outstanding, kind: 'money', tone: billing.outstanding > 0 ? 'bad' : 'good' },
    { label: L.advance, value: billing.advance, kind: 'money' },
  ];
  if (hasOffers || saved > 0) {
    stats.push({ label: options.customerView ? L.youSaved : L.savedWithOffers, value: saved, kind: 'money', tone: 'good', hint: t.bills.savedHint });
  }
  const discount = Math.max(0, Number(c.discountAmount ?? 0));

  return {
    kind: 'bills',
    title: t.bills.title,
    subject: subjectOf(c),
    range,
    generatedAtIso: data.nowIso,
    stats,
    tables: [
      {
        id: 'bills',
        title: t.bills.billsTitle,
        columns: [
          { key: 'month', label: L.month, kind: 'date', primary: true },
          { key: 'billDate', label: L.billDate, kind: 'date' },
          { key: 'dueDate', label: L.dueBy, kind: 'date' },
          ...(hasOffers ? [{ key: 'offerDiscount', label: L.offerDiscounts, kind: 'money' as const }] : []),
          { key: 'charges', label: L.charges, kind: 'money' },
          { key: 'carried', label: L.carriedFromEarlier, kind: 'money' },
          { key: 'total', label: L.billTotal, kind: 'money' },
          { key: 'paid', label: L.paid, kind: 'money' },
          { key: 'pending', label: L.pending, kind: 'money' },
          { key: 'status', label: L.status, kind: 'text' },
        ],
        rows: rows.map((r) => ({
          month: r.month,
          billDate: r.billDateYmd,
          dueDate: r.dueDateYmd,
          ...(hasOffers ? { offerDiscount: r.offerDiscount } : {}),
          charges: r.baseAmount,
          carried: r.carryForwardIn,
          total: r.invoiceTotal,
          paid: r.paidApplied,
          pending: r.pending,
          status: r.billDateYmd > data.today ? t.bills.running : reportStatusLabel(r.status),
        })),
        totals: {
          month: null,
          billDate: null,
          dueDate: null,
          ...(hasOffers ? { offerDiscount: offerDiscountTotal } : {}),
          charges: billed,
          carried: null,
          total: null,
          paid: sum(rows, (r) => r.paidApplied),
          pending: null,
          status: null,
        },
        emptyText: t.bills.emptyBills,
      },
      ...(hasOffers
        ? [
            {
              id: 'offers',
              title: t.bills.offersTitle,
              columns: [
                { key: 'month', label: L.month, kind: 'date' as const, primary: true },
                { key: 'offer', label: L.offer, kind: 'text' as const },
                { key: 'amount', label: L.amount, kind: 'money' as const },
              ],
              rows: offerLines
                .sort((a, b) => a.month.localeCompare(b.month) || b.amount - a.amount)
                .map((l) => ({ month: l.month, offer: strings('offers').billLine(offerText(l.title)), amount: -l.amount })),
              totals: { month: null, offer: null, amount: -offerDiscountTotal },
              emptyText: t.bills.emptyOffers,
            },
          ]
        : []),
      {
        id: 'items',
        title: t.bills.itemsTitle,
        columns: [
          { key: 'month', label: L.month, kind: 'date' },
          { key: 'item', label: L.item, kind: 'text', primary: true },
          { key: 'type', label: L.type, kind: 'text' },
          { key: 'days', label: L.days, kind: 'number' },
          { key: 'packs', label: L.packs, kind: 'number' },
          { key: 'amount', label: L.amount, kind: 'money' },
        ],
        rows: Array.from(
          groupBy(lines, (l) => `${l.ymd.slice(0, 7)}|${l.kind}|${l.offerId ?? ''}|${lineItem(l)}`),
        ).map(([, group]) => {
          const first = group[0]!;
          return {
            month: first.ymd.slice(0, 7),
            item: lineItem(first),
            type: lineType(first),
            days: new Set(group.map((g) => g.ymd)).size,
            packs: sum(group, (g) => g.packs),
            amount: sum(group, (g) => g.amount),
          };
        }),
        totals: { month: null, item: null, type: null, days: null, packs: sum(lines, (l) => l.packs), amount: sum(lines, (l) => l.amount) },
        emptyText: t.bills.emptyItems,
      },
    ],
    notes: [
      t.bills.noteMonthly,
      discount > 0 ? t.bills.noteDiscount(formatReportMoney(discount)) : t.bills.noteCharges,
      ...(hasOffers ? [t.bills.noteOffers] : []),
      t.bills.noteCarried,
      t.bills.noteOutstanding(formatReportDate(data.today)),
    ],
  };
}

export function buildCustomerPaymentsReport(data: ReportData, range: ReportRange, filters: ReportFilterValues): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const c = pickCustomer(data, filters);
  if (!c) return emptyDocument('customerPayments', t.customerPayments.title, data, range);
  const billing = billingAsOf(c, data.today, data.offers);
  const payments = (c.payments ?? [])
    .map((p) => ({ p, ymd: dayOf(p.paymentDate) }))
    .filter((x) => inRange(x.ymd, range) && Number(x.p.amountPaid ?? 0) > 0)
    .sort((a, b) => b.ymd.localeCompare(a.ymd));
  const total = sum(payments, (x) => Math.max(0, Number(x.p.amountPaid ?? 0)));

  return {
    kind: 'customerPayments',
    title: t.customerPayments.title,
    subject: subjectOf(c),
    range,
    generatedAtIso: data.nowIso,
    stats: [
      { label: L.paidInPeriod, value: total, kind: 'money', tone: 'good' },
      { label: L.payments, value: payments.length, kind: 'number' },
      { label: L.outstandingToday, value: billing.outstanding, kind: 'money', tone: billing.outstanding > 0 ? 'bad' : 'good' },
      { label: L.advance, value: billing.advance, kind: 'money' },
    ],
    tables: [
      {
        id: 'payments',
        title: t.customerPayments.title,
        columns: [
          { key: 'date', label: L.date, kind: 'date', primary: true },
          { key: 'mode', label: L.mode, kind: 'text' },
          { key: 'reference', label: L.reference, kind: 'text' },
          { key: 'note', label: L.note, kind: 'text' },
          { key: 'amount', label: L.amount, kind: 'money' },
        ],
        rows: payments.map(({ p, ymd }) => ({
          date: ymd,
          mode: text(p.paymentMode) ? paymentModeLabel(text(p.paymentMode)) : '—',
          reference: text(p.transactionId) || '—',
          note: text(p.notes) || '—',
          amount: Math.max(0, Number(p.amountPaid ?? 0)),
        })),
        totals: { date: null, mode: null, reference: null, note: null, amount: total },
        emptyText: t.collections.empty,
      },
      {
        id: 'unpaid',
        title: t.customerPayments.unpaidTitle,
        columns: [
          { key: 'month', label: L.billMonth, kind: 'date', primary: true },
          { key: 'due', label: L.dueBy, kind: 'date' },
          { key: 'amount', label: L.amount, kind: 'money' },
          { key: 'state', label: L.status, kind: 'text' },
        ],
        rows: billing.unpaid.map((u) => ({
          month: u.month,
          due: u.dueDateYmd,
          amount: u.amount,
          state: u.overdue ? t.customerPayments.overdue : u.issued ? t.customerPayments.due : t.customerPayments.runningMonth,
        })),
        totals: { month: null, due: null, amount: billing.outstanding, state: null },
        emptyText: t.customerPayments.emptyUnpaid,
      },
    ],
  };
}

export function buildConsumptionReport(data: ReportData, range: ReportRange, filters: ReportFilterValues): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const c = pickCustomer(data, filters);
  if (!c) return emptyDocument('consumption', t.consumption.title, data, range);
  const lines = deliveredLinesForCustomer(c).filter((l) => inRange(l.ymd, range));
  const sized = lines.map((l) => ({ l, size: packSize(l.productName, l.packLabel, data.products) }));
  const litres = sum(sized.filter((x) => x.size.family === 'volume'), (x) => x.l.packs * x.size.quantity) / 1000;
  const hasVolume = sized.some((x) => x.size.family === 'volume');

  const byProduct = Array.from(groupBy(sized, (x) => x.l.productName)).map(([product, group]) => {
    const families = new Set(group.map((g) => g.size.family));
    const family = families.size === 1 ? group[0]!.size.family : 'count';
    const packs = sum(group, (g) => g.l.packs);
    return {
      product,
      packs,
      quantity: family === 'count' ? formatQuantity(packs, 'count') : formatQuantity(sum(group, (g) => g.l.packs * g.size.quantity), family),
      days: new Set(group.map((g) => g.l.ymd)).size,
      amount: sum(group, (g) => g.l.amount),
    };
  });

  const byMonth = monthsOfRange(range)
    .map((m) => {
      const group = sized.filter((x) => x.l.ymd.slice(0, 7) === m);
      return {
        month: m,
        packs: sum(group, (g) => g.l.packs),
        litres: Math.round((sum(group.filter((g) => g.size.family === 'volume'), (g) => g.l.packs * g.size.quantity) / 1000) * 100) / 100,
        amount: sum(group, (g) => g.l.amount),
      };
    })
    .filter((r) => r.packs > 0);

  const days = new Set(lines.map((l) => l.ymd)).size;

  return {
    kind: 'consumption',
    title: t.consumption.title,
    subject: subjectOf(c),
    range,
    generatedAtIso: data.nowIso,
    stats: [
      { label: L.litres, value: Math.round(litres * 100) / 100, kind: 'quantity', tone: 'good' },
      { label: L.packs, value: sum(lines, (l) => l.packs), kind: 'number' },
      { label: L.daysDelivered, value: days, kind: 'number' },
      { label: L.litresPerDeliveredDay, value: days ? Math.round((litres / days) * 100) / 100 : 0, kind: 'quantity' },
      { label: L.spent, value: sum(lines, (l) => l.amount), kind: 'money' },
    ],
    trend: {
      title: hasVolume ? L.litres : L.packs,
      kind: hasVolume ? 'quantity' : 'number',
      points: trendBuckets(range).map((b) => {
        const group = sized.filter((x) => x.l.ymd >= b.fromYmd && x.l.ymd <= b.toYmd);
        return {
          label: b.label,
          value: hasVolume
            ? Math.round((sum(group.filter((g) => g.size.family === 'volume'), (g) => g.l.packs * g.size.quantity) / 1000) * 100) / 100
            : sum(group, (g) => g.l.packs),
        };
      }),
    },
    tables: [
      {
        id: 'byProduct',
        title: t.tables.byProduct,
        columns: [
          { key: 'product', label: L.product, kind: 'text', primary: true },
          { key: 'packs', label: L.packs, kind: 'number' },
          { key: 'quantity', label: L.quantity, kind: 'text' },
          { key: 'days', label: L.days, kind: 'number' },
          { key: 'amount', label: L.spent, kind: 'money' },
        ],
        rows: byProduct.sort((a, b) => b.amount - a.amount),
        totals: { product: null, packs: sum(lines, (l) => l.packs), quantity: null, days, amount: sum(lines, (l) => l.amount) },
        emptyText: t.consumption.empty,
      },
      {
        id: 'byMonth',
        title: t.tables.byMonth,
        columns: [
          { key: 'month', label: L.month, kind: 'date', primary: true },
          { key: 'packs', label: L.packs, kind: 'number' },
          { key: 'litres', label: L.litres, kind: 'quantity' },
          { key: 'amount', label: L.spent, kind: 'money' },
        ],
        rows: byMonth,
        totals: { month: null, packs: sum(byMonth, (r) => r.packs), litres: Math.round(litres * 100) / 100, amount: sum(byMonth, (r) => r.amount) },
        emptyText: t.consumption.empty,
      },
    ],
  };
}

