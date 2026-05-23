import { describe, expect, it } from 'vitest';

import type { DeliveryBoy, DeliveryBoySalaryRecord } from '@/src/domain/deliveryBoys/entities';
import {
  computeAutoFinalSalaryPaymentStatus,
  computeDeliveryBoySalaryForMonth,
  computeSalaryPaymentStatus,
  computeUnifiedMonthlyPayroll,
  getAutoPreviousBalance,
  getAutoPreviousPendingSalary,
  profileMonthlySalaryDisplay,
  roundMoney2,
  totalAdvanceSalaryForMonthRecord,
  absentDayCoverMemosForMonth,
  salaryMemoLinesForMonth,
} from '@/src/domain/deliveryBoys/salary';

const nowIso = '2026-04-01T12:00:00.000Z';

/** Minimal `DeliveryBoy` for payroll math (contract fields only). */
function makeBoy(over: Partial<DeliveryBoy> = {}): DeliveryBoy {
  return {
    id: 'db_test',
    createdAt: nowIso,
    updatedAt: nowIso,
    fullName: 'Test Boy',
    mobileNumber: '9000000000',
    joiningDate: '2020-01-01',
    salaryType: 'Attendance Based Salary',
    monthlySalary: 31_000,
    assignedRoutes: ['Route A'],
    primaryRouteName: 'Route A',
    shiftTiming: 'Morning',
    weeklyOffDay: 'Sunday',
    status: 'Active',
    appAccessEnabled: true,
    attendance: [],
    leaves: [],
    replacements: [],
    salaryHistory: [],
    performance: [],
    complaints: [],
    audit: [],
    ...over,
  } as DeliveryBoy;
}

function presentEntries(monthKey: string, days: number[]) {
  return days.map((day) => ({
    id: `att_${monthKey}_${day}`,
    createdAt: nowIso,
    updatedAt: nowIso,
    date: `${monthKey}-${String(day).padStart(2, '0')}`,
    attendanceStatus: 'Present' as const,
  }));
}

describe('roundMoney2', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundMoney2(1.005)).toBe(1.01);
    expect(roundMoney2(10.999)).toBe(11);
  });
});

