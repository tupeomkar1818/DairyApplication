import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import type { DeliveryBoy } from '@/src/domain/deliveryBoys/entities';
import {
  computeAutoFinalSalaryPaymentStatus,
  computeMonthlyPayrollFromHistory,
  getSalaryRecordForMonth,
  resolveDisplayedFinalSalaryPaymentStatus,
  roundMoney2,
  salaryMemoLinesForMonth,
  totalAdvanceSalaryForMonthRecord,
} from '@/src/domain/deliveryBoys/salary';

/**
 * The delivery boy's own view of a salary month: the same payroll the admin settles, reduced to what the boy needs
 * to answer "what did I earn, what have I been paid, what is still due" — and the day-by-day attendance behind it.
 */

export type MySalaryMonth = {
  month: string;
  perDay: number;
  totalDaysInMonth: number;
  presentDays: number;
  absentDays: number;
  /** Days this boy covered an absent colleague's route. */
  coverDays: number;
  basePay: number;
  coverPay: number;
  bonus: number;
  deduction: number;
  /** Signed carry-forward from earlier months: positive is still owed, negative was overpaid. */
  previousBalance: number;
  /** Final salary for the month, after bonus, deduction and carry-forward. */
  earned: number;
  advanceTaken: number;
  paidToDate: number;
  /** Still to be paid after advance and part payments. */
  pending: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
  lastPaymentDateIso?: string;
  lastPaymentMode?: string;
};

export function buildMySalaryMonth(
  boy: DeliveryBoy | null | undefined,
  allBoys: DeliveryBoy[] | null | undefined,
  yyyyMm: string,
  upToYmd: string = todayYmd(),
): MySalaryMonth {
  const hist = getSalaryRecordForMonth(boy, yyyyMm);
  const payroll = computeMonthlyPayrollFromHistory(boy, yyyyMm, allBoys, hist);
  // Payroll counts only the days that earn, so absent days come from the same day list the attendance screen shows.
  const attendance = summarizeMyAttendance(buildMyAttendanceDays(boy, allBoys, yyyyMm, upToYmd));

  const earned = roundMoney2(payroll.finalSalary);
  const advanceTaken = totalAdvanceSalaryForMonthRecord(hist);
  const paidToDate = Math.max(0, roundMoney2(Number(hist?.paidAmount ?? 0)));
  const auto = computeAutoFinalSalaryPaymentStatus(earned, advanceTaken, paidToDate);

  return {
    month: yyyyMm,
    perDay: payroll.perDay,
    totalDaysInMonth: payroll.totalDaysInMonth,
    presentDays: payroll.presentDays,
    absentDays: attendance.absent,
    coverDays: payroll.routeCoverageCreditedDays,
    basePay: roundMoney2(payroll.perDay * payroll.presentDays),
    coverPay: roundMoney2(payroll.routeCoverageCreditSalary),
    bonus: roundMoney2(payroll.bonusAmount),
    deduction: roundMoney2(payroll.deductionAmount),
    previousBalance: roundMoney2(payroll.previousBalance),
    earned,
    advanceTaken,
    paidToDate,
    pending: Math.max(0, roundMoney2(auto.pendingAmount)),
    status: resolveDisplayedFinalSalaryPaymentStatus(hist, auto.status) as MySalaryMonth['status'],
    lastPaymentDateIso: hist?.paymentDate,
    lastPaymentMode: hist?.paymentMode,
  };
}

export type MyAttendanceDay = {
  dateYmd: string;
  /** 'Present' | 'Absent' | 'Not marked' | a legacy status such as 'Paid Leave'. */
  status: string;
  /** What the day earned, cover credit included. */
  earned: number;
  /** Set when the day carries a route-cover credit, e.g. "Route cover (Sagar)". */
  coverNote?: string;
  /** Set when this boy was absent and somebody else ran the route. */
  coveredByName?: string;
};

/**
 * One row per employed day of the month, newest first. Days outside employment are left out, and so are days still
 * to come: a future day has nothing to mark, and listing it as "Not marked" reads like a missing record.
 */
export function buildMyAttendanceDays(
  boy: DeliveryBoy | null | undefined,
  allBoys: DeliveryBoy[] | null | undefined,
  yyyyMm: string,
  upToYmd: string = todayYmd(),
): MyAttendanceDay[] {
  const lines = salaryMemoLinesForMonth(boy, yyyyMm, allBoys ?? []);
  const byDate = new Map<string, MyAttendanceDay>();

  for (const line of lines) {
    if (line.kind === 'cover') {
      const day = byDate.get(line.date);
      if (!day) continue; // The day itself was filtered out (future, or outside employment).
      day.earned = roundMoney2(day.earned + line.amount);
      day.coverNote = day.coverNote ? `${day.coverNote}, ${line.basis}` : line.basis;
      continue;
    }

    if (line.basis === 'Before joining' || line.basis === 'After last working date') continue;
    if (line.date > upToYmd) continue;

    byDate.set(line.date, {
      dateYmd: line.date,
      status: line.basis === 'No attendance row' ? 'Not marked' : line.basis,
      earned: roundMoney2(line.amount),
      coveredByName: line.absentCover?.coveredByDeliveryBoyName,
    });
  }

  return Array.from(byDate.values()).sort((a, b) => b.dateYmd.localeCompare(a.dateYmd));
}

export type MyAttendanceSummary = { present: number; absent: number; notMarked: number; other: number };

export function summarizeMyAttendance(days: readonly MyAttendanceDay[]): MyAttendanceSummary {
  const out: MyAttendanceSummary = { present: 0, absent: 0, notMarked: 0, other: 0 };
  for (const d of days) {
    if (d.status === 'Present') out.present += 1;
    else if (d.status === 'Absent') out.absent += 1;
    else if (d.status === 'Not marked') out.notMarked += 1;
    else out.other += 1;
  }
  return out;
}

/**
 * Rupees for the delivery app's small screens: whole rupees, with paise only when there are any.
 * (`formatInr2` always prints two decimals, which is noise on a tile.)
 */
export function formatRupees(amount: number): string {
  const rounded = roundMoney2(amount);
  const hasPaise = Math.abs(rounded % 1) > 0.004;
  return `₹${rounded.toLocaleString('en-IN', {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}
