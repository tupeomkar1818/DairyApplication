import { creditDayKey, enumerateDatesInclusive } from '@/src/domain/deliveryBoys/coverageCredits';
import type {
  DeliveryBoy,
  DeliveryBoyAdvanceSalaryEntry,
  DeliveryBoyAttendanceEntry,
  DeliveryBoyLeaveRequest,
  DeliveryBoyReplacementHistoryEntry,
  DeliveryBoySalaryPaymentEntry,
  DeliveryBoySalaryRecord,
} from '@/src/domain/deliveryBoys/entities';

export type DeliveryBoySalaryStatus = 'Paid' | 'Partial' | 'Unpaid';

/** Rupee amounts: 2 decimal places (paise precision). */
export function roundMoney2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatInr2(value: number): string {
  return `₹${roundMoney2(value).toFixed(2)}`;
}

const UNITS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
] as const;

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const;

function wordsTwoDigits(n: number): string {
  if (n < 0 || n >= 100) return '';
  if (n < 20) return UNITS[n] ?? '';
  const t = Math.floor(n / 10);
  const u = n % 10;
  const ten = TENS[t] ?? '';
  return u ? `${ten} ${UNITS[u]}` : ten;
}

function wordsUnderThousand(n: number): string {
  if (n <= 0 || n >= 1000) return '';
  if (n < 100) return wordsTwoDigits(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  const head = `${UNITS[h]} hundred`;
  return r ? `${head} ${wordsTwoDigits(r)}` : head;
}

/** Indian numbering: … crore, lakh, thousand, then last 3 digits (from the right). */
function integerRupeesToWords(num: number): string {
  if (!Number.isFinite(num) || num < 0) return '';
  const n = Math.floor(num);
  if (n === 0) return 'zero';

  let x = n;
  const first = x % 1000;
  x = Math.floor(x / 1000);

  const parts: string[] = [];
  if (first) parts.push(wordsUnderThousand(first));

  const labels = ['thousand', 'lakh', 'crore'] as const;
  let i = 0;
  while (x > 0 && i < labels.length) {
    const pair = x % 100;
    x = Math.floor(x / 100);
    if (pair) parts.unshift(`${wordsUnderThousand(pair)} ${labels[i]}`);
    i += 1;
  }

  if (x > 0) {
    parts.unshift(`${integerRupeesToWords(x)} crore`);
  }

  return parts.join(' ');
}

/**
 * English words for a rupee amount (Indian crore / lakh / thousand), optional paise.
 * Returns empty string for non-finite, negative, or zero amounts.
 */
export function rupeesAmountToWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '';
  const a = roundMoney2(amount);
  if (a === 0) return '';

  const whole = Math.floor(a);
  const paise = Math.round(roundMoney2(a - whole) * 100);
  if (whole === 0 && paise === 0) return '';

  const chunks: string[] = [];
  if (whole > 0) {
    chunks.push(`${integerRupeesToWords(whole)} rupees`);
  }
  if (paise > 0) {
    chunks.push(`${wordsTwoDigits(paise)} paise`);
  }
  const s = chunks.join(' and ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function resolvePerDaySalary(b: DeliveryBoy, yyyyMm: string): number {
  const dim = daysInMonth(yyyyMm);
  const monthly = Math.max(0, Number(b.monthlySalary ?? 0));
  const explicit = b.perDaySalary !== undefined ? Number(b.perDaySalary) : NaN;
  if (Number.isFinite(explicit) && explicit >= 0) return roundMoney2(explicit);
  return monthly > 0 && dim > 0 ? roundMoney2(monthly / dim) : 0;
}

function monthIndex(yyyyMm: string) {
  const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return Number.NEGATIVE_INFINITY;
  return Number(m[1]) * 12 + (Number(m[2]) - 1);
}

export function shiftMonth(yyyyMm: string, deltaMonths: number): string {
  const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return yyyyMm;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const d = new Date(yyyy, mm - 1, 1);
  d.setMonth(d.getMonth() + deltaMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function daysInMonth(yyyyMm: string): number {
  const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return 30;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  return new Date(yyyy, mm, 0).getDate();
}

function clampIsoDateToMonth(iso: string | undefined, yyyyMm: string): string | null {
  if (typeof iso !== 'string') return null;
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  if (d.slice(0, 7) !== yyyyMm) return null;
  return d;
}

function overlapDaysInMonth(fromIso: string | undefined, toIso: string | undefined, yyyyMm: string): number {
  const dim = daysInMonth(yyyyMm);
  const start = typeof fromIso === 'string' ? fromIso.slice(0, 10) : '';
  const end = typeof toIso === 'string' ? toIso.slice(0, 10) : start;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return 0;
  const monthStart = `${yyyyMm}-01`;
  const monthEnd = `${yyyyMm}-${String(dim).padStart(2, '0')}`;
  const a = start < monthStart ? monthStart : start;
  const b = end > monthEnd ? monthEnd : end;
  if (b < a) return 0;
  const d1 = new Date(a);
  const d2 = new Date(b);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 0;
  const diff = Math.floor((d2.getTime() - d1.getTime()) / 86400000);
  return diff + 1;
}

export function getSalaryRecordForMonth(b: DeliveryBoy | null | undefined, yyyyMm: string): DeliveryBoySalaryRecord | null {
  if (!b) return null;
  return (b.salaryHistory ?? []).find((x) => x.salaryMonth === yyyyMm) ?? null;
}

/** Sum amounts on the dedicated advance ledger for the month. */
export function sumAdvanceSalaryEntries(entries: DeliveryBoyAdvanceSalaryEntry[] | undefined | null): number {
  let t = 0;
  for (const e of entries ?? []) {
    t = roundMoney2(t + Math.max(0, Number(e?.amount ?? 0)));
  }
  return t;
}

/** Legacy: advances mistakenly stored as `payments[]` rows with `kind: 'Advance'`. */
export function sumLegacyAdvanceInPayments(payments: DeliveryBoySalaryPaymentEntry[] | undefined | null): number {
  let t = 0;
  for (const p of payments ?? []) {
    if (p.kind !== 'Advance') continue;
    t = roundMoney2(t + Math.max(0, Number(p.amountPaid ?? 0)));
  }
  return t;
}

/**
 * Total advance salary for a month row: prefers `advanceSalaryEntries`; if empty, falls back to legacy payment rows.
 */
export function totalAdvanceSalaryForMonthRecord(rec: DeliveryBoySalaryRecord | null | undefined): number {
  if (!rec) return 0;
  const entries = rec.advanceSalaryEntries ?? [];
  if (entries.length > 0) return sumAdvanceSalaryEntries(entries);
  return sumLegacyAdvanceInPayments(rec.payments);
}

/** Earned final salary for the month minus all advances — amount still to settle via final salary payments. */
export function finalSalarySettlementNetDue(earnedFinalSalary: number, advanceTotal: number): number {
  return roundMoney2(roundMoney2(Number(earnedFinalSalary)) - Math.max(0, roundMoney2(Number(advanceTotal))));
}

export function computeFinalSalarySettlementPending(
  earnedFinalSalary: number,
  advanceTotal: number,
  paidTowardFinalSalary: number,
): number {
  const netDue = finalSalarySettlementNetDue(earnedFinalSalary, advanceTotal);
  return roundMoney2(netDue - Math.max(0, roundMoney2(Number(paidTowardFinalSalary))));
}

export function getAutoPreviousPendingSalary(b: DeliveryBoy | null | undefined, yyyyMm: string): number {
  if (!b) return 0;
  const prevMonth = shiftMonth(yyyyMm, -1);
  const prevRec = getSalaryRecordForMonth(b, prevMonth);
  const pending = Number((prevRec as any)?.pendingAmount ?? 0);
  return Math.max(0, roundMoney2(pending));
}

/**
 * Signed carry-forward balance from prior month (final settlement pending after advances and final payments).
 * Positive = still owed to the boy; negative = overpaid on final settlement.
 *
 * Uses stored `pendingAmount` when present; otherwise earned `finalSalary` − advances − `paidAmount` (final only).
 */
export function getAutoPreviousBalance(b: DeliveryBoy | null | undefined, yyyyMm: string): number {
  if (!b) return 0;
  const prevMonth = shiftMonth(yyyyMm, -1);
  const prevRec = getSalaryRecordForMonth(b, prevMonth);
  if (!prevRec) return 0;
  const maybePending = (prevRec as any)?.pendingAmount;
  if (maybePending !== undefined && maybePending !== null && Number.isFinite(Number(maybePending))) {
    return roundMoney2(Number(maybePending));
  }
  const earned = Number((prevRec as any)?.finalSalary ?? 0);
  const adv = totalAdvanceSalaryForMonthRecord(prevRec);
  const paidFinal = Number((prevRec as any)?.paidAmount ?? 0);
  return computeFinalSalarySettlementPending(earned, adv, paidFinal);
}

export function perDayForBoyInMonth(b: DeliveryBoy | null | undefined, yyyyMm: string): number {
  if (!b) return 0;
  return resolvePerDaySalary(b, yyyyMm);
}

/**
 * Profile / read-only monthly figure: uses stored `monthlySalary` when positive; otherwise, if
 * `perDaySalary` is set, returns per day × calendar days in `yyyyMm` (aligned with payroll resolution).
 */
export function profileMonthlySalaryDisplay(b: DeliveryBoy | null | undefined, yyyyMm: string): number {
  if (!b) return 0;
  const stored = Math.max(0, roundMoney2(Number(b.monthlySalary ?? 0)));
  if (stored > 0) return stored;
  const dim = daysInMonth(yyyyMm);
  const explicit = b.perDaySalary !== undefined ? Number(b.perDaySalary) : NaN;
  if (!Number.isFinite(explicit) || explicit < 0 || dim <= 0) return 0;
  return roundMoney2(explicit * dim);
}

function leaveCountsAsUnpaid(b: DeliveryBoy, leaveType: string): boolean {
  if (leaveType === 'Unpaid Leave') return true;
  if (leaveType === 'Sick Leave' && b.sickLeavePaid !== true) return true;
  if (leaveType === 'Emergency' || leaveType === 'Emergency Leave' || leaveType === 'Other') return true;
  return false;
}

function leaveCountsAsPaid(b: DeliveryBoy, leaveType: string): boolean {
  if (leaveType === 'Paid Leave' || leaveType === 'Casual Leave') return true;
  if (leaveType === 'Sick Leave' && b.sickLeavePaid === true) return true;
  return false;
}

function unpaidLeaveDateSet(b: DeliveryBoy, yyyyMm: string): Set<string> {
  const set = new Set<string>();
  const approved = (b.leaves ?? []).filter((x: DeliveryBoyLeaveRequest) => x.approvalStatus === 'Approved' && leaveCountsAsUnpaid(b, x.leaveType));
  for (const L of approved) {
    for (const d of enumerateDatesInclusive(L.leaveStartDate, L.leaveEndDate)) {
      if (d.slice(0, 7) === yyyyMm) set.add(d);
    }
  }
  return set;
}

function sumExtraRouteEarningsInMonth(b: DeliveryBoy, yyyyMm: string): number {
  let t = 0;
  for (const e of b.attendance ?? []) {
    if (String(e.date).slice(0, 7) !== yyyyMm) continue;
    t = roundMoney2(t + Number(e.extraRouteEarningsForDay ?? 0));
  }
  return t;
}

function sumTemporaryReplacementExpenseInMonth(b: DeliveryBoy, yyyyMm: string): number {
  let t = 0;
  for (const R of (b.replacements ?? []) as DeliveryBoyReplacementHistoryEntry[]) {
    if (R.replacementWorkerType !== 'Temporary Delivery Boy') continue;
    let hit = false;
    for (const d of enumerateDatesInclusive(R.fromDate, R.toDate ?? R.fromDate)) {
      if (d.slice(0, 7) === yyyyMm) {
        hit = true;
        break;
      }
    }
    if (hit) t = roundMoney2(t + Number(R.temporaryReplacementExpense ?? R.extraPayment ?? 0));
  }
  return t;
}

/** Replacement days in the month that are not already covered by approved unpaid leave (avoids double deduction). */
function replacementChargeableDatesInMonth(b: DeliveryBoy, yyyyMm: string): Set<string> {
  const unpaid = unpaidLeaveDateSet(b, yyyyMm);
  const dates = new Set<string>();
  for (const rep of (b.replacements ?? []) as DeliveryBoyReplacementHistoryEntry[]) {
    for (const d of enumerateDatesInclusive(rep.fromDate, rep.toDate ?? rep.fromDate)) {
      if (d.slice(0, 7) !== yyyyMm) continue;
      if (unpaid.has(d)) continue;
      dates.add(d);
    }
  }
  return dates;
}

export function computeRouteCoverageCreditSalaryForMonth(
  b: DeliveryBoy | null | undefined,
  yyyyMm: string,
  allBoys: DeliveryBoy[] | null | undefined,
): { amount: number; creditedDays: number } {
  if (!b) return { amount: 0, creditedDays: 0 };
  const boyMap = new Map((allBoys ?? []).map((x) => [x.id, x]));
  const claimed = new Set<string>();
  let amount = 0;
  let creditedDays = 0;

  for (const c of b.routeCoverageCredits ?? []) {
    const d = String(c.date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d.slice(0, 7) !== yyyyMm) continue;
    const k = creditDayKey(d, c.leaverDeliveryBoyId);
    if (claimed.has(k)) continue;
    claimed.add(k);
    const leaver = boyMap.get(c.leaverDeliveryBoyId);
    amount = roundMoney2(amount + perDayForBoyInMonth(leaver ?? null, yyyyMm));
    creditedDays += 1;
  }

  for (const x of b.attendance ?? []) {
    const d = String(x.date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d.slice(0, 7) !== yyyyMm) continue;
    if (x.attendanceStatus !== 'Present') continue;
    const leaverId = x.coverForDeliveryBoyId;
    if (!leaverId) continue;
    const k = creditDayKey(d, leaverId);
    if (claimed.has(k)) continue;
    claimed.add(k);
    const leaver = boyMap.get(leaverId);
    amount = roundMoney2(amount + perDayForBoyInMonth(leaver ?? null, yyyyMm));
    creditedDays += 1;
  }

  return { amount: Math.max(0, roundMoney2(amount)), creditedDays };
}

export function computeDeliveryBoySalaryForMonth(
  b: DeliveryBoy | null | undefined,
  yyyyMm: string,
  opts?: {
    bonusAmount?: number;
    deductionAmount?: number;
    /**
     * Signed carry-forward balance from the previous month.
     * Positive => pending payable; negative => overpaid (deduct in this month).
     */
    previousBalance?: number;
    /** Legacy (positive-only) carry. Prefer `previousBalance`. */
    previousPendingSalary?: number;
    /** Legacy (positive-only) carry. Prefer `previousBalance` (negative). */
    previousOverpayment?: number;
    finalSalaryOverride?: number;
    allBoys?: DeliveryBoy[];
  },
) {
  if (!b) {
    const bonusAmount = Math.max(0, roundMoney2(Number(opts?.bonusAmount ?? 0)));
    const deductionAmount = Math.max(0, roundMoney2(Number(opts?.deductionAmount ?? 0)));
    const legacyPending = Math.max(0, roundMoney2(Number(opts?.previousPendingSalary ?? 0)));
    const legacyOver = Math.max(0, roundMoney2(Number(opts?.previousOverpayment ?? 0)));
    const previousBalanceRaw =
      opts?.previousBalance !== undefined
        ? roundMoney2(Number(opts.previousBalance ?? 0))
        : roundMoney2(legacyPending - legacyOver);
    const previousPendingSalary = Math.max(0, previousBalanceRaw);
    const previousOverpayment = Math.max(0, -previousBalanceRaw);

    const finalSalaryOverride =
      opts?.finalSalaryOverride !== undefined ? roundMoney2(Number(opts.finalSalaryOverride ?? 0)) : undefined;
    const finalAuto = roundMoney2(bonusAmount + previousBalanceRaw + 0 - deductionAmount);
    const finalSalary = finalSalaryOverride !== undefined ? finalSalaryOverride : finalAuto;
    return {
      month: yyyyMm,
      perDay: 0,
      attendanceDays: 0,
      presentDays: 0,
      halfDays: 0,
      paidLeaveDays: 0,
      unpaidLeaveDays: 0,
      weeklyOffDays: 0,
      replacementDays: 0,
      replacementChargeableDays: 0,
      attendanceSalary: 0,
      paidLeaveSalary: 0,
      weeklyOffSalary: 0,
      halfDaySalary: 0,
      unpaidLeaveDeduction: 0,
      halfDayDeduction: 0,
      replacementDeduction: 0,
      replacementExtraSalary: 0,
      routeCoverageCreditSalary: 0,
      routeCoverageCreditedDays: 0,
      incentiveAmount: 0,
      bonusAmount,
      deductionAmount,
      previousPendingSalary,
      previousOverpayment,
      previousBalance: previousBalanceRaw,
      finalAuto,
      finalSalaryOverride,
      extraRouteEarningsFromAttendance: 0,
      temporaryReplacementExpenseMonth: 0,
      finalSalary,
    };
  }

  const dim = daysInMonth(yyyyMm);
  const perDay = resolvePerDaySalary(b, yyyyMm);

  const attendance = (b.attendance ?? []).filter((x) => clampIsoDateToMonth(x.date, yyyyMm));
  const presentDates = new Set<string>();
  const halfDates = new Set<string>();
  for (const x of attendance) {
    const d = String(x.date).slice(0, 10);
    if (x.attendanceStatus === 'Present') presentDates.add(d);
    if (x.attendanceStatus === 'Half Day') halfDates.add(d);
  }
  const presentDays = presentDates.size;
  const halfDays = halfDates.size;

  /** Delivery pay policy: only Present earns base per day; no weekly-off pay and no leave-based pay or deductions in net. */
  const attendanceDays = presentDays;
  const weeklyOffDays = 0;

  const approvedLeaves = (b.leaves ?? []).filter((x: DeliveryBoyLeaveRequest) => x.approvalStatus === 'Approved');
  const paidLeaveDays = approvedLeaves
    .filter((x) => leaveCountsAsPaid(b, x.leaveType))
    .reduce((sum, x) => sum + overlapDaysInMonth(x.leaveStartDate, x.leaveEndDate, yyyyMm), 0);
  const unpaidLeaveDays = approvedLeaves
    .filter((x) => leaveCountsAsUnpaid(b, x.leaveType))
    .reduce((sum, x) => sum + overlapDaysInMonth(x.leaveStartDate, x.leaveEndDate, yyyyMm), 0);

  const replacements = (b.replacements ?? []) as DeliveryBoyReplacementHistoryEntry[];
  const replacementDays = replacements.reduce((sum, x) => sum + overlapDaysInMonth(x.fromDate, x.toDate ?? x.fromDate, yyyyMm), 0);
  const chargeableDates = replacementChargeableDatesInMonth(b, yyyyMm);
  const replacementChargeableDays = chargeableDates.size;
  const replacementDeduction = 0;
  const { amount: routeCoverageCreditSalary, creditedDays: routeCoverageCreditedDays } = computeRouteCoverageCreditSalaryForMonth(
    b,
    yyyyMm,
    opts?.allBoys,
  );
  const replacementExtraSalary = routeCoverageCreditSalary;

  const incentiveAmount = Math.max(0, roundMoney2(Number(b.incentiveAmount ?? 0)));
  const bonusAmount = Math.max(0, roundMoney2(Number(opts?.bonusAmount ?? 0)));
  const deductionAmount = Math.max(0, roundMoney2(Number(opts?.deductionAmount ?? 0)));

  const previousBalanceRaw =
    opts?.previousBalance !== undefined
      ? roundMoney2(Number(opts.previousBalance ?? 0))
      : roundMoney2(
          (opts?.previousPendingSalary !== undefined ? Math.max(0, roundMoney2(Number(opts.previousPendingSalary ?? 0))) : getAutoPreviousBalance(b, yyyyMm)) -
            Math.max(0, roundMoney2(Number(opts?.previousOverpayment ?? 0))),
        );

  const previousPendingSalary = Math.max(0, previousBalanceRaw);
  const previousOverpayment = Math.max(0, -previousBalanceRaw);

  const attendanceSalary = Math.max(0, roundMoney2(perDay * presentDays));
  const paidLeaveSalary = 0;
  const weeklyOffSalary = 0;
  const halfDaySalary = 0;

  const unpaidLeaveDeduction = 0;
  const halfDayDeduction = 0;

  const extraRouteEarningsFromAttendance = sumExtraRouteEarningsInMonth(b, yyyyMm);
  const temporaryReplacementExpenseMonth = sumTemporaryReplacementExpenseInMonth(b, yyyyMm);

  /**
   * Final salary (auto): (per day × Present days) + (leaver per day × route-cover days for this person) + previous balance + bonus − deduction.
   * Absent days pay nothing for this boy; the covering boy gets route-cover credit separately. Weekly off and leave records do not add or subtract pay.
   * Incentives, extra route earnings, temp replacement expense are not in this net (tracked separately).
   */
  const attendanceCore = Math.max(0, roundMoney2(perDay * presentDays));
  const routeCoverCore = Math.max(0, roundMoney2(perDay * routeCoverageCreditedDays));
  const finalAuto = roundMoney2(attendanceCore + routeCoverCore + previousBalanceRaw + bonusAmount - deductionAmount);

  const finalSalary =
    opts?.finalSalaryOverride !== undefined ? roundMoney2(Number(opts.finalSalaryOverride ?? 0)) : finalAuto;

  return {
    month: yyyyMm,
    perDay,
    attendanceDays,
    presentDays,
    halfDays,
    paidLeaveDays,
    unpaidLeaveDays,
    weeklyOffDays,
    replacementDays,
    replacementChargeableDays,
    attendanceSalary,
    paidLeaveSalary,
    weeklyOffSalary,
    halfDaySalary,
    unpaidLeaveDeduction,
    halfDayDeduction,
    replacementDeduction,
    replacementExtraSalary,
    routeCoverageCreditSalary,
    routeCoverageCreditedDays,
    incentiveAmount,
    bonusAmount,
    deductionAmount,
    previousPendingSalary,
    previousOverpayment,
    previousBalance: previousBalanceRaw,
    extraRouteEarningsFromAttendance,
    temporaryReplacementExpenseMonth,
    finalAuto,
    finalSalaryOverride: opts?.finalSalaryOverride !== undefined ? roundMoney2(Number(opts.finalSalaryOverride ?? 0)) : undefined,
    finalSalary,
  };
}

export type SalaryTypeKind = 'Fixed Monthly Salary' | 'Attendance Based Salary';

/** Line items + final salary using one path for UI (Overview, Salary, Attendance summaries). */
export type UnifiedMonthlyPayroll = ReturnType<typeof computeDeliveryBoySalaryForMonth> & {
  salaryType: SalaryTypeKind;
  monthlySalary: number;
  totalDaysInMonth: number;
  perDaySalary: number;
  /** Present days in month (only Present earns base per day). */
  salaryEligibleDays: number;
  /** Per day × present days (no leave / weekly-off pay). */
  baseSalaryFromEligibleDays: number;
  /** Units for attendance-based pay: Present days only. */
  attendanceBasedUnits: number;
  /** Per day × (present days + covered route days), before pending, bonus, deduction, overpayment. */
  finalBase: number;
  /** Same as `computeDeliveryBoySalaryForMonth` finalAuto; before optional override. */
  finalAutoUnified: number;
  finalSalary: number;
  finalSalaryOverride?: number;
  /** Same as finalSalary — net salary payable label in admin UI. */
  netSalaryPayable: number;
};

/**
 * Single payroll pipeline: reuses month line items from `computeDeliveryBoySalaryForMonth` and aligns
 * `finalSalary` / `finalBase` / `finalAutoUnified` with the same auto formula (per MEMORY.md — one contract path).
 */
export function computeUnifiedMonthlyPayroll(
  b: DeliveryBoy | null | undefined,
  yyyyMm: string,
  opts?: {
    bonusAmount?: number;
    deductionAmount?: number;
    previousBalance?: number;
    previousPendingSalary?: number;
    previousOverpayment?: number;
    finalSalaryOverride?: number;
    allBoys?: DeliveryBoy[];
  },
): UnifiedMonthlyPayroll {
  const core = computeDeliveryBoySalaryForMonth(b, yyyyMm, opts);
  const dim = daysInMonth(yyyyMm);

  if (!b) {
    return {
      ...core,
      salaryType: 'Fixed Monthly Salary',
      monthlySalary: 0,
      totalDaysInMonth: dim,
      perDaySalary: 0,
      salaryEligibleDays: 0,
      baseSalaryFromEligibleDays: 0,
      attendanceBasedUnits: 0,
      finalBase: 0,
      finalAutoUnified: 0,
      finalSalary: 0,
      netSalaryPayable: 0,
    };
  }

  const salaryType = (b.salaryType ?? 'Fixed Monthly Salary') as SalaryTypeKind;
  const monthly = Math.max(0, roundMoney2(Number(b.monthlySalary ?? 0)));
  const perDay = core.perDay;
  const presentDays = core.presentDays;

  const salaryEligibleDays = Math.max(0, presentDays);
  const baseSalaryFromEligibleDays = Math.max(0, roundMoney2(perDay * salaryEligibleDays));
  const attendanceBasedUnits = presentDays;

  const routeCoverAtEmployeeRate = Math.max(0, roundMoney2(perDay * core.routeCoverageCreditedDays));
  const finalBase = Math.max(0, roundMoney2(core.attendanceSalary + routeCoverAtEmployeeRate));
  const finalAutoUnified = core.finalAuto;

  const finalSalary =
    opts?.finalSalaryOverride !== undefined ? roundMoney2(Number(opts.finalSalaryOverride ?? 0)) : finalAutoUnified;

  return {
    ...core,
    salaryType,
    monthlySalary: monthly,
    totalDaysInMonth: dim,
    perDaySalary: perDay,
    salaryEligibleDays,
    baseSalaryFromEligibleDays,
    attendanceBasedUnits,
    finalBase,
    finalAutoUnified,
    finalSalaryOverride:
      opts?.finalSalaryOverride !== undefined ? roundMoney2(Number(opts.finalSalaryOverride ?? 0)) : undefined,
    finalSalary,
    netSalaryPayable: finalSalary,
  };
}

export function computeSalaryPaymentStatus(finalSalary: number, paidAmount: number): { pendingAmount: number; status: DeliveryBoySalaryStatus } {
  const final = roundMoney2(Number(finalSalary ?? 0));
  const paid = Math.max(0, roundMoney2(Number(paidAmount ?? 0)));
  const pending = roundMoney2(final - paid);
  const status: DeliveryBoySalaryStatus = pending <= 0 ? 'Paid' : paid <= 0 ? 'Unpaid' : 'Partial';
  return { pendingAmount: pending, status };
}

export function computeAutoFinalSalaryPaymentStatus(
  earnedFinalSalary: number,
  advanceTotal: number,
  paidTowardFinalSalary: number,
): { pendingAmount: number; status: DeliveryBoySalaryStatus; netSettlementDue: number } {
  const netDue = finalSalarySettlementNetDue(earnedFinalSalary, advanceTotal);
  const { pendingAmount, status } = computeSalaryPaymentStatus(netDue, paidTowardFinalSalary);
  return { pendingAmount, status, netSettlementDue: netDue };
}

export function resolveDisplayedFinalSalaryPaymentStatus(
  rec: DeliveryBoySalaryRecord | null | undefined,
  autoStatus: DeliveryBoySalaryStatus,
): DeliveryBoySalaryStatus {
  if (rec?.paymentStatusSource === 'Manual' && rec.manualPaymentStatus) return rec.manualPaymentStatus;
  return autoStatus;
}

/** One Absent calendar day: who covered this delivery boy's route and who holds route-cover salary credit. */
export type AbsentDayCoverMemo = {
  date: string;
  coveredByDeliveryBoyId?: string;
  coveredByDeliveryBoyName?: string;
  salaryCreditedToDeliveryBoyId?: string;
  salaryCreditedToDeliveryBoyName?: string;
  transferSalaryToReplacer?: boolean;
};

function dateInClosedRange(dateIso: string, fromIso: string, toIso?: string): boolean {
  const from = String(fromIso).slice(0, 10);
  const to = String(toIso ?? fromIso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return false;
  return enumerateDatesInclusive(from, to).includes(dateIso);
}

/**
 * For each Absent day in `yyyyMm`, resolves cover + credit from replacements / leave / other boys' routeCoverageCredits.
 */
export function absentDayCoverMemosForMonth(
  b: DeliveryBoy | null | undefined,
  yyyyMm: string,
  allBoys: DeliveryBoy[] | null | undefined,
): AbsentDayCoverMemo[] {
  if (!b) return [];
  const dim = daysInMonth(yyyyMm);
  const boys = allBoys ?? [];
  const byId = new Map(boys.map((x) => [x.id, x]));

  const absentDates = new Set<string>();
  for (const e of b.attendance ?? []) {
    const d = String(e.date).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d.slice(0, 7) === yyyyMm && e.attendanceStatus === 'Absent') {
      absentDates.add(d);
    }
  }

  const memos: AbsentDayCoverMemo[] = [];

  for (let day = 1; day <= dim; day++) {
    const dateIso = `${yyyyMm}-${String(day).padStart(2, '0')}`;
    if (!absentDates.has(dateIso)) continue;

    const memo: AbsentDayCoverMemo = { date: dateIso };

    const repl =
      (b.replacements ?? []).find((r) => String(r.linkedAttendanceDate ?? '').slice(0, 10) === dateIso) ??
      (b.replacements ?? []).find((r) => dateInClosedRange(dateIso, r.fromDate, r.toDate ?? r.fromDate));

    const leave =
      (b.leaves ?? []).find((L) => String(L.linkedAttendanceDate ?? '').slice(0, 10) === dateIso) ??
      (b.leaves ?? []).find(
        (L) => L.approvalStatus === 'Approved' && dateInClosedRange(dateIso, L.leaveStartDate, L.leaveEndDate),
      );

    let creditHolderId: string | undefined;
    let creditHolderName: string | undefined;
    for (const other of boys) {
      if (other.id === b.id) continue;
      const has = (other.routeCoverageCredits ?? []).some(
        (c) => String(c.date).slice(0, 10) === dateIso && c.leaverDeliveryBoyId === b.id,
      );
      if (has) {
        creditHolderId = other.id;
        creditHolderName = other.fullName;
        break;
      }
    }

    if (repl?.replacedByDeliveryBoyId) {
      memo.coveredByDeliveryBoyId = repl.replacedByDeliveryBoyId;
      memo.coveredByDeliveryBoyName = repl.replacedByDeliveryBoyName;
      memo.transferSalaryToReplacer = repl.transferSalaryToReplacer !== false;
    } else if (leave?.replacementDeliveryBoyId) {
      memo.coveredByDeliveryBoyId = leave.replacementDeliveryBoyId;
      memo.coveredByDeliveryBoyName =
        leave.replacementDeliveryBoyName ?? byId.get(leave.replacementDeliveryBoyId)?.fullName;
      memo.transferSalaryToReplacer = true;
    }

    if (creditHolderId) {
      memo.salaryCreditedToDeliveryBoyId = creditHolderId;
      memo.salaryCreditedToDeliveryBoyName = creditHolderName;
      if (!memo.coveredByDeliveryBoyId) {
        memo.coveredByDeliveryBoyId = creditHolderId;
        memo.coveredByDeliveryBoyName = creditHolderName;
      }
    } else if (repl?.replacedByDeliveryBoyId && repl.transferSalaryToReplacer !== false) {
      memo.salaryCreditedToDeliveryBoyId = repl.replacedByDeliveryBoyId;
      memo.salaryCreditedToDeliveryBoyName =
        repl.replacedByDeliveryBoyName ?? byId.get(repl.replacedByDeliveryBoyId)?.fullName;
    } else if (leave?.replacementDeliveryBoyId) {
      memo.salaryCreditedToDeliveryBoyId = leave.replacementDeliveryBoyId;
      memo.salaryCreditedToDeliveryBoyName =
        leave.replacementDeliveryBoyName ?? byId.get(leave.replacementDeliveryBoyId)?.fullName;
    }

    memos.push(memo);
  }

  return memos;
}

/** One line for History / salary memo: base pay for a calendar day or a route-cover credit line. */
export type SalaryMemoDayLine = {
  date: string;
  kind: 'base' | 'cover';
  basis: string;
  amount: number;
  /** Present when `basis` is Absent and cover/credit was resolved. */
  absentCover?: Omit<AbsentDayCoverMemo, 'date'>;
};

function joiningDatePrefix(b: DeliveryBoy): string {
  const j = typeof b.joiningDate === 'string' ? b.joiningDate.slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(j) ? j : '';
}

function baseMemoForDay(
  b: DeliveryBoy,
  dateIso: string,
  perDay: number,
  ex: DeliveryBoyAttendanceEntry | undefined,
): { basis: string; amount: number } {
  const join = joiningDatePrefix(b);
  if (join && dateIso < join) {
    return { basis: 'Before joining', amount: 0 };
  }

  if (ex) {
    const st = String(ex.attendanceStatus ?? '');
    if (st === 'Present') return { basis: 'Present', amount: perDay };
    if (st === 'Absent') return { basis: 'Absent', amount: 0 };
    return { basis: st || 'Attendance', amount: 0 };
  }

  return { basis: 'No attendance row', amount: 0 };
}

/**
 * Day-by-day lines for a salary memo (Present = base pay; otherwise 0; route cover uses leaver per-day).
 * One `base` line per calendar day in the month, then `cover` lines for route-coverage credits on that date.
 */
export function salaryMemoLinesForMonth(
  b: DeliveryBoy | null | undefined,
  yyyyMm: string,
  allBoys: DeliveryBoy[] | null | undefined,
): SalaryMemoDayLine[] {
  if (!b) return [];
  const dim = daysInMonth(yyyyMm);
  const perDay = resolvePerDaySalary(b, yyyyMm);
  const boyMap = new Map((allBoys ?? []).map((x) => [x.id, x]));

  const byDate = new Map<string, DeliveryBoyAttendanceEntry>();
  for (const x of b.attendance ?? []) {
    const d = String(x.date).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d.slice(0, 7) === yyyyMm) {
      byDate.set(d, x);
    }
  }

  const absentCoverByDate = new Map(
    absentDayCoverMemosForMonth(b, yyyyMm, allBoys).map((m) => [m.date, m] as const),
  );

  const lines: SalaryMemoDayLine[] = [];

  for (let day = 1; day <= dim; day++) {
    const dateIso = `${yyyyMm}-${String(day).padStart(2, '0')}`;
    const ex = byDate.get(dateIso);
    const base = baseMemoForDay(b, dateIso, perDay, ex);
    const baseLine: SalaryMemoDayLine = { date: dateIso, kind: 'base', basis: base.basis, amount: base.amount };
    if (base.basis === 'Absent') {
      const ac = absentCoverByDate.get(dateIso);
      if (ac) {
        baseLine.absentCover = {
          coveredByDeliveryBoyId: ac.coveredByDeliveryBoyId,
          coveredByDeliveryBoyName: ac.coveredByDeliveryBoyName,
          salaryCreditedToDeliveryBoyId: ac.salaryCreditedToDeliveryBoyId,
          salaryCreditedToDeliveryBoyName: ac.salaryCreditedToDeliveryBoyName,
          transferSalaryToReplacer: ac.transferSalaryToReplacer,
        };
      }
    }
    lines.push(baseLine);

    const coverSeen = new Set<string>();
    for (const c of b.routeCoverageCredits ?? []) {
      if (String(c.date).slice(0, 10) !== dateIso) continue;
      const k = creditDayKey(dateIso, c.leaverDeliveryBoyId);
      if (coverSeen.has(k)) continue;
      coverSeen.add(k);
      const leaver = boyMap.get(c.leaverDeliveryBoyId);
      const amt = perDayForBoyInMonth(leaver ?? null, yyyyMm);
      const name = c.leaverDeliveryBoyName ?? leaver?.fullName ?? 'Leaver';
      lines.push({ date: dateIso, kind: 'cover', basis: `Route cover (${name})`, amount: amt });
    }
    for (const x of b.attendance ?? []) {
      const d = String(x.date).slice(0, 10);
      if (d !== dateIso || x.attendanceStatus !== 'Present' || !x.coverForDeliveryBoyId) continue;
      const k = creditDayKey(dateIso, x.coverForDeliveryBoyId);
      if (coverSeen.has(k)) continue;
      coverSeen.add(k);
      const leaver = boyMap.get(x.coverForDeliveryBoyId);
      const amt = perDayForBoyInMonth(leaver ?? null, yyyyMm);
      const name = x.coverForDeliveryBoyName ?? leaver?.fullName ?? 'Leaver';
      lines.push({ date: dateIso, kind: 'cover', basis: `Route cover (${name})`, amount: amt });
    }
  }

  return lines;
}
