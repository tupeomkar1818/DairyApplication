import { enumerateDatesInclusive } from '@/src/domain/deliveryBoys/coverageCredits';
import type { DeliveryBoy } from '@/src/domain/deliveryBoys/entities';
import { daysInMonth, roundMoney2, totalAdvanceSalaryForMonthRecord } from '@/src/domain/deliveryBoys/salary';

function dOnly(iso: string): string {
  return String(iso).slice(0, 10);
}

function inRange(d: string, startIso: string, endIso: string): boolean {
  return d >= startIso && d <= endIso;
}

/** Unique calendar days marked Present in range (multi-route same day = one present). */
function presentDaySet(entries: DeliveryBoy['attendance'], startIso: string, endIso: string): Set<string> {
  const s = new Set<string>();
  for (const e of entries ?? []) {
    const d = dOnly(e.date);
    if (!inRange(d, startIso, endIso)) continue;
    if (e.attendanceStatus === 'Present') s.add(d);
  }
  return s;
}

function halfDaySet(entries: DeliveryBoy['attendance'], startIso: string, endIso: string): Set<string> {
  const s = new Set<string>();
  for (const e of entries ?? []) {
    const d = dOnly(e.date);
    if (!inRange(d, startIso, endIso)) continue;
    if (e.attendanceStatus === 'Half Day') s.add(d);
  }
  return s;
}

function leaveDaySets(
  b: DeliveryBoy,
  startIso: string,
  endIso: string,
): { paid: Set<string>; unpaid: Set<string>; all: Set<string> } {
  const paid = new Set<string>();
  const unpaid = new Set<string>();
  const all = new Set<string>();
  for (const L of b.leaves ?? []) {
    if (L.approvalStatus !== 'Approved') continue;
    for (const d of enumerateDatesInclusive(L.leaveStartDate, L.leaveEndDate)) {
      if (!inRange(d, startIso, endIso)) continue;
      all.add(d);
      const t = L.leaveType;
      if (t === 'Paid Leave' || t === 'Casual Leave') paid.add(d);
      else if (t === 'Unpaid Leave') unpaid.add(d);
      else if (t === 'Sick Leave') {
        if (b.sickLeavePaid === true) paid.add(d);
        else unpaid.add(d);
      } else unpaid.add(d);
    }
  }
  return { paid, unpaid, all };
}

export interface DeliveryBoyPeriodRollup {
  rangeDays: number;
  presentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  totalLeaveDays: number;
  replacementAssignments: number;
  extraRouteEarnings: number;
  temporaryReplacementExpense: number;
  salaryPaid: number;
  /** Present + half (0.5) vs range calendar length */
  attendancePct: number;
}

export function rollupDeliveryBoyPeriod(b: DeliveryBoy, startIso: string, endIso: string): DeliveryBoyPeriodRollup {
  const rangeDays =
    Math.max(0, Math.round((new Date(endIso + 'T12:00:00').getTime() - new Date(startIso + 'T12:00:00').getTime()) / 86400000) + 1);

  const present = presentDaySet(b.attendance, startIso, endIso);
  const half = halfDaySet(b.attendance, startIso, endIso);
  const { paid, unpaid, all } = leaveDaySets(b, startIso, endIso);

  let extraRoute = 0;
  for (const e of b.attendance ?? []) {
    const d = dOnly(e.date);
    if (!inRange(d, startIso, endIso)) continue;
    extraRoute = roundMoney2(extraRoute + Number(e.extraRouteEarningsForDay ?? 0));
  }

  let tempExpense = 0;
  let replCount = 0;
  for (const R of b.replacements ?? []) {
    let hit = false;
    for (const d of enumerateDatesInclusive(R.fromDate, R.toDate ?? R.fromDate)) {
      if (inRange(d, startIso, endIso)) {
        hit = true;
        break;
      }
    }
    if (!hit) continue;
    replCount += 1;
    if (R.replacementWorkerType === 'Temporary Delivery Boy') {
      tempExpense = roundMoney2(tempExpense + Number(R.temporaryReplacementExpense ?? R.extraPayment ?? 0));
    }
  }

  let salaryPaid = 0;
  for (const rec of b.salaryHistory ?? []) {
    const m = rec.salaryMonth;
    if (!/^\d{4}-\d{2}$/.test(m)) continue;
    const dim = daysInMonth(m);
    const monthStart = `${m}-01`;
    const monthEnd = `${m}-${String(dim).padStart(2, '0')}`;
    if (monthEnd < startIso || monthStart > endIso) continue;
    const finalPaid = Number((rec as any).paidAmount ?? 0);
    const adv = totalAdvanceSalaryForMonthRecord(rec as any);
    salaryPaid = roundMoney2(salaryPaid + finalPaid + adv);
  }

  const presentDays = present.size;
  const halfDays = half.size;
  const paidLeaveDays = paid.size;
  const unpaidLeaveDays = unpaid.size;
  const totalLeaveDays = all.size;

  const attUnits = presentDays + 0.5 * halfDays;
  const attendancePct = rangeDays > 0 ? Math.min(100, Math.round((attUnits / rangeDays) * 1000) / 10) : 0;

  return {
    rangeDays,
    presentDays,
    halfDays,
    paidLeaveDays,
    unpaidLeaveDays,
    totalLeaveDays,
    replacementAssignments: replCount,
    extraRouteEarnings: extraRoute,
    temporaryReplacementExpense: tempExpense,
    salaryPaid,
    attendancePct,
  };
}

