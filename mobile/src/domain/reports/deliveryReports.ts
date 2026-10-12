import { buildTodayEntries, type TodayEntry } from '@/src/components/admin/dashboardMetrics';
import { buildLoadSheet } from '@/src/components/delivery/loadSheet';
import { isDaySkipped, planQuantityOn, quantityChangeOn } from '@/src/domain/customers/daySchedule';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { subscriptionPlanActiveOnDateYmd } from '@/src/domain/customers/planSchedule';
import {
  boyNameForCustomer,
  filterCustomers,
  groupBy,
  packSize,
  routeOf,
  sum,
  type ReportData,
} from '@/src/domain/reports/data';
import { daysOfRange, formatRange, rangeDayCount, trendBuckets, type ReportRange } from '@/src/domain/reports/dateRange';
import { formatQuantity, percentOf } from '@/src/domain/reports/format';
import type { ReportDocument, ReportFilterValues, ReportTable } from '@/src/domain/reports/model';
import { strings } from '@/src/i18n/strings';

/**
 * Deliveries: what was due each day, and how each stop was marked. A "stop" is one customer on one day with anything
 * to deliver — the unit the run sheet and the dashboard count.
 */

export type StopStatus = 'Delivered' | 'Not delivered' | 'Not marked' | 'Scheduled';

type Stop = {
  ymd: string;
  customer: CustomerResponse;
  entry: TodayEntry;
  status: StopStatus;
  packs: number;
  markedBy: string;
  reason: string;
};

type SkippedLine = { ymd: string; customer: CustomerResponse; item: string; reason: string; by: string };

const text = (value: unknown) => String(value ?? '').trim();

function stopStatus(entry: TodayEntry, ymd: string, today: string): StopStatus {
  if (entry.status === 'Delivered') return 'Delivered';
  if (entry.status === 'Not delivered') return 'Not delivered';
  // Today's round is still going: an unmarked stop today is to come, not forgotten.
  return ymd >= today ? 'Scheduled' : 'Not marked';
}

function collectStops(customers: readonly CustomerResponse[], range: ReportRange, today: string): Stop[] {
  const byId = new Map(customers.map((c) => [c.id, c]));
  const stops: Stop[] = [];
  for (const ymd of daysOfRange(range)) {
    for (const entry of buildTodayEntries(customers, ymd)) {
      const customer = byId.get(entry.customerId)!;
      const status = stopStatus(entry, ymd, today);
      const rows = (customer.deliveries ?? []).filter((d) => text(d.deliveryDate).slice(0, 10) === ymd);
      const markRow = rows
        .filter((d) => (status === 'Delivered' ? d.status === 'Delivered' : d.status === 'Missed'))
        .sort((a, b) => text(b.updatedAt).localeCompare(text(a.updatedAt)))[0];
      stops.push({
        ymd,
        customer,
        entry,
        status,
        packs: sum(entry.lines ?? [], (l) => l.count),
        markedBy: text(markRow?.deliveryBoyName),
        reason: status === 'Not delivered' ? text(markRow?.missedReason) : '',
      });
    }
  }
  return stops;
}

/** Subscription lines that would have run but the customer (or the dairy) paused or set to zero for the day. */
function collectSkips(customers: readonly CustomerResponse[], range: ReportRange): SkippedLine[] {
  const t = strings('reports');
  const out: SkippedLine[] = [];
  for (const ymd of daysOfRange(range)) {
    for (const customer of customers) {
      const exceptions = customer.subscriptionExceptions;
      if (!exceptions?.length) continue;
      for (const plan of customer.subscriptionPlans ?? []) {
        if (!subscriptionPlanActiveOnDateYmd(plan, ymd)) continue;
        if (planQuantityOn(plan, ymd, exceptions) > 0) continue;
        const skip = exceptions.find((ex) => (ex.kind ?? 'skip') === 'skip' && isDaySkipped([ex], ymd, plan.id));
        const change = quantityChangeOn(plan, ymd, exceptions);
        const source = skip ?? change;
        out.push({
          ymd,
          customer,
          item: [text(plan.productName), text(plan.quantityLabel)].filter(Boolean).join(' · '),
          reason: text(source?.reason) || (skip ? t.deliveries.paused : t.deliveries.setToZero),
          by: source?.createdBy === 'admin' ? t.values.dairy : source?.createdBy === 'customer' ? t.values.customer : '—',
        });
      }
    }
  }
  return out;
}