describe('computeDeliveryBoySalaryForMonth — final auto (contract)', () => {
  const month = '2024-01';
  /** 31_000 / 31 days */
  const perDay = 1000;

  it('finalAuto = perDay×present + perDay×covered + previousBalance + bonus − deduction', () => {
    const b = makeBoy({
      attendance: presentEntries(month, [1, 2, 3, 4, 5]),
    });
    const core = computeDeliveryBoySalaryForMonth(b, month, {
      bonusAmount: 200,
      deductionAmount: 100,
      previousPendingSalary: 500,
      previousOverpayment: 50,
    });
    expect(core.perDay).toBe(perDay);
    expect(core.presentDays).toBe(5);
    expect(core.routeCoverageCreditedDays).toBe(0);
    const attendanceCore = roundMoney2(perDay * 5);
    const routeCore = 0;
    expect(core.previousBalance).toBe(450);
    expect(core.finalAuto).toBe(
      roundMoney2(attendanceCore + routeCore + 450 + 200 - 100),
    );
    expect(core.finalSalary).toBe(core.finalAuto);
  });

  it('adds employee per day × covered route days; incentive stays out of finalAuto', () => {
    const b = makeBoy({
      monthlySalary: 31_000,
      incentiveAmount: 5_000,
      attendance: presentEntries(month, [10]),
      routeCoverageCredits: [
        {
          id: 'crc_1',
          createdAt: nowIso,
          updatedAt: nowIso,
          date: `${month}-11`,
          routeName: 'Route A',
          leaverDeliveryBoyId: 'other',
          leaverDeliveryBoyName: 'Other',
        },
      ],
    });
    const core = computeDeliveryBoySalaryForMonth(b, month, {
      allBoys: [
        makeBoy({ id: 'other', monthlySalary: 31_000, perDaySalary: 1000, attendance: [], leaves: [], replacements: [], salaryHistory: [] }),
      ],
    });
    expect(core.routeCoverageCreditedDays).toBe(1);
    expect(core.routeCoverageCreditSalary).toBeGreaterThan(0);
    expect(core.incentiveAmount).toBe(5_000);
    const routeAtEmployee = roundMoney2(perDay * 1);
    expect(core.finalAuto).toBe(roundMoney2(perDay + routeAtEmployee));
    expect(core.finalSalary).toBe(core.finalAuto);
  });

  it('counts only Present days, not Half Day', () => {
    const b = makeBoy({
      attendance: [
        {
          id: 'h1',
          createdAt: nowIso,
          updatedAt: nowIso,
          date: `${month}-05`,
          attendanceStatus: 'Half Day',
        },
      ],
    });
    const core = computeDeliveryBoySalaryForMonth(b, month, {});
    expect(core.presentDays).toBe(0);
    expect(core.halfDays).toBe(1);
    expect(core.finalAuto).toBe(0);
  });

  it('does not pay weekly off, paid leave overlap, or replacement deduction in auto salary', () => {
    const b = makeBoy({
      monthlySalary: 31_000,
      attendance: [
        {
          id: 'w1',
          createdAt: nowIso,
          updatedAt: nowIso,
          date: `${month}-07`,
          attendanceStatus: 'Weekly Off',
        },
      ],
      leaves: [
        {
          id: 'lv1',
          createdAt: nowIso,
          updatedAt: nowIso,
          leaveStartDate: `${month}-08`,
          leaveEndDate: `${month}-08`,
          leaveType: 'Paid Leave',
          reason: 'Test',
          approvalStatus: 'Approved',
          approvedBy: 'Admin',
        } as any,
      ],
      replacements: [
        {
          id: 'r1',
          createdAt: nowIso,
          updatedAt: nowIso,
          reason: 'Absent',
          fromDate: `${month}-09`,
          toDate: `${month}-09`,
          routes: ['Route A'],
          replacedByDeliveryBoyId: 'other',
          replacedByDeliveryBoyName: 'Other',
          transferSalaryToReplacer: true,
        } as any,
      ],
    });
    const core = computeDeliveryBoySalaryForMonth(b, month, {});
    expect(core.presentDays).toBe(0);
    expect(core.paidLeaveDays).toBe(1);
    expect(core.weeklyOffDays).toBe(0);
    expect(core.paidLeaveSalary).toBe(0);
    expect(core.weeklyOffSalary).toBe(0);
    expect(core.replacementDeduction).toBe(0);
    expect(core.finalAuto).toBe(0);
  });

  it('respects finalSalaryOverride', () => {
    const b = makeBoy({ attendance: presentEntries(month, [1]) });
    const core = computeDeliveryBoySalaryForMonth(b, month, { finalSalaryOverride: 99_999 });
    expect(core.finalSalary).toBe(99_999);
    expect(core.finalAuto).toBe(perDay);
  });

  it('null boy: finalAuto = pending + bonus − deduction − overpayment', () => {
    const core = computeDeliveryBoySalaryForMonth(null, month, {
      previousPendingSalary: 1000,
      bonusAmount: 100,
      deductionAmount: 200,
      previousOverpayment: 300,
    });
    expect(core.finalAuto).toBe(roundMoney2(1000 + 100 - 200 - 300));
    expect(core.finalSalary).toBe(core.finalAuto);
  });
});

