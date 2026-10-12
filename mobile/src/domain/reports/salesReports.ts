import {
  boyNameForCustomer,
  changeHint,
  deliveredLinesInRange,
  filterCustomers,
  filterValue,
  groupBy,
  offerDiscountEntries,
  packSize,
  routeOf,
  sum,
  type DeliveredLine,
  type ReportData,
} from '@/src/domain/reports/data';
import {
  daysOfRange,
  formatRange,
  monthsOfRange,
  previousRange,
  rangeDayCount,
  trendBuckets,
  type ReportRange,
} from '@/src/domain/reports/dateRange';
import { formatQuantity, formatReportDate, percentOf } from '@/src/domain/reports/format';
import { ALL, type ReportDocument, type ReportFilterValues, type ReportTable } from '@/src/domain/reports/model';
import { strings } from '@/src/i18n/strings';

/**
 * Sales: what was delivered and billed. A day counts once the delivery boy marks it delivered — the same rule the
 * monthly bills use — so these totals add up to the bills (before each customer's monthly discount).
 */

function salesNotes(): string[] {
  const t = strings('reports').sales;
  return [t.noteCounted, t.noteDiscount];
}

function futureNote(range: ReportRange, today: string): string[] {
  return range.toYmd > today ? [strings('reports').sales.noteFuture] : [];
}

function money(lines: readonly DeliveredLine[], kind?: DeliveredLine['kind']): number {
  return sum(kind ? lines.filter((l) => l.kind === kind) : lines, (l) => l.amount);
}

