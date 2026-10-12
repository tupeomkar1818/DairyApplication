import { addOnDateYmd, addOnItemCount, addOnLineTotal } from '@/src/domain/customers/addOns';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { offerText } from '@/src/domain/offers/offers';
import { filterCustomers, groupBy, orderItemLabel, routeOf, sum, type ReportData } from '@/src/domain/reports/data';
import { dateOfYmd, dayOf, inRange, rangeDayCount, type ReportRange } from '@/src/domain/reports/dateRange';
import { reportStatusLabel } from '@/src/domain/reports/format';
import type { ReportDocument, ReportFilterValues } from '@/src/domain/reports/model';
import { strings } from '@/src/i18n/strings';

/** Customers joining and leaving, what they changed, and the complaints they raised. */

const text = (value: unknown) => String(value ?? '').trim();

function planItem(plan: { productName?: string; quantityLabel?: string; numberOfItems?: number }): string {
  const base = [text(plan.productName), text(plan.quantityLabel)].filter(Boolean).join(' · ');
  const n = Math.max(1, Math.floor(Number(plan.numberOfItems ?? 1)) || 1);
  return n > 1 ? `${base} × ${n}` : base;
}

function planName(c: CustomerResponse, planId: string | undefined): string {
  const t = strings('reports').customerActivity;
  if (!planId) return t.wholeSubscription;
  const plan = (c.subscriptionPlans ?? []).find((p) => p.id === planId);
  return plan ? planItem(plan) : t.aSubscriptionLine;
}

function overlapDays(fromYmd: string, toYmd: string, range: ReportRange): number {
  const from = fromYmd > range.fromYmd ? fromYmd : range.fromYmd;
  const to = toYmd < range.toYmd ? toYmd : range.toYmd;
  return from <= to ? rangeDayCount({ fromYmd: from, toYmd: to }) : 0;
}