function counts(stops: readonly Stop[]) {
  const delivered = stops.filter((s) => s.status === 'Delivered').length;
  const missed = stops.filter((s) => s.status === 'Not delivered').length;
  const unmarked = stops.filter((s) => s.status === 'Not marked').length;
  const scheduled = stops.filter((s) => s.status === 'Scheduled').length;
  const settled = delivered + missed + unmarked;
  return { delivered, missed, unmarked, scheduled, settled, completion: percentOf(delivered, settled) };
}

export function buildDeliveriesReport(
  data: ReportData,
  range: ReportRange,
  filters: ReportFilterValues,
  options: { title?: string; kind?: string; showBoyTable?: boolean } = {},
): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const customers = filterCustomers(data.customers, data.boys, filters);
  const stops = collectStops(customers, range, data.today);
  const skips = collectSkips(customers, range);
  const c = counts(stops);

  const summaryColumns = (label: string): ReportTable['columns'] => [
    { key: 'name', label, kind: 'text', primary: true },
    { key: 'due', label: L.stops, kind: 'number' },
    { key: 'delivered', label: L.delivered, kind: 'number' },
    { key: 'missed', label: L.notDelivered, kind: 'number' },
    { key: 'unmarked', label: L.notMarked, kind: 'number' },
    { key: 'completion', label: L.completion, kind: 'percent' },
  ];
  const summaryRow = (name: string, group: readonly Stop[]) => {
    const g = counts(group);
    return {
      name,
      due: group.length,
      delivered: g.delivered,
      missed: g.missed,
      unmarked: g.unmarked,
      completion: g.settled ? g.completion : null,
    };
  };
  const totalsRow = { name: null, due: stops.length, delivered: c.delivered, missed: c.missed, unmarked: c.unmarked, completion: c.settled ? c.completion : null };

  const dayBuckets = trendBuckets(range);
  const long = rangeDayCount(range) > 45;

  const tables: ReportTable[] = [
    {
      id: 'byDay',
      title: long ? t.tables.byPeriod : t.tables.byDay,
      columns: [{ ...summaryColumns('')[0]!, label: long ? L.period : L.date, kind: long ? 'text' : 'date' }, ...summaryColumns('').slice(1)],
      rows: dayBuckets
        .map((b) => summaryRow(long ? formatRange({ fromYmd: b.fromYmd, toYmd: b.toYmd }) : b.fromYmd, stops.filter((s) => s.ymd >= b.fromYmd && s.ymd <= b.toYmd)))
        .filter((r) => r.due > 0),
      totals: totalsRow,
      emptyText: t.deliveries.empty,
    },
    {
      id: 'byRoute',
      title: t.tables.byRoute,
      columns: summaryColumns(L.route),
      rows: Array.from(groupBy(stops, (s) => routeOf(s.customer))).map(([name, group]) => summaryRow(name, group)).sort((a, b) => b.due - a.due),
      totals: totalsRow,
      emptyText: t.deliveries.empty,
    },
  ];

  if (options.showBoyTable !== false) {
    tables.push({
      id: 'byBoy',
      title: t.tables.byDeliveryBoy,
      note: t.deliveries.byBoyNote,
      columns: summaryColumns(L.deliveryBoy),
      rows: Array.from(groupBy(stops, (s) => boyNameForCustomer(s.customer, data.boys))).map(([name, group]) => summaryRow(name, group)).sort((a, b) => b.due - a.due),
      totals: totalsRow,
      emptyText: t.deliveries.empty,
    });
  }

  tables.push(
    {
      id: 'missed',
      title: L.notDelivered,
      columns: [
        { key: 'date', label: L.date, kind: 'date' },
        { key: 'customer', label: L.customer, kind: 'text', primary: true },
        { key: 'route', label: L.route, kind: 'text' },
        { key: 'items', label: L.items, kind: 'text' },
        { key: 'reason', label: L.reason, kind: 'text' },
        { key: 'by', label: L.markedBy, kind: 'text' },
      ],
      rows: stops
        .filter((s) => s.status === 'Not delivered')
        .map((s) => ({
          date: s.ymd,
          customer: s.customer.name,
          route: routeOf(s.customer),
          items: [...s.entry.planItems, ...s.entry.addOnItems].join(', '),
          reason: s.reason || '—',
          by: s.markedBy || '—',
        }))
        .reverse(),
      emptyText: t.deliveries.emptyMissed,
    },
    {
      id: 'unmarked',
      title: L.notMarked,
      note: t.deliveries.unmarkedNote,
      columns: [
        { key: 'date', label: L.date, kind: 'date' },
        { key: 'customer', label: L.customer, kind: 'text', primary: true },
        { key: 'route', label: L.route, kind: 'text' },
        { key: 'items', label: L.items, kind: 'text' },
      ],
      rows: stops
        .filter((s) => s.status === 'Not marked')
        .map((s) => ({ date: s.ymd, customer: s.customer.name, route: routeOf(s.customer), items: [...s.entry.planItems, ...s.entry.addOnItems].join(', ') }))
        .reverse(),
      emptyText: t.deliveries.emptyUnmarked,
    },
    {
      id: 'skipped',
      title: t.deliveries.skippedTitle,
      columns: [
        { key: 'date', label: L.date, kind: 'date' },
        { key: 'customer', label: L.customer, kind: 'text', primary: true },
        { key: 'item', label: L.item, kind: 'text' },
        { key: 'reason', label: L.reason, kind: 'text' },
        { key: 'by', label: L.by, kind: 'text' },
      ],
      rows: skips.map((s) => ({ date: s.ymd, customer: s.customer.name, item: s.item, reason: s.reason, by: s.by })).reverse(),
      emptyText: t.deliveries.emptySkipped,
    },
  );

  const notes = [t.deliveries.noteStop, t.deliveries.noteCompletion];
  if (c.scheduled) notes.push(t.deliveries.noteScheduled(c.scheduled));

  return {
    kind: options.kind ?? 'deliveries',
    title: options.title ?? t.catalog.deliveries.title,
    range,
    generatedAtIso: data.nowIso,
    stats: [
      { label: L.stops, value: stops.length, kind: 'number', hint: c.scheduled ? t.deliveries.upcoming(c.scheduled) : undefined },
      { label: L.delivered, value: c.delivered, kind: 'number', tone: 'good' },
      { label: L.notDelivered, value: c.missed, kind: 'number', tone: c.missed ? 'bad' : 'default' },
      { label: L.notMarked, value: c.unmarked, kind: 'number', tone: c.unmarked ? 'warn' : 'default' },
      { label: L.completion, value: c.settled ? c.completion : '—', kind: c.settled ? 'percent' : 'text' },
      { label: L.linesPaused, value: skips.length, kind: 'number' },
    ],
    trend: {
      title: L.deliveredStops,
      kind: 'number',
      points: dayBuckets.map((b) => ({
        label: b.label,
        value: stops.filter((s) => s.status === 'Delivered' && s.ymd >= b.fromYmd && s.ymd <= b.toYmd).length,
      })),
    },
    tables,
    notes,
  };
}