describe('computeUnifiedMonthlyPayroll — aligned with core', () => {
  const month = '2024-02';

  it('finalBase and finalAutoUnified stay in sync with computeDeliveryBoySalaryForMonth', () => {
    const b = makeBoy({
      monthlySalary: 28_000,
      attendance: presentEntries(month, [1, 2, 3]),
    });
    const perDay = roundMoney2(28_000 / 29);
    const core = computeDeliveryBoySalaryForMonth(b, month, {
      previousPendingSalary: 100,
      bonusAmount: 50,
      deductionAmount: 25,
      previousOverpayment: 10,
    });
    const u = computeUnifiedMonthlyPayroll(b, month, {
      previousPendingSalary: 100,
      bonusAmount: 50,
      deductionAmount: 25,
      previousOverpayment: 10,
    });

    expect(u.perDaySalary).toBe(core.perDay);
    expect(u.perDaySalary).toBe(perDay);
    const routePart = Math.max(0, roundMoney2(perDay * core.routeCoverageCreditedDays));
    expect(u.finalBase).toBe(roundMoney2(core.attendanceSalary + routePart));
    expect(u.finalBase).toBe(roundMoney2(core.attendanceSalary));
    expect(u.previousPendingSalary).toBe(core.previousPendingSalary);
    expect(u.finalAutoUnified).toBe(core.finalAuto);
    expect(u.finalSalary).toBe(core.finalSalary);
    expect(u.netSalaryPayable).toBe(u.finalSalary);
  });

  it('Fixed Monthly Salary type uses same present + route-cover rule for finalAuto', () => {
    const b = makeBoy({
      salaryType: 'Fixed Monthly Salary',
      monthlySalary: 30_000,
      attendance: presentEntries(month, [5, 6]),
    });
    const u = computeUnifiedMonthlyPayroll(b, month, {});
    const perDay = roundMoney2(30_000 / 29);
    expect(u.finalBase).toBe(roundMoney2(u.attendanceSalary + roundMoney2(perDay * u.routeCoverageCreditedDays)));
    expect(u.finalAutoUnified).toBe(u.finalBase);
  });
});

describe('getAutoPreviousPendingSalary', () => {
  it('reads pendingAmount from the prior month salary row', () => {
    const prevRecord: DeliveryBoySalaryRecord = {
      id: 'sal_prev',
      createdAt: nowIso,
      updatedAt: nowIso,
      salaryMonth: '2024-01',
      salaryType: 'Attendance Based Salary',
      baseSalary: 31_000,
      finalSalary: 5000,
      paidAmount: 2000,
      pendingAmount: 350.5,
      totalWorkingDays: 20,
      paymentStatus: 'Partial',
    };
    const b = makeBoy({ salaryHistory: [prevRecord] });
    expect(getAutoPreviousPendingSalary(b, '2024-02')).toBe(350.5);
  });
});

describe('profileMonthlySalaryDisplay', () => {
  it('uses stored monthly salary when positive', () => {
    const b = makeBoy({ monthlySalary: 25_000, perDaySalary: 999 });
    expect(profileMonthlySalaryDisplay(b, '2024-01')).toBe(25_000);
  });

  it('derives from explicit per day × days in month when monthly is zero', () => {
    const b = makeBoy({ monthlySalary: 0, perDaySalary: 1000 });
    expect(profileMonthlySalaryDisplay(b, '2024-01')).toBe(roundMoney2(1000 * 31));
  });

  it('returns 0 when monthly is zero and no per day', () => {
    const b = makeBoy({ monthlySalary: 0, perDaySalary: undefined });
    expect(profileMonthlySalaryDisplay(b, '2024-01')).toBe(0);
  });
});

describe('computeSalaryPaymentStatus', () => {
  it('matches pending and status labels', () => {
    expect(computeSalaryPaymentStatus(10_000, 0)).toEqual({ pendingAmount: 10_000, status: 'Unpaid' });
    expect(computeSalaryPaymentStatus(10_000, 4000)).toEqual({ pendingAmount: 6000, status: 'Partial' });
    expect(computeSalaryPaymentStatus(10_000, 10_000)).toEqual({ pendingAmount: 0, status: 'Paid' });
  });

  it('treats negative pending as Paid (carry forward)', () => {
    expect(computeSalaryPaymentStatus(1000, 1500)).toEqual({ pendingAmount: -500, status: 'Paid' });
    expect(computeSalaryPaymentStatus(-1000, 0)).toEqual({ pendingAmount: -1000, status: 'Paid' });
  });
});

