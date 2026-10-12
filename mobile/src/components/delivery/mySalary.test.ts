import { describe, expect, it } from 'vitest';

import { buildMyAttendanceDays, buildMySalaryMonth, summarizeMyAttendance } from '@/src/components/delivery/mySalary';
import type { DeliveryBoy, DeliveryBoySalaryRecord } from '@/src/domain/deliveryBoys/entities';

const TS = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
const MONTH = '2026-09';

function boy(over: Partial<DeliveryBoy> = {}): DeliveryBoy {
  return {
    id: 'db_1',
    ...TS,
    fullName: 'Sagar',
    mobileNumber: '9000000001',
    joiningDate: '2026-09-01',
    salaryType: 'Fixed Monthly Salary',
    monthlySalary: 30_000,
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

function attendance(days: number[], status: 'Present' | 'Absent') {
  return days.map((day) => ({
    id: `att_${status}_${day}`,
    ...TS,
    date: `${MONTH}-${String(day).padStart(2, '0')}`,
    attendanceStatus: status,
  }));
}

function salaryRow(over: Partial<DeliveryBoySalaryRecord> = {}): DeliveryBoySalaryRecord {
  return {
    id: 'sal_1',
    ...TS,
    salaryMonth: MONTH,
    salaryType: 'Fixed Monthly Salary',
    baseSalary: 30_000,
    finalSalary: 0,
    paymentStatus: 'Unpaid',
    ...over,
  } as DeliveryBoySalaryRecord;
}

describe('buildMySalaryMonth', () => {
  it('pays for present days at the per-day rate', () => {
    // 30,000 over 30 days = 1,000 per day.
    const summary = buildMySalaryMonth(boy({ attendance: attendance([1, 2, 3], 'Present') }), [], MONTH);

    expect(summary.perDay).toBe(1000);
    expect(summary.presentDays).toBe(3);
    expect(summary.basePay).toBe(3000);
    expect(summary.earned).toBe(3000);
  });

  it('counts marked absent days separately from unmarked ones', () => {
    const summary = buildMySalaryMonth(
      boy({ attendance: [...attendance([1, 2], 'Present'), ...attendance([3], 'Absent')] }),
      [],
      MONTH,
    );

    expect(summary.presentDays).toBe(2);
    expect(summary.absentDays).toBe(1);
    expect(summary.earned).toBe(2000);
  });

  it('adds bonus and subtracts deduction from the stored salary row', () => {
    const summary = buildMySalaryMonth(
      boy({
        attendance: attendance([1], 'Present'),
        salaryHistory: [salaryRow({ bonusAmount: 500, deductionAmount: 200 })],
      }),
      [],
      MONTH,
    );

    expect(summary.bonus).toBe(500);
    expect(summary.deduction).toBe(200);
    expect(summary.earned).toBe(1300);
  });

  it('reports what is still due after advance and part payment', () => {
    const summary = buildMySalaryMonth(
      boy({
        attendance: attendance([1, 2, 3, 4, 5], 'Present'),
        salaryHistory: [
          salaryRow({
            paidAmount: 1500,
            advanceSalaryEntries: [{ id: 'adv_1', ...TS, date: `${MONTH}-10`, amount: 1000, paymentMode: 'Cash' }],
          }),
        ],
      }),
      [],
      MONTH,
    );

    expect(summary.earned).toBe(5000);
    expect(summary.advanceTaken).toBe(1000);
    expect(summary.paidToDate).toBe(1500);
    expect(summary.pending).toBe(2500);
    expect(summary.status).toBe('Partial');
  });

  it('reads Paid once the settlement is covered', () => {
    const summary = buildMySalaryMonth(
      boy({
        attendance: attendance([1], 'Present'),
        salaryHistory: [salaryRow({ paidAmount: 1000 })],
      }),
      [],
      MONTH,
    );

    expect(summary.pending).toBe(0);
    expect(summary.status).toBe('Paid');
  });

  it('returns zeroes rather than throwing when the account has no delivery boy record', () => {
    const summary = buildMySalaryMonth(null, [], MONTH);
    expect(summary).toMatchObject({ earned: 0, presentDays: 0, pending: 0, perDay: 0 });
  });
});

describe('buildMyAttendanceDays', () => {
  it('lists employed days newest first with what each earned', () => {
    const days = buildMyAttendanceDays(
      boy({ attendance: [...attendance([1, 2], 'Present'), ...attendance([3], 'Absent')] }),
      [],
      MONTH,
      '2026-09-30',
    );

    expect(days).toHaveLength(30);
    expect(days[0]!.dateYmd).toBe('2026-09-30');
    expect(days.at(-1)).toMatchObject({ dateYmd: '2026-09-01', status: 'Present', earned: 1000 });
    expect(days.find((d) => d.dateYmd === '2026-09-03')).toMatchObject({ status: 'Absent', earned: 0 });
  });

  it('calls a day with no attendance row "Not marked"', () => {
    const days = buildMyAttendanceDays(boy({ attendance: attendance([1], 'Present') }), [], MONTH, '2026-09-30');
    expect(days.find((d) => d.dateYmd === '2026-09-02')?.status).toBe('Not marked');
  });

  it('leaves out days before the boy joined', () => {
    const days = buildMyAttendanceDays(boy({ joiningDate: '2026-09-15' }), [], MONTH, '2026-09-30');
    expect(days).toHaveLength(16);
    expect(days.at(-1)!.dateYmd).toBe('2026-09-15');
  });

  it('summarises the month by status', () => {
    const days = buildMyAttendanceDays(
      boy({
        joiningDate: '2026-09-01',
        lastWorkingDate: '2026-09-05',
        attendance: [...attendance([1, 2], 'Present'), ...attendance([3], 'Absent')],
      } as Partial<DeliveryBoy>),
      [],
      MONTH,
      '2026-09-30',
    );

    expect(summarizeMyAttendance(days)).toEqual({ present: 2, absent: 1, notMarked: 2, other: 0 });
  });

  it('stops at the given day so days still to come are not listed as unmarked', () => {
    const days = buildMyAttendanceDays(boy({ attendance: attendance([1], 'Present') }), [], MONTH, '2026-09-03');

    expect(days.map((d) => d.dateYmd)).toEqual(['2026-09-03', '2026-09-02', '2026-09-01']);
    expect(summarizeMyAttendance(days)).toEqual({ present: 1, absent: 0, notMarked: 2, other: 0 });
  });

  it('has nothing to list without a delivery boy record', () => {
    expect(buildMyAttendanceDays(null, [], MONTH)).toEqual([]);
    expect(summarizeMyAttendance([])).toEqual({ present: 0, absent: 0, notMarked: 0, other: 0 });
  });
});
