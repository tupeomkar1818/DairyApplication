import { addOnDateYmd, addOnItemCount, addOnLineTotal } from '@/src/domain/customers/addOns';
import type { CustomerExtraOrder } from '@/src/domain/customers/entities';
import type { Offer, OfferKind, OfferText } from '@/src/domain/offers/entities';
import { offerStatus, offerText, orderSavings } from '@/src/domain/offers/offers';
import { filterCustomers, offerDiscountEntries, sum, type OfferDiscountEntry, type ReportData } from '@/src/domain/reports/data';
import { inRange, monthsOfRange, type ReportRange } from '@/src/domain/reports/dateRange';
import { formatReportDate } from '@/src/domain/reports/format';
import type { ReportDocument, ReportFilterValues } from '@/src/domain/reports/model';
import { strings } from '@/src/i18n/strings';

/**
 * How each offer did: the one-off orders placed under it for delivery days in the dates (sold at the offer price, and
 * what customers saved on them), and what it took off the monthly bills. Bills are monthly, so bill discounts count
 * every month the dates touch in full — the same figures the customers' bills show.
 */

type OrderHit = { customerId: string; order: CustomerExtraOrder };

type OfferRowSource = {
  id: string;
  kind: OfferKind;
  title: OfferText;
  offer: Offer | null;
};

/** Offers whose dates overlap the range. */
function overlaps(offer: Pick<Offer, 'startYmd' | 'endYmd'>, range: ReportRange): boolean {
  return offer.startYmd <= range.toYmd && (!offer.endYmd || offer.endYmd >= range.fromYmd);
}