export function buildSalesReport(data: ReportData, range: ReportRange, filters: ReportFilterValues): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const customers = filterCustomers(data.customers, data.boys, filters);
  const byId = new Map(customers.map((c) => [c.id, c]));
  const lines = deliveredLinesInRange(customers, range);
  const previous = deliveredLinesInRange(customers, previousRange(range));

  const total = money(lines);
  const subscription = money(lines, 'subscription');
  const addOns = money(lines, 'addon');
  const served = new Set(lines.map((l) => l.customerId)).size;
  const elapsedDays = daysOfRange(range).filter((d) => d <= data.today).length;

  // What offers took off the bills of the months the dates touch (bills are monthly, so months count in full).
  const hasOffers = data.offers.length > 0;
  const months = monthsOfRange(range);
  const discounts = offerDiscountEntries(customers, months, data.offers);
  const discountTotal = sum(discounts, (d) => d.amount);
  const discountByCustomer = new Map<string, number>();
  for (const d of discounts) discountByCustomer.set(d.customerId, (discountByCustomer.get(d.customerId) ?? 0) + d.amount);
  const discountOf = (customerIds: Iterable<string>) => {
    let total = 0;
    for (const id of customerIds) total += discountByCustomer.get(id) ?? 0;
    return total;
  };
  /** Offer discounts of the customers with sales in the dates — what the tables below add up. */
  const servedDiscount = discountOf(new Set(lines.map((l) => l.customerId)));
  const monthsText =
    months.length > 1 ? `${formatReportDate(months[0]!)} – ${formatReportDate(months[months.length - 1]!)}` : months.map(formatReportDate).join('');

  const trend = trendBuckets(range).map((b) => ({
    label: b.label,
    value: Math.round(money(lines.filter((l) => l.ymd >= b.fromYmd && l.ymd <= b.toYmd))),
  }));

  const byDay: ReportTable = {
    id: 'byDay',
    title: rangeDayCount(range) > 45 ? t.sales.byPeriodTitle : t.sales.byDayTitle,
    columns: [
      { key: 'period', label: rangeDayCount(range) > 45 ? L.period : L.date, kind: 'text', primary: true },
      { key: 'customers', label: L.customers, kind: 'number' },
      { key: 'subscription', label: L.subscription, kind: 'money' },
      { key: 'addons', label: L.addOns, kind: 'money' },
      { key: 'total', label: L.total, kind: 'money' },
    ],
    rows: trendBuckets(range)
      .map((b) => {
        const inBucket = lines.filter((l) => l.ymd >= b.fromYmd && l.ymd <= b.toYmd);
        return {
          period: rangeDayCount(range) > 45 ? formatRange({ fromYmd: b.fromYmd, toYmd: b.toYmd }) : b.fromYmd,
          customers: new Set(inBucket.map((l) => l.customerId)).size,
          subscription: money(inBucket, 'subscription'),
          addons: money(inBucket, 'addon'),
          total: money(inBucket),
          _has: inBucket.length,
        };
      })
      .filter((r) => r._has > 0)
      .map(({ _has, ...r }) => r),
    totals: { period: null, customers: served, subscription, addons: addOns, total },
    emptyText: t.sales.emptyByDay,
  };
  // Day rows read as dates when each bucket is one day.
  if (rangeDayCount(range) <= 45) byDay.columns[0] = { ...byDay.columns[0]!, kind: 'date' };

  const groupTable = (id: string, title: string, label: string, keyOf: (l: DeliveredLine) => string): ReportTable => ({
    id,
    title,
    columns: [
      { key: 'name', label, kind: 'text', primary: true },
      { key: 'customers', label: L.customers, kind: 'number' },
      { key: 'subscription', label: L.subscription, kind: 'money' },
      { key: 'addons', label: L.addOns, kind: 'money' },
      { key: 'total', label: L.total, kind: 'money' },
      ...(hasOffers ? [{ key: 'offerDiscount', label: L.offerDiscounts, kind: 'money' as const }] : []),
      { key: 'share', label: L.share, kind: 'percent' },
    ],
    rows: Array.from(groupBy(lines, keyOf))
      .map(([name, group]) => {
        const ids = new Set(group.map((l) => l.customerId));
        return {
          name,
          customers: ids.size,
          subscription: money(group, 'subscription'),
          addons: money(group, 'addon'),
          total: money(group),
          ...(hasOffers ? { offerDiscount: discountOf(ids) } : {}),
          share: percentOf(money(group), total),
        };
      })
      .sort((a, b) => b.total - a.total),
    totals: {
      name: null,
      customers: served,
      subscription,
      addons: addOns,
      total,
      ...(hasOffers ? { offerDiscount: servedDiscount } : {}),
      share: total > 0 ? 100 : 0,
    },
    emptyText: t.sales.emptyGroup,
  });

  const topCustomers: ReportTable = {
    id: 'topCustomers',
    title: t.sales.topCustomersTitle,
    columns: [
      { key: 'name', label: L.customer, kind: 'text', primary: true },
      { key: 'route', label: L.route, kind: 'text' },
      { key: 'days', label: L.daysDelivered, kind: 'number' },
      { key: 'total', label: L.sales, kind: 'money' },
      ...(hasOffers
        ? [
            { key: 'offerDiscount', label: L.offerDiscounts, kind: 'money' as const },
            { key: 'net', label: L.afterOfferDiscounts, kind: 'money' as const },
          ]
        : []),
    ],
    rows: Array.from(groupBy(lines, (l) => l.customerId))
      .map(([id, group]) => {
        const c = byId.get(id)!;
        const sales = money(group);
        const off = discountByCustomer.get(id) ?? 0;
        return {
          name: c.name,
          route: routeOf(c),
          days: new Set(group.map((l) => l.ymd)).size,
          total: sales,
          ...(hasOffers ? { offerDiscount: off, net: sales - off } : {}),
        };
      })
      .sort((a, b) => b.total - a.total),
    totals: {
      name: null,
      route: null,
      days: null,
      total,
      ...(hasOffers ? { offerDiscount: servedDiscount, net: total - servedDiscount } : {}),
    },
    emptyText: t.sales.emptyTopCustomers,
  };

  return {
    kind: 'sales',
    title: t.catalog.sales.title,
    range,
    generatedAtIso: data.nowIso,
    stats: [
      { label: L.totalSales, value: total, kind: 'money', hint: changeHint(total, money(previous)), tone: 'good' },
      { label: L.subscriptions, value: subscription, kind: 'money' },
      { label: L.addOnOrders, value: addOns, kind: 'money' },
      { label: L.customersServed, value: served, kind: 'number' },
      { label: L.averagePerDay, value: elapsedDays ? total / elapsedDays : 0, kind: 'money', hint: t.sales.daysSoFar(elapsedDays) },
      ...(hasOffers
        ? [
            { label: L.offerDiscounts, value: discountTotal, kind: 'money' as const, tone: 'warn' as const, hint: monthsText ? t.sales.offerDiscountsHint(monthsText) : undefined },
            { label: L.afterOfferDiscounts, value: total - discountTotal, kind: 'money' as const },
          ]
        : []),
    ],
    trend: { title: L.sales, kind: 'money', points: trend },
    tables: [
      byDay,
      groupTable('byRoute', t.sales.byRouteTitle, L.route, (l) => routeOf(byId.get(l.customerId)!)),
      groupTable('byBoy', t.sales.byBoyTitle, L.deliveryBoy, (l) => boyNameForCustomer(byId.get(l.customerId)!, data.boys)),
      topCustomers,
    ],
    notes: [
      ...salesNotes(),
      ...(hasOffers ? [t.sales.noteOfferDiscounts] : []),
      t.sales.noteCurrentAssignment,
      ...futureNote(range, data.today),
    ],
  };
}