export function buildCustomerActivityReport(data: ReportData, range: ReportRange, filters: ReportFilterValues): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const customers = filterCustomers(data.customers, data.boys, filters);

  const joined = customers.filter((c) => inRange(dayOf(c.createdAt), range));
  const started = customers.flatMap((c) =>
    (c.subscriptionPlans ?? []).filter((p) => inRange(dayOf(p.startDate), range)).map((p) => ({ c, p })),
  );
  const ended = customers.flatMap((c) =>
    (c.subscriptionPlans ?? [])
      .filter((p) => !p.openEnded && inRange(dayOf(p.endDate), range))
      .map((p) => ({ c, p })),
  );
  const pauses = customers.flatMap((c) =>
    (c.subscriptionExceptions ?? [])
      .filter((ex) => (ex.kind ?? 'skip') === 'skip' && overlapDays(ex.fromYmd, ex.toYmd, range) > 0)
      .map((ex) => ({ c, ex })),
  );
  const inactive = customers.filter((c) => c.status === 'Inactive' && inRange(dayOf(c.updatedAt), range));
  const activeNow = customers.filter((c) => c.status !== 'Inactive').length;

  return {
    kind: 'customerActivity',
    title: t.catalog.customerActivity.title,
    range,
    generatedAtIso: data.nowIso,
    stats: [
      { label: L.newCustomers, value: joined.length, kind: 'number', tone: joined.length ? 'good' : 'default' },
      { label: L.subscriptionsStarted, value: started.length, kind: 'number' },
      { label: L.subscriptionsEnded, value: ended.length, kind: 'number' },
      { label: L.pauses, value: pauses.length, kind: 'number' },
      { label: L.markedInactive, value: inactive.length, kind: 'number', tone: inactive.length ? 'warn' : 'default' },
      { label: L.activeCustomersNow, value: activeNow, kind: 'number' },
    ],
    tables: [
      {
        id: 'joined',
        title: L.newCustomers,
        columns: [
          { key: 'date', label: L.joined, kind: 'date' },
          { key: 'customer', label: L.customer, kind: 'text', primary: true },
          { key: 'mobile', label: L.mobile, kind: 'text' },
          { key: 'route', label: L.route, kind: 'text' },
          { key: 'status', label: L.status, kind: 'text' },
        ],
        rows: joined
          .map((c) => ({ date: dayOf(c.createdAt), customer: c.name, mobile: c.mobile ?? '', route: routeOf(c), status: reportStatusLabel(c.status) }))
          .sort((a, b) => b.date.localeCompare(a.date)),
        emptyText: t.customerActivity.emptyJoined,
      },
      {
        id: 'started',
        title: L.subscriptionsStarted,
        columns: [
          { key: 'date', label: L.start, kind: 'date' },
          { key: 'customer', label: L.customer, kind: 'text', primary: true },
          { key: 'item', label: L.item, kind: 'text' },
          { key: 'end', label: L.ends, kind: 'text' },
        ],
        rows: started
          .map(({ c, p }) => ({ date: dayOf(p.startDate), customer: c.name, item: planItem(p), end: p.openEnded || !p.endDate ? t.customerActivity.noEndDate : dayOf(p.endDate) }))
          .sort((a, b) => b.date.localeCompare(a.date)),
        emptyText: t.customerActivity.emptyStarted,
      },
      {
        id: 'ended',
        title: L.subscriptionsEnded,
        columns: [
          { key: 'date', label: L.ended, kind: 'date' },
          { key: 'customer', label: L.customer, kind: 'text', primary: true },
          { key: 'item', label: L.item, kind: 'text' },
          { key: 'started', label: L.started, kind: 'date' },
        ],
        rows: ended
          .map(({ c, p }) => ({ date: dayOf(p.endDate), customer: c.name, item: planItem(p), started: dayOf(p.startDate) }))
          .sort((a, b) => b.date.localeCompare(a.date)),
        emptyText: t.customerActivity.emptyEnded,
      },
      {
        id: 'pauses',
        title: t.customerActivity.pausesTitle,
        columns: [
          { key: 'from', label: L.from, kind: 'date' },
          { key: 'to', label: L.to, kind: 'date' },
          { key: 'customer', label: L.customer, kind: 'text', primary: true },
          { key: 'what', label: L.what, kind: 'text' },
          { key: 'days', label: L.daysInPeriod, kind: 'number' },
          { key: 'reason', label: L.reason, kind: 'text' },
          { key: 'by', label: L.by, kind: 'text' },
        ],
        rows: pauses
          .map(({ c, ex }) => ({
            from: ex.fromYmd,
            to: ex.toYmd,
            customer: c.name,
            what: planName(c, ex.planId),
            days: overlapDays(ex.fromYmd, ex.toYmd, range),
            reason: text(ex.reason) || '—',
            by: ex.createdBy === 'admin' ? t.values.dairy : t.values.customer,
          }))
          .sort((a, b) => b.from.localeCompare(a.from)),
        totals: { from: null, to: null, customer: null, what: null, days: sum(pauses, (x) => overlapDays(x.ex.fromYmd, x.ex.toYmd, range)), reason: null, by: null },
        emptyText: t.customerActivity.emptyPauses,
      },
      {
        id: 'inactive',
        title: L.markedInactive,
        note: t.customerActivity.inactiveNote,
        columns: [
          { key: 'date', label: L.lastChanged, kind: 'date' },
          { key: 'customer', label: L.customer, kind: 'text', primary: true },
          { key: 'mobile', label: L.mobile, kind: 'text' },
          { key: 'route', label: L.route, kind: 'text' },
        ],
        rows: inactive.map((c) => ({ date: dayOf(c.updatedAt), customer: c.name, mobile: c.mobile ?? '', route: routeOf(c) })),
        emptyText: t.customerActivity.emptyInactive,
      },
    ],
  };
}