export type MonthTrendPoint = { monthKey: string; shortLabel: string; value: number };

export function monthKeysLastN(n: number, ref: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function monthBounds(yyyyMm: string): { start: string; end: string } {
  const dim = daysInMonth(yyyyMm);
  return { start: `${yyyyMm}-01`, end: `${yyyyMm}-${String(dim).padStart(2, '0')}` };
}

function shortMonthLabel(yyyyMm: string): string {
  const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return yyyyMm;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return d.toLocaleString('en-US', { month: 'short' });
}

/** Last 6 months including current — for dashboard charts. */
export function sixMonthTrendSeries(b: DeliveryBoy): {
  netSalary: MonthTrendPoint[];
  presentDays: MonthTrendPoint[];
  leaveDays: MonthTrendPoint[];
  replacements: MonthTrendPoint[];
} {
  const keys = monthKeysLastN(6);
  const netSalary: MonthTrendPoint[] = [];
  const presentDays: MonthTrendPoint[] = [];
  const leaveDays: MonthTrendPoint[] = [];
  const replacements: MonthTrendPoint[] = [];

  for (const k of keys) {
    const { start, end } = monthBounds(k);
    const r = rollupDeliveryBoyPeriod(b, start, end);
    const rec = b.salaryHistory?.find((x) => x.salaryMonth === k);
    const net = roundMoney2(Number(rec?.finalSalary ?? 0));

    netSalary.push({ monthKey: k, shortLabel: shortMonthLabel(k), value: net });
    presentDays.push({ monthKey: k, shortLabel: shortMonthLabel(k), value: r.presentDays });
    leaveDays.push({ monthKey: k, shortLabel: shortMonthLabel(k), value: r.totalLeaveDays });
    replacements.push({ monthKey: k, shortLabel: shortMonthLabel(k), value: r.replacementAssignments });
  }

  return { netSalary, presentDays, leaveDays, replacements };
}

export interface MonthOverviewRow {
  monthKey: string;
  label: string;
  rollup: DeliveryBoyPeriodRollup;
  salaryPaid: number;
}

export function sixMonthOverviewRows(b: DeliveryBoy, ref: Date = new Date()): MonthOverviewRow[] {
  const keys = monthKeysLastN(6, ref);
  return keys.map((k) => {
    const { start, end } = monthBounds(k);
    const rollup = rollupDeliveryBoyPeriod(b, start, end);
    const rec = b.salaryHistory?.find((x) => x.salaryMonth === k);
    const salaryPaid = roundMoney2(Number((rec as any)?.paidAmount ?? 0));
    return {
      monthKey: k,
      label: `${shortMonthLabel(k)} ${k.slice(0, 4)}`,
      rollup,
      salaryPaid,
    };
  });
}