export function buildProductSalesReport(data: ReportData, range: ReportRange, filters: ReportFilterValues): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const customers = filterCustomers(data.customers, data.boys, filters);
  const product = filterValue(filters, 'product');
  const lines = deliveredLinesInRange(customers, range).filter((l) => product === ALL || l.productName === product);

  const total = money(lines);
  const packsTotal = sum(lines, (l) => l.packs);

  const packRows = Array.from(groupBy(lines, (l) => `${l.productName}|${l.packLabel}`))
    .map(([, group]) => {
      const first = group[0]!;
      const size = packSize(first.productName, first.packLabel, data.products);
      const packs = sum(group, (l) => l.packs);
      return {
        product: first.productName,
        pack: first.packLabel || '—',
        subscriptionPacks: sum(group.filter((l) => l.kind === 'subscription'), (l) => l.packs),
        addonPacks: sum(group.filter((l) => l.kind === 'addon'), (l) => l.packs),
        packs,
        quantity: size.family === 'count' ? formatQuantity(packs, 'count') : formatQuantity(packs * size.quantity, size.family),
        amount: money(group),
        share: percentOf(money(group), total),
        _family: size.family,
        _base: packs * size.quantity,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const productRows = Array.from(groupBy(packRows, (r) => r.product))
    .map(([name, group]) => {
      const families = new Set(group.map((g) => g._family));
      const family = families.size === 1 ? group[0]!._family : 'count';
      return {
        product: name,
        packs: sum(group, (g) => g.packs),
        quantity: family === 'count' ? formatQuantity(sum(group, (g) => g.packs), 'count') : formatQuantity(sum(group, (g) => g._base), family),
        amount: sum(group, (g) => g.amount),
        share: percentOf(sum(group, (g) => g.amount), total),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const litres = sum(packRows.filter((r) => r._family === 'volume'), (r) => r._base) / 1000;
  const kilos = sum(packRows.filter((r) => r._family === 'weight'), (r) => r._base) / 1000;

  return {
    kind: 'productSales',
    title: t.catalog.productSales.title,
    range,
    generatedAtIso: data.nowIso,
    stats: [
      { label: L.sales, value: total, kind: 'money', tone: 'good' },
      { label: L.packsDelivered, value: packsTotal, kind: 'number' },
      { label: L.litres, value: Math.round(litres * 100) / 100, kind: 'quantity', hint: t.productSales.litresHint },
      { label: L.kilograms, value: Math.round(kilos * 100) / 100, kind: 'quantity' },
      { label: L.productsSold, value: productRows.length, kind: 'number' },
    ],
    trend: {
      title: L.packsDelivered,
      kind: 'number',
      points: trendBuckets(range).map((b) => ({
        label: b.label,
        value: sum(lines.filter((l) => l.ymd >= b.fromYmd && l.ymd <= b.toYmd), (l) => l.packs),
      })),
    },
    tables: [
      {
        id: 'byProduct',
        title: t.tables.byProduct,
        columns: [
          { key: 'product', label: L.product, kind: 'text', primary: true },
          { key: 'packs', label: L.packs, kind: 'number' },
          { key: 'quantity', label: L.quantity, kind: 'text' },
          { key: 'amount', label: L.sales, kind: 'money' },
          { key: 'share', label: L.share, kind: 'percent' },
        ],
        rows: productRows,
        totals: { product: null, packs: packsTotal, quantity: null, amount: total, share: total > 0 ? 100 : 0 },
        emptyText: t.productSales.empty,
      },
      {
        id: 'byPack',
        title: t.productSales.byPackTitle,
        columns: [
          { key: 'product', label: L.product, kind: 'text', primary: true },
          { key: 'pack', label: L.pack, kind: 'text' },
          { key: 'subscriptionPacks', label: L.subscriptionPacks, kind: 'number' },
          { key: 'addonPacks', label: L.addOnPacks, kind: 'number' },
          { key: 'packs', label: L.totalPacks, kind: 'number' },
          { key: 'quantity', label: L.quantity, kind: 'text' },
          { key: 'amount', label: L.sales, kind: 'money' },
        ],
        rows: packRows.map(({ _family, _base, share, ...r }) => r),
        totals: {
          product: null,
          pack: null,
          subscriptionPacks: sum(packRows, (r) => r.subscriptionPacks),
          addonPacks: sum(packRows, (r) => r.addonPacks),
          packs: packsTotal,
          quantity: null,
          amount: total,
        },
        emptyText: t.productSales.empty,
      },
    ],
    notes: [...salesNotes(), ...futureNote(range, data.today)],
  };
}

const TAX_RATE = (value: string | undefined): number => {
  const n = Number(String(value ?? '').replace('%', ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function buildTaxReport(data: ReportData, range: ReportRange, filters: ReportFilterValues): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const customers = filterCustomers(data.customers, data.boys, filters);
  const lines = deliveredLinesInRange(customers, range);
  const rateOf = (productName: string): number => {
    const p = data.products.find((x) => x.name.trim().toLowerCase() === productName.trim().toLowerCase());
    return p?.taxApplicable ? TAX_RATE(p.taxPercentage) : 0;
  };

  type TaxLine = { product: string; rate: number; gross: number; taxable: number; tax: number };
  const taxLines: TaxLine[] = lines.map((l) => {
    const rate = rateOf(l.productName);
    // Catalogue prices are what the customer pays, so tax is taken out of them (tax-inclusive).
    const taxable = rate > 0 ? (l.amount * 100) / (100 + rate) : l.amount;
    return { product: l.productName, rate, gross: l.amount, taxable, tax: l.amount - taxable };
  });

  const byRate = Array.from(groupBy(taxLines, (t) => String(t.rate)))
    .map(([rate, group]) => ({
      rate: Number(rate) > 0 ? `${rate}%` : t.tax.noTax,
      taxable: sum(group, (g) => g.taxable),
      tax: sum(group, (g) => g.tax),
      gross: sum(group, (g) => g.gross),
      _rate: Number(rate),
    }))
    .sort((a, b) => a._rate - b._rate)
    .map(({ _rate, ...r }) => r);

  const byProduct = Array.from(groupBy(taxLines, (t) => t.product))
    .map(([product, group]) => ({
      product,
      rate: group[0]!.rate > 0 ? `${group[0]!.rate}%` : t.tax.noTax,
      taxable: sum(group, (g) => g.taxable),
      tax: sum(group, (g) => g.tax),
      gross: sum(group, (g) => g.gross),
    }))
    .sort((a, b) => b.tax - a.tax || b.gross - a.gross);

  const gross = sum(taxLines, (t) => t.gross);
  const tax = sum(taxLines, (t) => t.tax);
  const taxableSales = sum(taxLines.filter((t) => t.rate > 0), (t) => t.gross);

  return {
    kind: 'tax',
    title: t.catalog.tax.title,
    range,
    generatedAtIso: data.nowIso,
    stats: [
      { label: L.totalSales, value: gross, kind: 'money' },
      { label: L.salesWithTax, value: taxableSales, kind: 'money' },
      { label: L.taxableValue, value: gross - tax, kind: 'money' },
      { label: L.taxIncluded, value: tax, kind: 'money', tone: 'warn' },
    ],
    tables: [
      {
        id: 'byRate',
        title: t.tax.byRateTitle,
        columns: [
          { key: 'rate', label: L.rate, kind: 'text', primary: true },
          { key: 'taxable', label: L.taxableValue, kind: 'money' },
          { key: 'tax', label: L.tax, kind: 'money' },
          { key: 'gross', label: L.salesInclTax, kind: 'money' },
        ],
        rows: byRate,
        totals: { rate: null, taxable: gross - tax, tax, gross },
        emptyText: t.tax.empty,
      },
      {
        id: 'byProduct',
        title: t.tables.byProduct,
        columns: [
          { key: 'product', label: L.product, kind: 'text', primary: true },
          { key: 'rate', label: L.rate, kind: 'text' },
          { key: 'taxable', label: L.taxableValue, kind: 'money' },
          { key: 'tax', label: L.tax, kind: 'money' },
          { key: 'gross', label: L.salesInclTax, kind: 'money' },
        ],
        rows: byProduct,
        totals: { product: null, rate: null, taxable: gross - tax, tax, gross },
        emptyText: t.tax.empty,
      },
    ],
    notes: [
      t.tax.noteRates,
      t.tax.noteInclusive,
      t.tax.noteNotAdded,
      t.sales.noteCounted,
    ],
  };
}
