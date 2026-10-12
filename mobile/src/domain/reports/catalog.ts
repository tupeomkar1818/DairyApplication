import {
  boyFilterDef,
  customerFilterDef,
  productFilterDef,
  routeFilterDef,
  type ReportData,
} from '@/src/domain/reports/data';
import { REPORT_PRESETS, UPCOMING_PRESETS, type ReportPresetKey, type ReportRange } from '@/src/domain/reports/dateRange';
import { buildDeliveriesReport, buildDispatchReport } from '@/src/domain/reports/deliveryReports';
import { buildComplaintsReport, buildCustomerActivityReport, buildOrderChangesReport } from '@/src/domain/reports/customerReports';
import type { ReportDocument, ReportFilterDef, ReportFilterValues } from '@/src/domain/reports/model';
import { buildCollectionsReport, buildDuesReport, paymentModeFilterDef } from '@/src/domain/reports/moneyReports';
import { buildOffersReport } from '@/src/domain/reports/offerReports';
import { buildProductSalesReport, buildSalesReport, buildTaxReport } from '@/src/domain/reports/salesReports';
import {
  buildBillsReport,
  buildConsumptionReport,
  buildCustomerPaymentsReport,
  buildStatementReport,
} from '@/src/domain/reports/statementReports';
import { buildAttendanceReport, buildSalaryReport } from '@/src/domain/reports/teamReports';
import { strings, type Dictionary } from '@/src/i18n/strings';

/**
 * Which reports each app offers. The admin sees the whole dairy; a delivery boy sees reports about his own round and
 * pay; a customer sees their own household. The screen, filters, PDF and CSV are shared — only this list differs.
 */

export type ReportAudience = 'admin' | 'delivery' | 'customer';

/** Report ids; each has its title and description in the `reports.catalog` dictionary. */
export type ReportId = keyof Dictionary['reports']['catalog'];

export type ReportSection = keyof Dictionary['reports']['sections'];

export type ReportDefinition = {
  id: ReportId;
  section: ReportSection;
  /** In the app language, read when shown. */
  readonly title: string;
  readonly description: string;
  /** MaterialCommunityIcons name. */
  icon: string;
  defaultPreset: Exclude<ReportPresetKey, 'custom'>;
  presets: readonly { key: ReportPresetKey }[];
  /** How many years ahead a custom range may reach (0: nothing after today). */
  yearsAhead: number;
  filters: (data: ReportData) => ReportFilterDef[];
  /** A filter that must be chosen before the report can run (e.g. which customer a statement is for). */
  requiredFilter?: { key: string; readonly prompt: string };
  build: (data: ReportData, range: ReportRange, filters: ReportFilterValues) => ReportDocument;
};

const PAST = { presets: REPORT_PRESETS, yearsAhead: 0 } as const;

type ReportEntry = Omit<ReportDefinition, 'title' | 'description' | 'requiredFilter'> & {
  /** The report needs one customer chosen first; the prompt is the report's own `catalog.<id>.prompt`. */
  requiresCustomer?: boolean;
};

/** Gives an entry its wording as getters, so the same definition object reads in whichever language is current. */
function define(entry: ReportEntry): ReportDefinition {
  const { requiresCustomer, ...rest } = entry;
  const words = () => strings('reports').catalog[entry.id] as { title: string; description: string; prompt?: string };
  const def = { ...rest } as ReportDefinition;
  Object.defineProperties(def, {
    title: { get: () => words().title, enumerable: true },
    description: { get: () => words().description, enumerable: true },
  });
  if (requiresCustomer) {
    const requiredFilter = { key: 'customer' } as NonNullable<ReportDefinition['requiredFilter']>;
    Object.defineProperty(requiredFilter, 'prompt', { get: () => words().prompt ?? '', enumerable: true });
    def.requiredFilter = requiredFilter;
  }
  return def;
}

const chooseCustomerFilter = (d: ReportData) => [customerFilterDef(d.customers, strings('reports').filters.chooseCustomer)];