export function buildOrderChangesReport(data: ReportData, range: ReportRange, filters: ReportFilterValues): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const customers = filterCustomers(data.customers, data.boys, filters);
  const ids = new Set(customers.map((c) => c.id));

  const changes = customers.flatMap((c) =>
    (c.subscriptionExceptions ?? []).filter((ex) => inRange(dayOf(ex.createdAt), range)).map((ex) => ({ c, ex })),
  );
  const skips = changes.filter((x) => (x.ex.kind ?? 'skip') === 'skip');
  const quantity = changes.filter((x) => x.ex.kind === 'quantity');

  const addOns = customers.flatMap((c) =>
    (c.extraOrders ?? []).filter((o) => inRange(dayOf(o.createdAt || o.orderDate), range)).map((o) => ({ c, o })),
  );
  const cancelled = addOns.filter((x) => x.o.status === 'Cancelled');
  const byCustomer = addOns.filter((x) => x.o.placedBy !== 'admin');

  const answers = data.notifications.filter(
    (n) =>
      n.audience === 'Customer' &&
      n.type === 'OrderReminder' &&
      n.response &&
      n.customerId &&
      ids.has(n.customerId) &&
      inRange(dayOf(n.respondedAt ?? n.updatedAt), range),
  );
  const nameOf = new Map(customers.map((c) => [c.id, c.name]));
  const kept = answers.filter((a) => a.response === 'keep').length;

  return {
    kind: 'orderChanges',
    title: t.catalog.orderChanges.title,
    range,
    generatedAtIso: data.nowIso,
    stats: [
      { label: L.pausesMade, value: skips.length, kind: 'number' },
      { label: L.quantityChanges, value: quantity.length, kind: 'number' },
      { label: L.addOnsPlaced, value: addOns.length, kind: 'number', hint: t.orderChanges.byCustomers(byCustomer.length) },
      { label: L.addOnsCancelled, value: cancelled.length, kind: 'number' },
      { label: L.reminderKept, value: kept, kind: 'number', tone: 'good' },
      { label: L.reminderChanged, value: answers.length - kept, kind: 'number' },
    ],
    tables: [
      {
        id: 'bySource',
        title: t.orderChanges.bySourceTitle,
        columns: [
          { key: 'who', label: L.madeBy, kind: 'text', primary: true },
          { key: 'pauses', label: L.pauses, kind: 'number' },
          { key: 'quantity', label: L.quantityChanges, kind: 'number' },
          { key: 'addons', label: L.addOns, kind: 'number' },
        ],
        rows: (['customer', 'admin'] as const).map((who) => ({
          who: who === 'admin' ? t.orderChanges.dairyAdmin : t.orderChanges.customers,
          pauses: skips.filter((x) => x.ex.createdBy === who).length,
          quantity: quantity.filter((x) => x.ex.createdBy === who).length,
          addons: addOns.filter((x) => (x.o.placedBy === 'admin' ? 'admin' : 'customer') === who).length,
        })),
        totals: { who: null, pauses: skips.length, quantity: quantity.length, addons: addOns.length },
        emptyText: t.orderChanges.emptySource,
      },
      {
        id: 'changes',
        title: t.orderChanges.changesTitle,
        columns: [
          { key: 'made', label: L.madeOn, kind: 'date' },
          { key: 'customer', label: L.customer, kind: 'text', primary: true },
          { key: 'kind', label: L.change, kind: 'text' },
          { key: 'what', label: L.what, kind: 'text' },
          { key: 'days', label: L.for, kind: 'text' },
          { key: 'reason', label: L.reason, kind: 'text' },
          { key: 'by', label: L.by, kind: 'text' },
        ],
        rows: changes
          .map(({ c, ex }) => ({
            made: dayOf(ex.createdAt),
            customer: c.name,
            kind: ex.kind === 'quantity' ? t.orderChanges.packsADay(Math.max(0, Number(ex.numberOfItems ?? 0))) : t.orderChanges.paused,
            what: planName(c, ex.planId),
            days: ex.fromYmd === ex.toYmd ? ex.fromYmd : t.orderChanges.dayRange(ex.fromYmd, ex.toYmd),
            reason: text(ex.reason) || '—',
            by: ex.createdBy === 'admin' ? t.values.dairy : t.values.customer,
          }))
          .sort((a, b) => b.made.localeCompare(a.made)),
        emptyText: t.orderChanges.emptyChanges,
      },
      {
        id: 'addons',
        title: t.orderChanges.addOnsTitle,
        columns: [
          { key: 'placed', label: L.placedOn, kind: 'date' },
          { key: 'customer', label: L.customer, kind: 'text', primary: true },
          { key: 'item', label: L.item, kind: 'text' },
          { key: 'packs', label: L.packs, kind: 'number' },
          { key: 'for', label: L.for, kind: 'date' },
          { key: 'status', label: L.status, kind: 'text' },
          { key: 'by', label: L.by, kind: 'text' },
          { key: 'amount', label: L.amount, kind: 'money' },
        ],
        rows: addOns
          .map(({ c, o }) => ({
            placed: dayOf(o.createdAt || o.orderDate),
            customer: c.name,
            // A combo reads with what is in it; an order under an offer names the offer.
            item:
              o.offer && !o.comboItems?.length
                ? `${orderItemLabel(o)} · ${strings('offers').billLine(offerText(o.offer.title))}`
                : orderItemLabel(o),
            packs: addOnItemCount(o),
            for: addOnDateYmd(o),
            status: o.status === 'Pending' ? t.orderChanges.toDeliver : reportStatusLabel(o.status),
            by: o.placedBy === 'admin' ? t.values.dairy : t.values.customer,
            amount: addOnLineTotal(o),
          }))
          .sort((a, b) => b.placed.localeCompare(a.placed)),
        totals: { placed: null, customer: null, item: null, packs: sum(addOns, (x) => addOnItemCount(x.o)), for: null, status: null, by: null, amount: sum(addOns.filter((x) => x.o.status !== 'Cancelled'), (x) => addOnLineTotal(x.o)) },
        emptyText: t.orderChanges.emptyAddOns,
      },
      {
        id: 'reminders',
        title: t.orderChanges.remindersTitle,
        columns: [
          { key: 'answered', label: L.answered, kind: 'date' },
          { key: 'customer', label: L.customer, kind: 'text', primary: true },
          { key: 'for', label: L.forDeliveryOn, kind: 'date' },
          { key: 'answer', label: L.answer, kind: 'text' },
        ],
        rows: answers
          .map((a) => ({
            answered: dayOf(a.respondedAt ?? a.updatedAt),
            customer: nameOf.get(a.customerId!) ?? '—',
            for: a.dateYmd ?? null,
            answer: a.response === 'keep' ? t.orderChanges.keep : t.orderChanges.change,
          }))
          .sort((a, b) => b.answered.localeCompare(a.answered)),
        emptyText: t.orderChanges.emptyReminders,
      },
    ],
    notes: [
      t.orderChanges.noteCounted,
      t.orderChanges.noteReminders,
    ],
  };
}

