import { buildBillingTimeline, summarizeBilling } from '@/src/components/admin/billingTimeline';
import {
  computeCustomerMonthBillTotal,
  computeSubscriptionBillingTotalForMonth,
  planLineTotal,
  subscriptionPlanActiveOnDateYmd,
} from '@/src/components/admin/customerSubscriptionMonthUtils';
import { addOnItemCount, addOnLabel, addOnLineTotal, addOnPacks, addOnsForDate } from '@/src/domain/customers/addOns';
import { plannedLinesOn, usualQuantity } from '@/src/domain/customers/daySchedule';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { DeliveryBoyResponse } from '@/src/domain/deliveryBoys/dtos';
import { estimateMonthTotal } from '@/src/components/customer/myDays';
import { computeUnifiedMonthlyPayroll } from '@/src/domain/deliveryBoys/salary';
import type { ProductResponse } from '@/src/domain/products/dtos';
import { strings } from '@/src/i18n/strings';
import type { Offer } from '@/src/domain/offers/entities';
import { offerDiscountTotalForMonth } from '@/src/domain/offers/offers';

/**
 * Pure metrics behind the admin dashboard. They answer "what needs doing today?" from the records the app already
 * holds — no new fields — so the dashboard can be read at a glance and each number can be traced back to a list.
 */

/** Today by the phone's own clock and time zone. */
export function todayYmd(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function monthKeyOf(ymd: string): string {
  return ymd.slice(0, 7);
}

function ymdOf(iso: string | undefined | null): string {
  return String(iso ?? '').slice(0, 10);
}

/** Moves a yyyy-mm-dd day by `days`, staying on the local calendar. */
export function shiftYmd(ymd: string, days: number): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
  return todayYmd(d);
}

/**
 * What a month's billing is worth.
 *
 * The current month is forward-looking: what each customer's month adds up to as planned — their own dates, skips,
 * quantity changes and add-ons, the estimate the customer's My days and the admin's Subscription tab show. A past
 * month is settled, so it is billed from what was actually delivered — the same rule the bill uses.
 */
export function monthBillingBasis(monthKey: string, currentMonthKey: string): 'expected' | 'billed' {
  return monthKey >= currentMonthKey ? 'expected' : 'billed';
}

function billedForMonth(c: CustomerResponse, monthKey: string, offers: readonly Offer[]): number {
  return computeCustomerMonthBillTotal(c, monthKey) - offerDiscountTotalForMonth(c, monthKey, offers);
}

function customerMonthAmount(
  c: CustomerResponse,
  monthKey: string,
  basis: 'expected' | 'billed',
  offers: readonly Offer[] = [],
): number {
  if (basis === 'billed') return Math.max(0, billedForMonth(c, monthKey, offers));
  return c.status !== 'Inactive' ? Math.max(0, estimateMonthTotal(c, monthKey)) : 0;
}

/**
 * What a customer owes right now, and any money paid ahead — from the same billing timeline as the customer's My
 * bills and the admin's Billing tab (unpaid bills carried forward, payments settling the oldest bill first).
 */
export function customerBalance(
  c: CustomerResponse,
  today: string,
  offers: readonly Offer[] = [],
): { outstanding: number; advance: number } {
  const { outstanding, advance } = summarizeBilling(c, buildBillingTimeline(c, monthKeyOf(today), { offers }), today);
  return { outstanding, advance };
}

/** The four buckets the dashboard's "Today" tiles open. */
export type TodayBucket = 'due' | 'delivered' | 'missed' | 'addons';

/** One product and pack going to a stop, with how many packs. */
export type TodayLine = {
  productName: string;
  packLabel: string;
  count: number;
  /** A one-off order rather than a subscription line. */
  addOn: boolean;
};

export type TodayEntry = {
  customerId: string;
  name: string;
  mobile: string;
  route: string;
  /** Subscription lines planned for today, e.g. "Cow Milk · 500 ml" or "Cow Milk · 500 ml × 3". */
  planItems: string[];
  /** One-off orders placed for today. */
  addOnItems: string[];
  /** Everything going to the stop with pack counts — what the load sheet adds up. */
  lines?: TodayLine[];
  /** Planned value of today's delivery: subscription packs at their pack price, plus one-off orders. */
  amount: number;
  status: 'Delivered' | 'Not delivered' | 'Pending';
};

function lineLabel(productName: string, packLabel: string, count: number): string {
  const base = [productName, packLabel].map((x) => String(x ?? '').trim()).filter(Boolean).join(' · ');
  return count > 1 ? `${base} × ${count}` : base;
}