describe('getAutoPreviousBalance', () => {
  it('reads pendingAmount from the prior month salary row (signed)', () => {
    const prevRecord: DeliveryBoySalaryRecord = {
      id: 'sal_prev',
      createdAt: nowIso,
      updatedAt: nowIso,
      salaryMonth: '2024-01',
      salaryType: 'Attendance Based Salary',
      baseSalary: 31_000,
      finalSalary: 5000,
      paidAmount: 2000,
      pendingAmount: -350.5,
      totalWorkingDays: 20,
      paymentStatus: 'Paid',
    };
    const b = makeBoy({ salaryHistory: [prevRecord] });
    expect(getAutoPreviousBalance(b, '2024-02')).toBe(-350.5);
  });

  it('falls back to earned − advances − paid toward final when pendingAmount is missing', () => {
    const prevRecord = {
      id: 'sal_prev2',
      createdAt: nowIso,
      updatedAt: nowIso,
      salaryMonth: '2024-01',
      salaryType: 'Attendance Based Salary',
      baseSalary: 31_000,
      finalSalary: 1000,
      paidAmount: 2500,
      totalWorkingDays: 20,
      paymentStatus: 'Paid',
    } as DeliveryBoySalaryRecord;
    const b = makeBoy({ salaryHistory: [prevRecord] });
    expect(getAutoPreviousBalance(b, '2024-02')).toBe(-1500);
  });

  it('subtracts advance ledger from carry-forward when pendingAmount is missing', () => {
    const prevRecord = {
      id: 'sal_prev3',
      createdAt: nowIso,
      updatedAt: nowIso,
      salaryMonth: '2024-01',
      salaryType: 'Attendance Based Salary',
      baseSalary: 31_000,
      finalSalary: 10_000,
      paidAmount: 2000,
      advanceSalaryEntries: [
        { id: 'adv1', createdAt: nowIso, updatedAt: nowIso, date: '2024-01-05', amount: 3000, paymentMode: 'Cash' as const },
      ],
      totalWorkingDays: 20,
      paymentStatus: 'Partial',
    } as DeliveryBoySalaryRecord;
    const b = makeBoy({ salaryHistory: [prevRecord] });
    expect(getAutoPreviousBalance(b, '2024-02')).toBe(5000);
  });
});

describe('advance vs final settlement', () => {
  it('sums advanceSalaryEntries on the month record', () => {
    const rec: DeliveryBoySalaryRecord = {
      id: 'sal',
      createdAt: nowIso,
      updatedAt: nowIso,
      salaryMonth: '2024-01',
      salaryType: 'Attendance Based Salary',
      baseSalary: 0,
      finalSalary: 10_000,
      paymentStatus: 'Unpaid',
      advanceSalaryEntries: [
        { id: 'a1', createdAt: nowIso, updatedAt: nowIso, date: '2024-01-01', amount: 1000, paymentMode: 'Cash' },
        { id: 'a2', createdAt: nowIso, updatedAt: nowIso, date: '2024-01-02', amount: 500, paymentMode: 'UPI' },
      ],
    };
    expect(totalAdvanceSalaryForMonthRecord(rec)).toBe(1500);
  });

  it('computeAutoFinalSalaryPaymentStatus uses net due after advances', () => {
    const r = computeAutoFinalSalaryPaymentStatus(10_000, 1500, 2000);
    expect(r.netSettlementDue).toBe(8500);
    expect(r.pendingAmount).toBe(6500);
    expect(r.status).toBe('Partial');
  });
});

describe('absentDayCoverMemosForMonth', () => {
  const month = '2024-01';

  it('maps Absent + replacement to who covered and who is credited when transfer is on', () => {
    const b = makeBoy({
      attendance: [
        {
          id: 'a1',
          createdAt: nowIso,
          updatedAt: nowIso,
          date: `${month}-10`,
          attendanceStatus: 'Absent',
        },
      ],
      replacements: [
        {
          id: 'rpl_att_2024-01-10',
          createdAt: nowIso,
          updatedAt: nowIso,
          reason: 'Absent',
          fromDate: `${month}-10`,
          toDate: `${month}-10`,
          routes: ['Route A'],
          replacedByDeliveryBoyId: 'cover',
          replacedByDeliveryBoyName: 'Cover Boy',
          transferSalaryToReplacer: true,
          linkedAttendanceDate: `${month}-10`,
        } as any,
      ],
    });
    const cover = makeBoy({ id: 'cover', fullName: 'Cover Boy', monthlySalary: 31_000 });
    const memos = absentDayCoverMemosForMonth(b, month, [b, cover]);
    expect(memos).toHaveLength(1);
    expect(memos[0]?.date).toBe(`${month}-10`);
    expect(memos[0]?.coveredByDeliveryBoyId).toBe('cover');
    expect(memos[0]?.salaryCreditedToDeliveryBoyId).toBe('cover');
  });

  it('prefers routeCoverageCredits on another boy for credited-to when present', () => {
    const leaver = makeBoy({
      id: 'leave_boy',
      fullName: 'Absent One',
      attendance: [
        {
          id: 'a1',
          createdAt: nowIso,
          updatedAt: nowIso,
          date: `${month}-12`,
          attendanceStatus: 'Absent',
        },
      ],
      replacements: [],
      leaves: [],
    });
    const cred = makeBoy({
      id: 'cred_boy',
      fullName: 'Cred Holder',
      monthlySalary: 31_000,
      routeCoverageCredits: [
        {
          id: 'crc1',
          createdAt: nowIso,
          updatedAt: nowIso,
          date: `${month}-12`,
          routeName: 'Route A',
          leaverDeliveryBoyId: 'leave_boy',
          leaverDeliveryBoyName: 'Absent One',
        },
      ],
    });
    const memos = absentDayCoverMemosForMonth(leaver, month, [leaver, cred]);
    expect(memos[0]?.salaryCreditedToDeliveryBoyId).toBe('cred_boy');
    expect(memos[0]?.coveredByDeliveryBoyName).toBe('Cred Holder');
  });
});