const OPEN = new Set(['Open', 'In Progress']);

function daysBetween(fromYmd: string, toYmd: string): number | null {
  const a = dateOfYmd(fromYmd);
  const b = dateOfYmd(toYmd);
  if (!a || !b) return null;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

export function buildComplaintsReport(data: ReportData, range: ReportRange, filters: ReportFilterValues): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const customers = filterCustomers(data.customers, data.boys, filters);
  const all = customers.flatMap((c) => (c.complaints ?? []).map((k) => ({ c, k })));
  const raised = all.filter((x) => inRange(dayOf(x.k.complaintDate), range));
  const resolved = all.filter((x) => !OPEN.has(x.k.status) && inRange(dayOf(x.k.resolutionDate), range));
  const openNow = all.filter((x) => OPEN.has(x.k.status));
  const resolutionDays = resolved
    .map((x) => daysBetween(dayOf(x.k.complaintDate), dayOf(x.k.resolutionDate)))
    .filter((d): d is number => d !== null);
  const avgDays = resolutionDays.length ? sum(resolutionDays, (d) => d) / resolutionDays.length : null;

  const other = t.complaints.other;
  const types = Array.from(new Set([...raised, ...resolved, ...openNow].map((x) => text(x.k.type) || other)));

  return {
    kind: 'complaints',
    title: t.catalog.complaints.title,
    range,
    generatedAtIso: data.nowIso,
    stats: [
      { label: L.raised, value: raised.length, kind: 'number', tone: raised.length ? 'warn' : 'default' },
      { label: L.resolved, value: resolved.length, kind: 'number', tone: 'good' },
      { label: L.openNow, value: openNow.length, kind: 'number', tone: openNow.length ? 'bad' : 'good' },
      { label: L.averageDaysToResolve, value: avgDays === null ? '—' : Math.round(avgDays * 10) / 10, kind: avgDays === null ? 'text' : 'number' },
    ],
    tables: [
      {
        id: 'byType',
        title: t.complaints.byTypeTitle,
        columns: [
          { key: 'type', label: L.type, kind: 'text', primary: true },
          { key: 'raised', label: L.raised, kind: 'number' },
          { key: 'resolved', label: L.resolved, kind: 'number' },
          { key: 'open', label: L.openNow, kind: 'number' },
        ],
        rows: types
          .map((type) => ({
            type,
            raised: raised.filter((x) => (text(x.k.type) || other) === type).length,
            resolved: resolved.filter((x) => (text(x.k.type) || other) === type).length,
            open: openNow.filter((x) => (text(x.k.type) || other) === type).length,
          }))
          .sort((a, b) => b.raised - a.raised),
        totals: { type: null, raised: raised.length, resolved: resolved.length, open: openNow.length },
        emptyText: t.complaints.empty,
      },
      {
        id: 'byRoute',
        title: t.tables.byRoute,
        columns: [
          { key: 'route', label: L.route, kind: 'text', primary: true },
          { key: 'raised', label: L.raised, kind: 'number' },
        ],
        rows: Array.from(groupBy(raised, (x) => routeOf(x.c)))
          .map(([route, group]) => ({ route, raised: group.length }))
          .sort((a, b) => b.raised - a.raised),
        totals: { route: null, raised: raised.length },
        emptyText: t.complaints.emptyRaised,
      },
      {
        id: 'list',
        title: t.complaints.listTitle,
        columns: [
          { key: 'date', label: L.date, kind: 'date' },
          { key: 'customer', label: L.customer, kind: 'text', primary: true },
          { key: 'type', label: L.type, kind: 'text' },
          { key: 'description', label: L.details, kind: 'text' },
          { key: 'status', label: L.status, kind: 'text' },
          { key: 'resolvedOn', label: L.resolvedOn, kind: 'date' },
          { key: 'days', label: L.daysOpen, kind: 'number' },
        ],
        rows: raised
          .map(({ c, k }) => {
            const open = OPEN.has(k.status);
            const end = open ? data.today : dayOf(k.resolutionDate) || data.today;
            return {
              date: dayOf(k.complaintDate),
              customer: c.name,
              type: text(k.type) || other,
              description: text(k.description) || '—',
              status: reportStatusLabel(k.status),
              resolvedOn: open ? null : dayOf(k.resolutionDate) || null,
              days: daysBetween(dayOf(k.complaintDate), end),
            };
          })
          .sort((a, b) => b.date.localeCompare(a.date)),
        emptyText: t.complaints.emptyRaised,
      },
    ],
  };
}