/** One row per customer that has anything happening today — the detail behind the tiles. */
export function buildTodayEntries(customers: readonly CustomerResponse[], ymd: string): TodayEntry[] {
  const entries: TodayEntry[] = [];

  for (const c of customers) {
    // Skipped lines and lines set to zero for the day are not due: the customer told us not to bring them.
    const planned = plannedLinesOn(c, ymd);
    const addOns = addOnsForDate(c, ymd);
    if (planned.length === 0 && addOns.length === 0) continue;

    const rows = (c.deliveries ?? []).filter((d) => ymdOf(d.deliveryDate) === ymd);
    const delivered = rows.some((d) => d.status === 'Delivered');
    const missed = rows.some((d) => d.status === 'Missed');

    const lines: TodayLine[] = [
      ...planned.map(({ plan, quantity }) => ({
        productName: String(plan.productName ?? '').trim(),
        packLabel: String(plan.quantityLabel ?? '').trim(),
        count: quantity,
        addOn: false,
      })),
      // A combo loads as the packs inside it.
      ...addOns.flatMap((o) => addOnPacks(o).map((p) => ({ ...p, addOn: true }))),
    ];

    entries.push({
      customerId: c.id,
      name: c.name,
      mobile: c.mobile ?? '',
      route: String(c.routeName ?? '').trim(),
      planItems: planned.map(({ plan, quantity }) => lineLabel(plan.productName, plan.quantityLabel, quantity)),
      addOnItems: addOns.map((o) => addOnLabel(o)),
      lines,
      amount:
        planned.reduce(
          (sum, { plan, quantity }) =>
            sum + Math.round((planLineTotal(plan) / usualQuantity(plan)) * quantity),
          0,
        ) + addOns.reduce((sum, o) => sum + addOnLineTotal(o), 0),
      status: delivered && !missed ? 'Delivered' : missed && !delivered ? 'Not delivered' : delivered ? 'Delivered' : 'Pending',
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/** Rows behind one tile. */
export function filterTodayEntries(entries: readonly TodayEntry[], bucket: TodayBucket): TodayEntry[] {
  switch (bucket) {
    case 'delivered':
      return entries.filter((e) => e.status === 'Delivered');
    case 'missed':
      return entries.filter((e) => e.status === 'Not delivered');
    case 'addons':
      return entries.filter((e) => e.addOnItems.length > 0);
    case 'due':
    default:
      return entries.filter((e) => e.planItems.length > 0);
  }
}

export type TodayMetrics = {
  /** Customers with at least one subscription line due today. */
  due: number;
  /** Of those, how many have a Delivered row for today. */
  delivered: number;
  /** Customers with a Missed row for today — these need a follow-up. */
  notDelivered: number;
  /** Still to do: due minus delivered minus missed (never negative). */
  remaining: number;
  /** One-off orders placed for today (cancelled ones excluded). */
  addOnOrders: number;
};

/** Counts for the dashboard tiles. Derived from the same rows the tiles open, so the two can never disagree. */
export function computeTodayMetrics(customers: readonly CustomerResponse[], ymd: string): TodayMetrics {
  const entries = buildTodayEntries(customers, ymd);
  const due = filterTodayEntries(entries, 'due').length;
  const delivered = filterTodayEntries(entries, 'delivered').length;
  const notDelivered = filterTodayEntries(entries, 'missed').length;
  const addOnOrders = entries.reduce((sum, e) => sum + e.addOnItems.length, 0);

  return { due, delivered, notDelivered, remaining: Math.max(0, due - delivered - notDelivered), addOnOrders };
}

export type MoneyMetrics = {
  /** What active customers' months add up to as planned — what this month should bring in. */
  expected: number;
  /** Payments recorded in this calendar month. */
  collected: number;
  /** Everything customers owe right now, unpaid earlier bills included. */
  outstanding: number;
  /** Customers carrying an outstanding balance. */
  outstandingCustomers: number;
  /** Money customers paid beyond their bills, held for the next ones. */
  advances: number;
};

export function computeMoneyMetrics(
  customers: readonly CustomerResponse[],
  monthKey: string,
  basis: 'expected' | 'billed' = 'expected',
  today: string = todayYmd(),
  /** The dairy's offers, so billed months and balances carry their discounts. */
  offers: readonly Offer[] = [],
): MoneyMetrics {
  let expected = 0;
  let collected = 0;
  let outstanding = 0;
  let outstandingCustomers = 0;
  let advances = 0;

  for (const c of customers) {
    expected += customerMonthAmount(c, monthKey, basis, offers);

    for (const p of c.payments ?? []) {
      if (ymdOf(p.paymentDate).slice(0, 7) === monthKey) collected += Math.max(0, Number(p.amountPaid ?? 0));
    }

    const balance = customerBalance(c, today, offers);
    outstanding += balance.outstanding;
    if (balance.outstanding > 0) outstandingCustomers += 1;

    advances += balance.advance;
  }

  return { expected, collected, outstanding, outstandingCustomers, advances };
}

/** Buckets behind the dashboard's "This month" tiles. */
export type MonthBucket = 'expected' | 'collected' | 'outstanding' | 'payroll';

export type MonthRow = {
  id: string;
  title: string;
  /** Route, payment mode and date, billing type … depending on the bucket. */
  subtitle: string;
  amount: number;
  /** Screen the row opens. */
  target: { kind: 'customer' | 'deliveryBoy'; id: string };
  /** Optional status word, e.g. the payment mode or "Prepaid". */
  tag?: string;
};

/** The rows behind one "This month" tile, largest amount first. */
export function buildMonthRows(
  input: {
    customers: readonly CustomerResponse[];
    boys: readonly DeliveryBoyResponse[];
    monthKey: string;
    /** 'billed' recomputes a settled month from its deliveries; defaults to the forward-looking monthly estimate. */
    basis?: 'expected' | 'billed';
    /** The day balances are read at; today when omitted. */
    today?: string;
    /** The dairy's offers, so billed months and balances carry their discounts. */
    offers?: readonly Offer[];
  },
  bucket: MonthBucket,
): MonthRow[] {
  const { customers, boys, monthKey, basis = 'expected', today = todayYmd(), offers = [] } = input;
  // Route fallback and tag words are shown on the rows, so they are read in the app language.
  const t = strings('admin').month;
  const noRoute = strings('admin').lists.noRoute;
  const wordFor = (labels: Record<string, string>, value: string | undefined) => (value ? (labels[value] ?? value) : value);

  if (bucket === 'collected') {
    const rows: MonthRow[] = [];
    for (const c of customers) {
      for (const p of c.payments ?? []) {
        const day = ymdOf(p.paymentDate);
        if (day.slice(0, 7) !== monthKey) continue;
        rows.push({
          id: p.id,
          title: c.name,
          subtitle: day,
          amount: Math.max(0, Number(p.amountPaid ?? 0)),
          target: { kind: 'customer', id: c.id },
          tag: wordFor(t.paymentModes, p.paymentMode),
        });
      }
    }
    // Newest payment first — a collection log reads by date, not by size.
    return rows.sort((a, b) => b.subtitle.localeCompare(a.subtitle));
  }

  if (bucket === 'payroll') {
    const all = boys as DeliveryBoyResponse[];
    return boys
      .filter((b) => b.status !== 'Inactive')
      .map((b) => ({
        id: b.id,
        title: b.fullName ?? '',
        subtitle: String(b.primaryRouteName ?? '').trim() || noRoute,
        amount: Math.max(0, Number(computeUnifiedMonthlyPayroll(b, monthKey, { allBoys: all }).finalSalary ?? 0)),
        target: { kind: 'deliveryBoy' as const, id: b.id },
        tag: b.salaryType === 'Attendance Based Salary' ? t.perDay : t.monthly,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  const rows: MonthRow[] = [];
  for (const c of customers) {
    const amount =
      bucket === 'expected' ? customerMonthAmount(c, monthKey, basis, offers) : customerBalance(c, today, offers).outstanding;
    if (amount <= 0) continue;
    rows.push({
      id: c.id,
      title: c.name,
      subtitle: String(c.routeName ?? '').trim() || noRoute,
      amount,
      target: { kind: 'customer', id: c.id },
      tag: wordFor(t.billingTypes, c.billingType),
    });
  }
  return rows.sort((a, b) => b.amount - a.amount);
}

/** Salary earned by the team this month (the same payroll rules the Delivery Boy salary tab uses). */
export function computePayrollDue(boys: readonly DeliveryBoyResponse[], monthKey: string): number {
  const all = boys as DeliveryBoyResponse[];
  let total = 0;
  for (const b of boys) {
    if (b.status === 'Inactive') continue;
    total += Math.max(0, Number(computeUnifiedMonthlyPayroll(b, monthKey, { allBoys: all }).finalSalary ?? 0));
  }
  return Math.round(total);
}

export type TeamTodayMetrics = { present: number; absent: number; unmarked: number };

/** Buckets behind the dashboard's "Team today" line. */
export type TeamBucket = 'all' | 'present' | 'absent' | 'unmarked';

export type TeamEntry = {
  boyId: string;
  name: string;
  mobile: string;
  route: string;
  status: 'Present' | 'Absent' | 'Not marked';
  /** The stored attendance value when it is more specific than present/absent (e.g. "Half Day"). */
  rawStatus?: string;
};

/** One row per active delivery boy, with today's attendance resolved. */
export function buildTeamTodayEntries(boys: readonly DeliveryBoyResponse[], ymd: string): TeamEntry[] {
  return boys
    .filter((b) => b.status !== 'Inactive')
    .map((b) => {
      const entry = (b.attendance ?? []).find((a) => ymdOf(a.date) === ymd);
      const status: TeamEntry['status'] = !entry ? 'Not marked' : entry.attendanceStatus === 'Absent' ? 'Absent' : 'Present';
      return {
        boyId: b.id,
        name: b.fullName ?? '',
        mobile: b.mobileNumber ?? '',
        route: String(b.primaryRouteName ?? '').trim(),
        status,
        rawStatus: entry?.attendanceStatus,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterTeamEntries(entries: readonly TeamEntry[], bucket: TeamBucket): TeamEntry[] {
  switch (bucket) {
    case 'present':
      return entries.filter((e) => e.status === 'Present');
    case 'absent':
      return entries.filter((e) => e.status === 'Absent');
    case 'unmarked':
      return entries.filter((e) => e.status === 'Not marked');
    case 'all':
    default:
      return [...entries];
  }
}

/** Counts for the dashboard line. Derived from the rows the line opens, so the two can never disagree. */
export function computeTeamToday(boys: readonly DeliveryBoyResponse[], ymd: string): TeamTodayMetrics {
  const entries = buildTeamTodayEntries(boys, ymd);
  return {
    present: filterTeamEntries(entries, 'present').length,
    absent: filterTeamEntries(entries, 'absent').length,
    unmarked: filterTeamEntries(entries, 'unmarked').length,
  };
}

export type DashboardAlertKey =
  | 'paymentsToConfirm'
  | 'customersWithoutRoute'
  | 'customersWithoutPlan'
  | 'plansOnInactiveProducts'
  | 'openComplaints'
  | 'boysWithoutRoute'
  | 'attendanceUnmarked';

export type DashboardAlert = {
  key: DashboardAlertKey;
  count: number;
};

/**
 * Exceptions worth acting on. Only rows with a non-zero count are returned, most urgent first, so the card stays
 * empty (and hidden) when the data is clean.
 */
export function computeDashboardAlerts(input: {
  customers: readonly CustomerResponse[];
  products: readonly ProductResponse[];
  boys: readonly DeliveryBoyResponse[];
  ymd: string;
}): DashboardAlert[] {
  const { customers, products, boys, ymd } = input;

  const activeProductNames = new Set(
    products.filter((p) => p.isActive).map((p) => p.name.trim().toLowerCase()),
  );

  let customersWithoutRoute = 0;
  let customersWithoutPlan = 0;
  let plansOnInactiveProducts = 0;
  let openComplaints = 0;
  let paymentsToConfirm = 0;

  for (const c of customers) {
    const isActive = c.status !== 'Inactive';
    if (isActive && !String(c.routeName ?? '').trim() && !String(c.assignedDeliveryBoyId ?? '').trim()) {
      customersWithoutRoute += 1;
    }

    const plans = c.subscriptionPlans ?? [];
    if (isActive && plans.filter((p) => p.status !== 'Cancelled').length === 0) customersWithoutPlan += 1;

    if (plans.some((p) => !activeProductNames.has(String(p.productName ?? '').trim().toLowerCase()))) {
      plansOnInactiveProducts += 1;
    }

    openComplaints += (c.complaints ?? []).filter((x) => x.status === 'Open' || x.status === 'In Progress').length;
    paymentsToConfirm += (c.paymentRequests ?? []).filter((r) => r.status === 'Pending').length;
  }

  const boysWithoutRoute = boys.filter((b) => b.status !== 'Inactive' && !String(b.primaryRouteName ?? '').trim()).length;
  const { unmarked } = computeTeamToday(boys, ymd);

  const rows: DashboardAlert[] = [
    { key: 'paymentsToConfirm', count: paymentsToConfirm },
    { key: 'openComplaints', count: openComplaints },
    { key: 'customersWithoutRoute', count: customersWithoutRoute },
    { key: 'plansOnInactiveProducts', count: plansOnInactiveProducts },
    { key: 'customersWithoutPlan', count: customersWithoutPlan },
    { key: 'boysWithoutRoute', count: boysWithoutRoute },
    { key: 'attendanceUnmarked', count: unmarked },
  ];

  return rows.filter((r) => r.count > 0);
}