describe('salaryMemoLinesForMonth', () => {
  const month = '2024-01';

  it('emits one base line per calendar day and marks Present with full per-day', () => {
    const b = makeBoy({
      attendance: presentEntries(month, [1]),
    });
    const lines = salaryMemoLinesForMonth(b, month, []);
    const base = lines.filter((l) => l.kind === 'base');
    expect(base).toHaveLength(31);
    const jan1 = base.find((l) => l.date === `${month}-01`);
    expect(jan1?.basis).toBe('Present');
    expect(jan1?.amount).toBe(1000);
  });

  it('adds a cover line using leaver per-day when route coverage credit exists', () => {
    const leaver = makeBoy({
      id: 'other',
      fullName: 'Other',
      monthlySalary: 31_000,
      attendance: [],
      leaves: [],
      replacements: [],
      salaryHistory: [],
    });
    const b = makeBoy({
      routeCoverageCredits: [
        {
          id: 'crc_1',
          createdAt: nowIso,
          updatedAt: nowIso,
          date: `${month}-05`,
          routeName: 'Route A',
          leaverDeliveryBoyId: 'other',
          leaverDeliveryBoyName: 'Other',
        },
      ],
    });
    const lines = salaryMemoLinesForMonth(b, month, [leaver]);
    const covers = lines.filter((l) => l.kind === 'cover' && l.date === `${month}-05`);
    expect(covers).toHaveLength(1);
    expect(covers[0]?.amount).toBe(1000);
    expect(covers[0]?.basis).toContain('Other');
  });

  it('attaches absentCover on Absent base lines when replacement resolves cover and credit', () => {
    const b = makeBoy({
      attendance: [
        {
          id: 'a1',
          createdAt: nowIso,
          updatedAt: nowIso,
          date: `${month}-10`,
          attendanceStatus: 'Absent',
        },
      ],
      replacements: [
        {
          id: 'rpl_att_2024-01-10',
          createdAt: nowIso,
          updatedAt: nowIso,
          reason: 'Absent',
          fromDate: `${month}-10`,
          toDate: `${month}-10`,
          routes: ['Route A'],
          replacedByDeliveryBoyId: 'cover',
          replacedByDeliveryBoyName: 'Cover Boy',
          transferSalaryToReplacer: true,
          linkedAttendanceDate: `${month}-10`,
        } as any,
      ],
    });
    const cover = makeBoy({ id: 'cover', fullName: 'Cover Boy', monthlySalary: 31_000 });
    const lines = salaryMemoLinesForMonth(b, month, [b, cover]);
    const absentLine = lines.find((l) => l.kind === 'base' && l.date === `${month}-10`);
    expect(absentLine?.basis).toBe('Absent');
    expect(absentLine?.absentCover?.coveredByDeliveryBoyId).toBe('cover');
    expect(absentLine?.absentCover?.salaryCreditedToDeliveryBoyId).toBe('cover');
  });
});