/** What has to go on the vans: packs per product and pack, overall and per route. Works for upcoming days too. */
export function buildDispatchReport(
  data: ReportData,
  range: ReportRange,
  filters: ReportFilterValues,
  options: { title?: string; kind?: string } = {},
): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const customers = filterCustomers(data.customers, data.boys, filters);
  const byId = new Map(customers.map((c) => [c.id, c]));
  const entries: { ymd: string; entry: TodayEntry }[] = [];
  for (const ymd of daysOfRange(range)) for (const entry of buildTodayEntries(customers, ymd)) entries.push({ ymd, entry });

  const sheet = buildLoadSheet(entries.map((e) => e.entry));
  const quantityOf = (productName: string, packLabel: string, count: number) => {
    const size = packSize(productName, packLabel, data.products);
    return size.family === 'count' ? formatQuantity(count, 'count') : formatQuantity(count * size.quantity, size.family);
  };
  const totalPacks = sum(sheet, (l) => l.count);
  const addOnPacks = sum(entries, (e) => sum((e.entry.lines ?? []).filter((l) => l.addOn), (l) => l.count));

  const routeRows: Record<string, string | number | null>[] = [];
  for (const [route, group] of Array.from(groupBy(entries, (e) => routeOf(byId.get(e.entry.customerId)!))).sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const line of buildLoadSheet(group.map((g) => g.entry))) {
      routeRows.push({
        route,
        item: line.label,
        packs: line.count,
        quantity: quantityOf(line.productName, line.packLabel, line.count),
        stops: new Set(group.filter((g) => (g.entry.lines ?? []).some((l) => `${l.productName}${l.packLabel}` === `${line.productName}${line.packLabel}`)).map((g) => `${g.ymd}${g.entry.customerId}`)).size,
      });
    }
  }

  const multiDay = rangeDayCount(range) > 1;
  const tables: ReportTable[] = [
    {
      id: 'items',
      title: t.dispatch.itemsTitle,
      columns: [
        { key: 'item', label: L.productPack, kind: 'text', primary: true },
        { key: 'packs', label: L.packs, kind: 'number' },
        { key: 'addon', label: L.includesAddOns, kind: 'text' },
        { key: 'quantity', label: L.quantity, kind: 'text' },
      ],
      rows: sheet.map((l) => ({ item: l.label, packs: l.count, addon: l.hasAddOn ? t.values.yes : t.values.no, quantity: quantityOf(l.productName, l.packLabel, l.count) })),
      totals: { item: null, packs: totalPacks, addon: null, quantity: null },
      emptyText: t.dispatch.empty,
    },
    {
      id: 'byRoute',
      title: t.tables.byRoute,
      columns: [
        { key: 'route', label: L.route, kind: 'text', primary: true },
        { key: 'item', label: L.productPack, kind: 'text' },
        { key: 'packs', label: L.packs, kind: 'number' },
        { key: 'quantity', label: L.quantity, kind: 'text' },
        { key: 'stops', label: L.stops, kind: 'number' },
      ],
      rows: routeRows,
      totals: { route: null, item: null, packs: totalPacks, quantity: null, stops: entries.length },
      emptyText: t.dispatch.empty,
    },
  ];
  if (multiDay) {
    tables.push({
      id: 'byDay',
      title: t.tables.byDay,
      columns: [
        { key: 'date', label: L.date, kind: 'date', primary: true },
        { key: 'stops', label: L.stops, kind: 'number' },
        { key: 'packs', label: L.packs, kind: 'number' },
      ],
      rows: daysOfRange(range)
        .map((ymd) => {
          const dayEntries = entries.filter((e) => e.ymd === ymd);
          return { date: ymd, stops: dayEntries.length, packs: sum(dayEntries, (e) => sum(e.entry.lines ?? [], (l) => l.count)) };
        })
        .filter((r) => r.stops > 0),
      totals: { date: null, stops: entries.length, packs: totalPacks },
      emptyText: t.dispatch.empty,
    });
  }
  tables.push({
    id: 'stops',
    title: L.stops,
    columns: [
      { key: 'date', label: L.date, kind: 'date' },
      { key: 'route', label: L.route, kind: 'text' },
      { key: 'customer', label: L.customer, kind: 'text', primary: true },
      { key: 'items', label: L.items, kind: 'text' },
      { key: 'packs', label: L.packs, kind: 'number' },
    ],
    rows: entries
      .map((e) => ({
        date: e.ymd,
        route: routeOf(byId.get(e.entry.customerId)!),
        customer: e.entry.name,
        items: [...e.entry.planItems, ...e.entry.addOnItems].join(', '),
        packs: sum(e.entry.lines ?? [], (l) => l.count),
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.route.localeCompare(b.route) || a.customer.localeCompare(b.customer)),
    totals: { date: null, route: null, customer: null, items: null, packs: totalPacks },
    emptyText: t.dispatch.empty,
  });

  return {
    kind: options.kind ?? 'dispatch',
    title: options.title ?? t.catalog.dispatch.title,
    range,
    generatedAtIso: data.nowIso,
    stats: [
      { label: L.stops, value: entries.length, kind: 'number' },
      { label: L.packsToLoad, value: totalPacks, kind: 'number', tone: 'good' },
      { label: L.addOnPacks, value: addOnPacks, kind: 'number' },
      { label: L.routes, value: new Set(entries.map((e) => routeOf(byId.get(e.entry.customerId)!))).size, kind: 'number' },
    ],
    tables,
    notes: [
      t.dispatch.noteBuilt,
      t.dispatch.noteCutoff,
    ],
  };
}