export function buildOffersReport(data: ReportData, range: ReportRange, filters: ReportFilterValues): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const words = strings('offers');
  const customers = filterCustomers(data.customers, data.boys, filters);
  const months = monthsOfRange(range);

  // Orders placed under an offer, not cancelled, with their delivery day in the dates.
  const ordersByOffer = new Map<string, OrderHit[]>();
  const snapshots = new Map<string, OfferRowSource>();
  for (const c of customers) {
    for (const order of c.extraOrders ?? []) {
      if (!order.offer || order.status === 'Cancelled' || !inRange(addOnDateYmd(order), range)) continue;
      const id = order.offer.offerId;
      const list = ordersByOffer.get(id);
      if (list) list.push({ customerId: c.id, order });
      else ordersByOffer.set(id, [{ customerId: c.id, order }]);
      if (!snapshots.has(id)) snapshots.set(id, { id, kind: order.offer.kind, title: order.offer.title, offer: null });
    }
  }

  const discounts = offerDiscountEntries(customers, months, data.offers);
  const discountsByOffer = new Map<string, OfferDiscountEntry[]>();
  for (const d of discounts) {
    const list = discountsByOffer.get(d.offerId);
    if (list) list.push(d);
    else discountsByOffer.set(d.offerId, [d]);
  }

  // Every offer that ran in the dates, plus any with orders or discounts here (an offer ended early may still have
  // orders placed before it ended; a removed offer lives on in its orders' snapshot).
  const sources: OfferRowSource[] = [];
  const seen = new Set<string>();
  for (const offer of data.offers) {
    if (!overlaps(offer, range) && !ordersByOffer.has(offer.id) && !discountsByOffer.has(offer.id)) continue;
    sources.push({ id: offer.id, kind: offer.kind, title: offer.title, offer });
    seen.add(offer.id);
  }
  for (const [id, snap] of snapshots) if (!seen.has(id)) sources.push(snap);
  sources.sort(
    (a, b) =>
      String(a.offer?.startYmd ?? '9999').localeCompare(String(b.offer?.startYmd ?? '9999')) ||
      offerText(a.title).localeCompare(offerText(b.title)),
  );

  const rows = sources.map((s) => {
    const orders = ordersByOffer.get(s.id) ?? [];
    const delivered = orders.filter((x) => x.order.status === 'Delivered');
    const offerDiscounts = (discountsByOffer.get(s.id) ?? []).filter((d) => d.amount > 0);
    const reached = new Set([...orders.map((x) => x.customerId), ...offerDiscounts.map((d) => d.customerId)]);
    return {
      offer: offerText(s.title) || t.offerReport.removedOffer,
      kind: words.kinds[s.kind],
      status: s.offer ? words.status[offerStatus(s.offer, data.today)] : t.offerReport.removedOffer,
      code: s.offer?.code || null,
      from: s.offer?.startYmd ?? null,
      to: s.offer ? (s.offer.endYmd ?? t.offerReport.untilEnded) : null,
      orders: orders.length,
      deliveredOrders: delivered.length,
      packs: sum(delivered, (x) => addOnItemCount(x.order)),
      sales: sum(delivered, (x) => addOnLineTotal(x.order)),
      savings: sum(delivered, (x) => orderSavings(x.order)),
      billDiscounts: sum(offerDiscounts, (d) => d.amount),
      customers: reached.size,
      _reached: reached,
    };
  });

  const allReached = new Set<string>();
  for (const r of rows) for (const id of r._reached) allReached.add(id);
  const orders = sum(rows, (r) => r.orders);
  const sales = sum(rows, (r) => r.sales);
  const savings = sum(rows, (r) => r.savings);
  const billDiscounts = sum(rows, (r) => r.billDiscounts);

  const byMonth = months
    .flatMap((month) =>
      sources.map((s) => {
        const group = (discountsByOffer.get(s.id) ?? []).filter((d) => d.month === month && d.amount > 0);
        return {
          month,
          offer: offerText(s.title) || t.offerReport.removedOffer,
          customers: new Set(group.map((d) => d.customerId)).size,
          amount: sum(group, (d) => d.amount),
        };
      }),
    )
    .filter((r) => r.amount > 0);

  const monthsText =
    months.length > 1 ? `${formatReportDate(months[0]!)} – ${formatReportDate(months[months.length - 1]!)}` : months.map(formatReportDate).join('');

  return {
    kind: 'offers',
    title: t.catalog.offers.title,
    range,
    generatedAtIso: data.nowIso,
    stats: [
      { label: L.offers, value: rows.length, kind: 'number' },
      { label: L.orders, value: orders, kind: 'number' },
      { label: L.deliveredOrders, value: sum(rows, (r) => r.deliveredOrders), kind: 'number' },
      { label: L.salesAtOfferPrice, value: sales, kind: 'money', tone: 'good' },
      { label: L.customerSavings, value: savings, kind: 'money' },
      { label: L.billDiscounts, value: billDiscounts, kind: 'money', tone: 'warn' },
      { label: L.totalSaved, value: savings + billDiscounts, kind: 'money' },
      { label: L.customersReached, value: allReached.size, kind: 'number' },
    ],
    tables: [
      {
        id: 'offers',
        title: t.offerReport.tableTitle,
        columns: [
          { key: 'offer', label: L.offer, kind: 'text', primary: true },
          { key: 'kind', label: L.kind, kind: 'text' },
          { key: 'status', label: L.status, kind: 'text' },
          { key: 'code', label: L.code, kind: 'text' },
          { key: 'from', label: L.from, kind: 'date' },
          { key: 'to', label: L.to, kind: 'date' },
          { key: 'orders', label: L.orders, kind: 'number' },
          { key: 'deliveredOrders', label: L.deliveredOrders, kind: 'number' },
          { key: 'packs', label: L.packsOrCombos, kind: 'number' },
          { key: 'sales', label: L.salesAtOfferPrice, kind: 'money' },
          { key: 'savings', label: L.customerSavings, kind: 'money' },
          { key: 'billDiscounts', label: L.billDiscounts, kind: 'money' },
          { key: 'customers', label: L.customersReached, kind: 'number' },
        ],
        rows: rows.map(({ _reached, ...r }) => r),
        totals: {
          offer: null,
          kind: null,
          status: null,
          code: null,
          from: null,
          to: null,
          orders,
          deliveredOrders: sum(rows, (r) => r.deliveredOrders),
          packs: sum(rows, (r) => r.packs),
          sales,
          savings,
          billDiscounts,
          customers: allReached.size,
        },
        emptyText: t.offerReport.empty,
      },
      {
        id: 'billDiscountsByMonth',
        title: t.offerReport.byMonthTitle,
        columns: [
          { key: 'month', label: L.billMonth, kind: 'date' },
          { key: 'offer', label: L.offer, kind: 'text', primary: true },
          { key: 'customers', label: L.customers, kind: 'number' },
          { key: 'amount', label: L.billDiscounts, kind: 'money' },
        ],
        rows: byMonth,
        totals: { month: null, offer: null, customers: null, amount: billDiscounts },
        emptyText: t.offerReport.emptyByMonth,
      },
    ],
    notes: [
      t.offerReport.noteOrders,
      t.offerReport.noteSavings,
      ...(monthsText ? [t.offerReport.noteBillMonth(monthsText)] : []),
      t.offerReport.noteReached,
    ],
  };
}