const ADMIN_REPORTS: ReportDefinition[] = ([
  {
    id: 'sales',
    section: 'sales',
    icon: 'chart-line',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: (d) => [routeFilterDef(d.customers), boyFilterDef(d.boys)],
    build: buildSalesReport,
  },
  {
    id: 'productSales',
    section: 'sales',
    icon: 'basket-outline',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: (d) => [productFilterDef(d.products, d.customers), routeFilterDef(d.customers), boyFilterDef(d.boys)],
    build: buildProductSalesReport,
  },
  {
    id: 'tax',
    section: 'sales',
    icon: 'percent-outline',
    defaultPreset: 'lastMonth',
    ...PAST,
    filters: (d) => [routeFilterDef(d.customers)],
    build: buildTaxReport,
  },
  {
    id: 'offers',
    section: 'sales',
    icon: 'tag-outline',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: (d) => [routeFilterDef(d.customers), boyFilterDef(d.boys)],
    build: buildOffersReport,
  },
  {
    id: 'deliveries',
    section: 'deliveries',
    icon: 'truck-check-outline',
    defaultPreset: 'last7',
    ...PAST,
    filters: (d) => [routeFilterDef(d.customers), boyFilterDef(d.boys)],
    build: (data, range, filters) => buildDeliveriesReport(data, range, filters),
  },
  {
    id: 'dispatch',
    section: 'deliveries',
    icon: 'truck-delivery-outline',
    defaultPreset: 'tomorrow',
    presets: UPCOMING_PRESETS,
    yearsAhead: 1,
    filters: (d) => [routeFilterDef(d.customers), boyFilterDef(d.boys)],
    build: (data, range, filters) => buildDispatchReport(data, range, filters),
  },
  {
    id: 'collections',
    section: 'money',
    icon: 'cash-multiple',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: (d) => [paymentModeFilterDef(), routeFilterDef(d.customers), boyFilterDef(d.boys)],
    build: (data, range, filters) => buildCollectionsReport(data, range, filters),
  },
  {
    id: 'dues',
    section: 'money',
    icon: 'cash-clock',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: (d) => [routeFilterDef(d.customers), boyFilterDef(d.boys)],
    build: buildDuesReport,
  },
  {
    id: 'customerActivity',
    section: 'customers',
    icon: 'account-group-outline',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: (d) => [routeFilterDef(d.customers), boyFilterDef(d.boys)],
    build: buildCustomerActivityReport,
  },
  {
    id: 'orderChanges',
    section: 'customers',
    icon: 'swap-horizontal',
    defaultPreset: 'last7',
    ...PAST,
    filters: (d) => [routeFilterDef(d.customers), boyFilterDef(d.boys)],
    build: buildOrderChangesReport,
  },
  {
    id: 'complaints',
    section: 'customers',
    icon: 'message-alert-outline',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: (d) => [routeFilterDef(d.customers)],
    build: buildComplaintsReport,
  },
  {
    id: 'statement',
    section: 'customers',
    icon: 'file-document-outline',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: chooseCustomerFilter,
    requiresCustomer: true,
    build: buildStatementReport,
  },
  {
    id: 'bills',
    section: 'customers',
    icon: 'receipt',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: chooseCustomerFilter,
    requiresCustomer: true,
    build: (data, range, filters) => buildBillsReport(data, range, filters),
  },
  {
    id: 'consumption',
    section: 'customers',
    icon: 'cup-water',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: chooseCustomerFilter,
    requiresCustomer: true,
    build: buildConsumptionReport,
  },
  {
    id: 'attendance',
    section: 'team',
    icon: 'calendar-check-outline',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: (d) => [boyFilterDef(d.boys)],
    build: (data, range, filters) => buildAttendanceReport(data, range, filters),
  },
  {
    id: 'salary',
    section: 'team',
    icon: 'wallet-outline',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: (d) => [boyFilterDef(d.boys)],
    build: (data, range, filters) => buildSalaryReport(data, range, filters),
  },
] satisfies ReportEntry[]).map(define);

const DELIVERY_REPORTS: ReportDefinition[] = ([
  {
    id: 'myDeliveries',
    section: 'myRound',
    icon: 'truck-check-outline',
    defaultPreset: 'last7',
    ...PAST,
    filters: (d) => [routeFilterDef(d.customers)],
    build: (data, range, filters) =>
      buildDeliveriesReport(data, range, filters, { kind: 'myDeliveries', title: strings('reports').catalog.myDeliveries.title, showBoyTable: false }),
  },
  {
    id: 'myLoadSheet',
    section: 'myRound',
    icon: 'truck-delivery-outline',
    defaultPreset: 'tomorrow',
    presets: UPCOMING_PRESETS,
    yearsAhead: 1,
    filters: (d) => [routeFilterDef(d.customers)],
    build: (data, range, filters) => buildDispatchReport(data, range, filters, { kind: 'myLoadSheet', title: strings('reports').catalog.myLoadSheet.title }),
  },
  {
    id: 'myAttendance',
    section: 'myWork',
    icon: 'calendar-check-outline',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: () => [],
    build: (data, range, filters) =>
      buildAttendanceReport(data, range, filters, { kind: 'myAttendance', title: strings('reports').catalog.myAttendance.title, showDays: true }),
  },
  {
    id: 'myEarnings',
    section: 'myWork',
    icon: 'wallet-outline',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: () => [],
    build: (data, range, filters) =>
      buildSalaryReport(data, range, filters, { kind: 'myEarnings', title: strings('reports').catalog.myEarnings.title, showMonths: true }),
  },
] satisfies ReportEntry[]).map(define);

const CUSTOMER_REPORTS: ReportDefinition[] = ([
  {
    id: 'myStatement',
    section: 'myAccount',
    icon: 'file-document-outline',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: () => [],
    build: buildStatementReport,
  },
  {
    id: 'myBills',
    section: 'myAccount',
    icon: 'receipt',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: () => [],
    build: (data, range, filters) => buildBillsReport(data, range, filters, { customerView: true }),
  },
  {
    id: 'myPayments',
    section: 'myAccount',
    icon: 'cash-check',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: () => [],
    build: buildCustomerPaymentsReport,
  },
  {
    id: 'myConsumption',
    section: 'myAccount',
    icon: 'cup-water',
    defaultPreset: 'thisMonth',
    ...PAST,
    filters: () => [],
    build: buildConsumptionReport,
  },
] satisfies ReportEntry[]).map(define);

const BY_AUDIENCE: Record<ReportAudience, ReportDefinition[]> = {
  admin: ADMIN_REPORTS,
  delivery: DELIVERY_REPORTS,
  customer: CUSTOMER_REPORTS,
};

export function reportsFor(audience: ReportAudience): ReportDefinition[] {
  return BY_AUDIENCE[audience];
}

export function findReport(audience: ReportAudience, id: string | undefined): ReportDefinition | null {
  return BY_AUDIENCE[audience].find((r) => r.id === id) ?? null;
}

/** Sections in the order the list shows them (section keys; the heading is `reports.sections[section]`). */
export function reportSections(audience: ReportAudience): { section: ReportSection; reports: ReportDefinition[] }[] {
  const out: { section: ReportSection; reports: ReportDefinition[] }[] = [];
  for (const r of BY_AUDIENCE[audience]) {
    const group = out.find((g) => g.section === r.section);
    if (group) group.reports.push(r);
    else out.push({ section: r.section, reports: [r] });
  }
  return out;
}
