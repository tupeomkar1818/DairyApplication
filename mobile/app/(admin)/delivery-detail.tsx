import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { Button, Card, Dialog, Portal, Switch, Text, TextInput } from 'react-native-paper';

import { useDeliveryBoy } from '@/src/hooks/deliveryBoys';
import { useDeliveryBoys, useUpdateDeliveryBoy } from '@/src/hooks/deliveryBoys';
import { DateInput } from '@/src/components/DateInput';
import {
  buildRouteCoverageCreditsForRange,
  mergeRouteCoverageCreditsDedup,
  stripCreditsBySourceLeaveId,
  stripCreditsBySourceReplacementId,
} from '@/src/domain/deliveryBoys/coverageCredits';
import type { DeliveryBoy, DeliveryBoyAttendanceEntry, DeliveryBoyAuditEntry, DeliveryBoyLeaveRequest } from '@/src/domain/deliveryBoys/entities';
import {
  DELIVERY_BOY_ADMIN_ATTENDANCE_STATUS_OPTIONS,
  DELIVERY_BOY_ATTENDANCE_ABSENT_LINKED_LEAVE_TYPE,
  deliveryBoyAdminAttendanceDraftFromStored,
  type AttendanceStatus,
  type DeliveryBoyAdminAttendanceStatus,
  type ReplacementReason,
} from '@/src/domain/deliveryBoys/enums';
import { DeliveryBoyAdvanceSalaryEntrySchema } from '@/src/domain/deliveryBoys/validations';
import {
  computeAutoFinalSalaryPaymentStatus,
  computeFinalSalarySettlementPending,
  computeUnifiedMonthlyPayroll,
  daysInMonth,
  finalSalarySettlementNetDue,
  formatInr2,
  getAutoPreviousBalance,
  getSalaryRecordForMonth,
  profileMonthlySalaryDisplay,
  resolveDisplayedFinalSalaryPaymentStatus,
  roundMoney2,
  salaryMemoLinesForMonth,
  totalAdvanceSalaryForMonthRecord,
} from '@/src/domain/deliveryBoys/salary';
import { services } from '@/src/infrastructure/service-registry';

function autoLeaveIdForAttendanceDate(dateIso: string) {
  return `lev_att_${String(dateIso).slice(0, 10)}`;
}

function autoReplacementIdForAttendanceDate(dateIso: string) {
  return `rpl_att_${String(dateIso).slice(0, 10)}`;
}

function dashStr(v: string | undefined | null): string {
  const s = (v ?? '').trim();
  return s ? s : '—';
}

function formatSalaryTypeUi(t: string): string {
  if (t === 'Attendance Based Salary') return 'Attendance Based';
  if (t === 'Fixed Monthly Salary') return 'Fixed Monthly';
  return t;
}

function paymentStatusUi(s: string): string {
  return s === 'Unpaid' ? 'Pending' : s;
}

function newAttendanceHistoryEntry(args: {
  nowIso: string;
  action: 'Created' | 'Status Updated' | 'Deleted';
  fromStatus?: AttendanceStatus;
  toStatus?: AttendanceStatus;
  note?: string;
}) {
  const nowIso = args.nowIso;
  return {
    id: `ath_${Date.now().toString(16)}`,
    date: nowIso,
    updatedBy: 'Admin' as const,
    action: args.action,
    fromStatus: args.fromStatus,
    toStatus: args.toStatus,
    note: args.note,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** How the day was last reflected on the stored attendance row (admin edits set `adminManualOverride`). */
function attendanceSourceLabel(e: DeliveryBoyAttendanceEntry): string {
  if (e.adminManualOverride) return 'Admin panel';
  return 'System';
}

function formatUpdatedAtShort(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function salaryUiStatusColors(label: string) {
  if (label === 'Paid') return { bg: 'rgba(34,197,94,0.16)', border: 'rgba(34,197,94,0.30)', fg: '#166534' };
  if (label === 'Partial') return { bg: 'rgba(245,158,11,0.16)', border: 'rgba(245,158,11,0.30)', fg: '#92400E' };
  return { bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.28)', fg: '#B91C1C' };
}

function SalaryStatusBadge({ status, compact }: { status: 'Paid' | 'Partial' | 'Unpaid'; compact?: boolean }) {
  const isPaid = status === 'Paid';
  const isPartial = status === 'Partial';
  const label = isPaid ? 'Paid' : isPartial ? 'Partial' : 'Pending';
  const bg = isPaid ? styles.statusPillPaid : isPartial ? styles.statusPillPartial : styles.statusPillPendingRed;
  return (
    <View style={[styles.statusPill, compact && styles.statusPillCompact, bg]}>
      <Text variant="labelSmall" style={[styles.statusPillText, compact && styles.statusPillTextCompact]}>
        {label}
      </Text>
    </View>
  );
}

function ProfileKvRow({
  label,
  value,
  labelStyle,
  valueStyle,
  compact,
}: {
  label: string;
  value: string;
  labelStyle: object;
  valueStyle: object;
  compact?: boolean;
}) {
  return (
    <View style={[styles.profileKvRow, compact && styles.profileKvRowCompact]}>
      <Text variant={compact ? 'bodySmall' : 'bodyMedium'} style={[styles.profileKvLabel, labelStyle]} numberOfLines={2}>
        {label}
      </Text>
      <Text variant={compact ? 'bodySmall' : 'bodyMedium'} style={[styles.profileKvValue, valueStyle]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const COLORS = {
  primary: '#2563EB',
  secondary: '#60A5FA',
  accent: '#22C55E',
  bg: '#F8FAFC',
  text: '#1E293B',
  warning: '#F59E0B',
  danger: '#EF4444',
};

type TabKey = 'salary' | 'attendance' | 'overview' | 'history';

const DETAIL_TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Profile Information' },
  { key: 'salary', label: 'Salary' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'history', label: 'History' },
];

function TabPill({ label, active, onPress, compact }: { label: string; active: boolean; onPress: () => void; compact?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabPill,
        !compact && styles.tabPillMax,
        compact && styles.tabPillCompact,
        active ? styles.tabPillActive : styles.tabPillInactive,
        pressed && styles.pressed,
      ]}
    >
      <Text
        variant={compact ? 'labelMedium' : 'labelLarge'}
        style={[compact && styles.tabTextCompact, active ? styles.tabTextActive : styles.tabTextInactive]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function AdminDeliveryBoyDetailDashboard() {
  const scheme = useColorScheme();
  const { width } = useWindowDimensions();
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ?? '';
  const boy = useDeliveryBoy(id);
  const allBoys = useDeliveryBoys();
  const update = useUpdateDeliveryBoy();
  const b = boy.data;

  const [tab, setTab] = useState<TabKey>('overview');
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | { kind: 'backup' | 'replacement' }>(null);
  const [attendanceSelected, setAttendanceSelected] = useState<null | { dateIso: string }>(null);
  const [attendanceMonthPickerOpen, setAttendanceMonthPickerOpen] = useState(false);
  const [attendanceEditOpen, setAttendanceEditOpen] = useState(false);
  const [attendanceStatusPickerOpen, setAttendanceStatusPickerOpen] = useState(false);
  const [attendanceDraftStatus, setAttendanceDraftStatus] = useState<DeliveryBoyAdminAttendanceStatus>('Present');
  const [salaryMonth, setSalaryMonth] = useState<string>('');
  const [salaryMonthPickerOpen, setSalaryMonthPickerOpen] = useState(false);
  const [salaryPaymentModePickerOpen, setSalaryPaymentModePickerOpen] = useState(false);

  const [attendanceCoverForId, setAttendanceCoverForId] = useState<string | undefined>(undefined);
  const [attendanceCoverPickerOpen, setAttendanceCoverPickerOpen] = useState(false);

  const [absentFlowOpen, setAbsentFlowOpen] = useState(false);
  const [absentReplacementId, setAbsentReplacementId] = useState<string | undefined>(undefined);
  const [absentReplacementName, setAbsentReplacementName] = useState<string | undefined>(undefined);
  const [absentReplTransfer, setAbsentReplTransfer] = useState(true);
  const [absentReplPickerOpen, setAbsentReplPickerOpen] = useState(false);

  const sectionCard = scheme === 'dark' ? styles.sectionCardDark : styles.sectionCardLight;
  const textMain = scheme === 'dark' ? styles.textOnDark : styles.textOnLight;
  const textSub = scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight;

  /** Salary breakpoints: mobile under 640px, tablet 640–1023, desktop 1024+ */
  const layoutMobile = width < 640;
  const layoutTablet = width >= 640 && width < 1024;
  const layoutDesktop = width >= 1024;
  const salaryTwoColumn = layoutDesktop;
  const isNarrow = width < 900;

  const allBoysList = useMemo(() => allBoys.data?.items ?? [], [allBoys.data?.items]);

  useEffect(() => {
    if (!['attendance', 'salary', 'overview', 'history'].includes(tab)) return;
    // Keep key salary/attendance/overview views in sync with changes from other actors (e.g. delivery boy app, another admin).
    // Narrow deps to `tab`: the full `boy`/`allBoys` query objects are new references every render,
    // so including them would tear down and restart this interval on every render.
    const t = setInterval(() => {
      boy.refetch();
      allBoys.refetch();
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const monthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const lastMonthKey = useMemo(() => {
    const m = monthKey.match(/^(\d{4})-(\d{2})$/);
    if (!m) return monthKey;
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const d = new Date(yyyy, mm - 1, 1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [monthKey]);

  useEffect(() => {
    // Default salary month: current calendar month, but not before joining month.
    const parseMonthKey = (v: unknown): string => {
      if (typeof v !== 'string') return '';
      const s = v.trim();
      // ISO: yyyy-mm-dd or yyyy-mm
      const iso = s.match(/^(\d{4})-(\d{2})/);
      if (iso) return `${iso[1]}-${iso[2]}`;
      // DD/MM/YYYY
      const ddmmyyyy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}`;
      return '';
    };

    const monthIndex = (yyyyMm: string) => {
      const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
      if (!m) return Number.NEGATIVE_INFINITY;
      return Number(m[1]) * 12 + (Number(m[2]) - 1);
    };

    const joinMonth = parseMonthKey(b?.joiningDate);
    const desired = joinMonth && monthIndex(monthKey) < monthIndex(joinMonth) ? joinMonth : monthKey;
    setSalaryMonth((cur) => (cur ? cur : desired));
  }, [b?.joiningDate, monthKey]);

  /** Same inputs as Salary tab + stored row so Profile, History, and payroll stay aligned (MEMORY.md contract-first). */
  function computePayrollForMonthWithHistoryRow(forMonthKey: string, histRow: ReturnType<typeof getSalaryRecordForMonth>) {
    const h = histRow ?? getSalaryRecordForMonth(b as any, forMonthKey);
    const bonus = Math.max(0, roundMoney2(Number((h as any)?.bonusAmount ?? 0)));
    const ded = Math.max(0, roundMoney2(Number((h as any)?.deductionAmount ?? 0)));
    const prev =
      h && (h as any).previousBalance !== undefined
        ? roundMoney2(Number((h as any).previousBalance ?? 0))
        : h && (h as any).previousPendingSalary !== undefined
          ? roundMoney2(Number((h as any).previousPendingSalary ?? 0)) - roundMoney2(Number((h as any).previousOverpayment ?? 0))
          : getAutoPreviousBalance(b as any, forMonthKey);
    const foRaw = (h as any)?.finalSalaryOverride;
    const finalSalaryOverride =
      foRaw !== undefined && foRaw !== null && Number.isFinite(Number(foRaw))
        ? roundMoney2(Number(foRaw))
        : undefined;
    return computeUnifiedMonthlyPayroll(b as any, forMonthKey, {
      bonusAmount: bonus,
      deductionAmount: ded,
      previousBalance: prev,
      finalSalaryOverride,
      allBoys: allBoysList as any,
    });
  }

  function computeDerived(forMonthKey: string) {
    const hist = getSalaryRecordForMonth(b as any, forMonthKey);
    const u = computePayrollForMonthWithHistoryRow(forMonthKey, hist);
    return {
      perDay: u.perDay,
      presentDays: u.presentDays,
      attendanceDays: u.attendanceDays,
      paidLeaveDays: u.paidLeaveDays,
      unpaidLeaveDays: u.unpaidLeaveDays,
      leaveDays: u.paidLeaveDays + u.unpaidLeaveDays,
      replacementDays: u.replacementDays,
      replacementChargeableDays: u.replacementChargeableDays,
      weeklyOffDays: u.weeklyOffDays,
      halfDays: u.halfDays,
      workingDays: Math.max(0, u.presentDays + u.routeCoverageCreditedDays),
      salaryEligibleDays: u.salaryEligibleDays,
      leaveDeduction: u.unpaidLeaveDeduction,
      replacementSalary: u.routeCoverageCreditSalary,
      replacementDeduction: u.replacementDeduction,
      finalSalary: u.finalSalary,
      finalBase: u.finalBase,
      salaryType: u.salaryType,
      extraRouteEarnings: u.extraRouteEarningsFromAttendance,
    };
  }

  const derivedCurrent = useMemo(() => computeDerived(monthKey), [allBoysList, b, monthKey]);
  const derivedLast = useMemo(() => computeDerived(lastMonthKey), [allBoysList, b, lastMonthKey]);

  const profileAssignedRoutes = useMemo(() => {
    const r = (b?.assignedRoutes ?? []).map((x) => String(x ?? '').trim()).filter(Boolean);
    return r.length ? r.join(', ') : '—';
  }, [b?.assignedRoutes]);

  const overviewStackGap = layoutMobile ? 12 : layoutTablet ? 14 : 18;
  const overviewNarrowPhone = width < 480;

  const onProfileStatusPress = useCallback(
    async (next: 'Active' | 'Inactive') => {
      if (!b || b.status === next || update.isPending) return;
      await update.mutateAsync({ id: b.id, data: { status: next } });
    },
    [b, update],
  );

  const salaryMonthOptions = useMemo(() => {
    // Visible window: current calendar month back through six month-steps, floored at joining month
    // (if joined within that window, only from join month). Used for Salary, Attendance, History memos,
    // and Profile update history month pickers.
    const parseMonthKey = (v: unknown): string => {
      if (typeof v !== 'string') return '';
      const s = v.trim();
      const iso = s.match(/^(\d{4})-(\d{2})/);
      if (iso) return `${iso[1]}-${iso[2]}`;
      const ddmmyyyy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}`;
      return '';
    };

    const monthIndex = (yyyyMm: string) => {
      const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
      if (!m) return Number.NEGATIVE_INFINITY;
      return Number(m[1]) * 12 + (Number(m[2]) - 1);
    };

    const joinMonth = parseMonthKey(b?.joiningDate);
    const lowerBound = shiftMonth(monthKey, -6);
    const minMonth = joinMonth && monthIndex(joinMonth) > monthIndex(lowerBound) ? joinMonth : lowerBound;

    const out: string[] = [];
    let cursor = monthKey;
    while (monthIndex(cursor) >= monthIndex(minMonth)) {
      out.push(cursor);
      const next = shiftMonth(cursor, -1);
      if (next === cursor) break;
      cursor = next;
    }
    return out;
  }, [b?.joiningDate, monthKey]);

  useEffect(() => {
    // If current selection falls outside the allowed month list, snap to the newest allowed month.
    if (!salaryMonthOptions.length) return;
    if (!salaryMonth || !salaryMonthOptions.includes(salaryMonth)) {
      setSalaryMonth(salaryMonthOptions[0]);
    }
  }, [salaryMonth, salaryMonthOptions]);

  const [historySalaryMemoMonth, setHistorySalaryMemoMonth] = useState<string>(monthKey);
  const [historySalaryMemoMonthPickerOpen, setHistorySalaryMemoMonthPickerOpen] = useState(false);

  useEffect(() => {
    if (!salaryMonthOptions.length) return;
    if (!salaryMonthOptions.includes(historySalaryMemoMonth)) {
      setHistorySalaryMemoMonth(salaryMonthOptions[0] ?? monthKey);
    }
  }, [salaryMonthOptions, historySalaryMemoMonth, monthKey]);

  const historySalaryOldestAllowedMonth = useMemo(
    () => salaryMonthOptions[salaryMonthOptions.length - 1] ?? monthKey,
    [salaryMonthOptions, monthKey],
  );
  const isHistorySalaryMemoNextDisabled = useMemo(() => historySalaryMemoMonth >= monthKey, [historySalaryMemoMonth, monthKey]);
  const isHistorySalaryMemoPrevDisabled = useMemo(
    () => historySalaryMemoMonth <= historySalaryOldestAllowedMonth,
    [historySalaryMemoMonth, historySalaryOldestAllowedMonth],
  );

  const isSalaryMonthNavNextDisabled = useMemo(
    () => !salaryMonth || salaryMonth >= monthKey,
    [salaryMonth, monthKey],
  );
  const isSalaryMonthNavPrevDisabled = useMemo(
    () => !salaryMonth || salaryMonth <= historySalaryOldestAllowedMonth,
    [salaryMonth, historySalaryOldestAllowedMonth],
  );

  const salaryHist = useMemo(() => {
    return (b?.salaryHistory ?? []).find((x) => x.salaryMonth === salaryMonth) ?? null;
  }, [b, salaryMonth]);


  const [salaryBonus, setSalaryBonus] = useState('0');
  const [salaryDeduction, setSalaryDeduction] = useState('0');
  const [salaryPrevPending, setSalaryPrevPending] = useState('0');
  const [salaryFinalOverride, setSalaryFinalOverride] = useState('');
  const salaryIncentive = useMemo(() => String(Math.max(0, Math.round(Number(salaryHist?.incentiveAmount ?? b?.incentiveAmount ?? 0)))), [b?.incentiveAmount, salaryHist?.incentiveAmount]);

  const [salaryPayMode, setSalaryPayMode] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Card'>('UPI');
  const [salaryPayingNow, setSalaryPayingNow] = useState('0');
  const [salaryPayDate, setSalaryPayDate] = useState('');

  const [advancePayMode, setAdvancePayMode] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Card'>('UPI');
  const [advancePayingNow, setAdvancePayingNow] = useState('0');
  const [advancePayDate, setAdvancePayDate] = useState('');
  const [advancePurpose, setAdvancePurpose] = useState('');

  const [historyKind, setHistoryKind] = useState<'salary' | 'attendance' | 'profile'>('salary');

  useEffect(() => {
    // Keep payment form in sync when month changes or record updates.
    const bonus = Number(salaryHist?.bonusAmount ?? 0);
    const ded = Number(salaryHist?.deductionAmount ?? 0);
    const prev =
      (salaryHist as any)?.previousBalance !== undefined
        ? Number((salaryHist as any)?.previousBalance ?? 0)
        : salaryHist?.previousPendingSalary !== undefined
          ? Number(salaryHist?.previousPendingSalary ?? 0) - Number((salaryHist as any)?.previousOverpayment ?? 0)
          : getAutoPreviousBalance(b as any, salaryMonth);
    const dateIso = salaryHist?.paymentDate;
    const foRaw = (salaryHist as any)?.finalSalaryOverride;
    const overrideStr =
      foRaw !== undefined && foRaw !== null && Number.isFinite(Number(foRaw))
        ? String(Math.round(Number(foRaw)))
        : '';

    setSalaryBonus(String(Math.max(0, Math.round(bonus))));
    setSalaryDeduction(String(Math.max(0, Math.round(ded))));
    setSalaryPrevPending(String(Math.round(prev)));
    setSalaryFinalOverride(overrideStr);
    setSalaryPayMode((salaryHist?.paymentMode as any) ?? 'UPI');
    setSalaryPayDate(dateIso ? isoToDdMmYyyy(dateIso) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salaryMonth, salaryHist?.id]);

  const historySalaryMemoPayroll = useMemo(() => {
    if (!b) return null;
    const h = getSalaryRecordForMonth(b as any, historySalaryMemoMonth);
    return computePayrollForMonthWithHistoryRow(historySalaryMemoMonth, h);
  }, [allBoysList, b, historySalaryMemoMonth]);

  const historySalaryMemoHistRow = useMemo(
    () => (b ? getSalaryRecordForMonth(b as any, historySalaryMemoMonth) : null),
    [b, historySalaryMemoMonth],
  );

  const historySalaryMemoDayLines = useMemo(
    () => (b ? salaryMemoLinesForMonth(b as any, historySalaryMemoMonth, allBoysList as any) : []),
    [allBoysList, b, historySalaryMemoMonth],
  );

  const salaryMonthlyCalc = useMemo(() => {
    const prevOver = Number((salaryHist as any)?.previousOverpayment ?? 0);
    return computeUnifiedMonthlyPayroll(b as any, salaryMonth, {
      bonusAmount: Math.max(0, roundMoney2(Number(salaryBonus || 0))),
      deductionAmount: Math.max(0, roundMoney2(Number(salaryDeduction || 0))),
      previousBalance: roundMoney2(Number(salaryPrevPending || 0)),
      finalSalaryOverride: salaryFinalOverride.trim() ? roundMoney2(Number(salaryFinalOverride || 0)) : undefined,
      allBoys: allBoysList as any,
    });
  }, [
    allBoysList,
    b,
    salaryBonus,
    salaryDeduction,
    salaryFinalOverride,
    salaryHist,
    salaryMonth,
    salaryPrevPending,
  ]);

  const paymentCalc = useMemo(() => {
    const earnedFinal = roundMoney2(salaryMonthlyCalc.finalSalary);
    const advanceTotal = totalAdvanceSalaryForMonthRecord(salaryHist as any);
    const netSettlementDue = finalSalarySettlementNetDue(earnedFinal, advanceTotal);
    const alreadyPaidFinal = Math.max(0, roundMoney2(Number(salaryHist?.paidAmount ?? 0)));
    const payingNow = Math.max(0, roundMoney2(Number(salaryPayingNow || 0)));

    const autoBefore = computeAutoFinalSalaryPaymentStatus(earnedFinal, advanceTotal, alreadyPaidFinal);
    const totalPaidAfter = Math.max(0, roundMoney2(alreadyPaidFinal + payingNow));
    const autoAfter = computeAutoFinalSalaryPaymentStatus(earnedFinal, advanceTotal, totalPaidAfter);

    const statusCurrent = resolveDisplayedFinalSalaryPaymentStatus(salaryHist as any, autoBefore.status);
    const statusAfter = resolveDisplayedFinalSalaryPaymentStatus(salaryHist as any, autoAfter.status);

    return {
      earnedFinal,
      advanceTotal,
      netSettlementDue,
      finalSalary: earnedFinal,
      alreadyPaid: alreadyPaidFinal,
      payingNow,
      remainingBefore: autoBefore.pendingAmount,
      totalPaidAfter,
      remainingAfter: autoAfter.pendingAmount,
      autoStatusBefore: autoBefore.status,
      autoStatusAfter: autoAfter.status,
      statusCurrent,
      statusAfter,
    };
  }, [
    salaryHist,
    salaryMonthlyCalc.finalSalary,
    salaryPayingNow,
  ]);

  const salaryPaymentUiTint = useMemo(
    () => salaryUiStatusColors(paymentStatusUi(paymentCalc.statusCurrent)),
    [paymentCalc.statusCurrent],
  );

  const salarySimpleFormula = useMemo(() => {
    const pd = salaryMonthlyCalc.perDaySalary;
    const pr = salaryMonthlyCalc.presentDays;
    const cd = salaryMonthlyCalc.routeCoverageCreditedDays;
    const pe = roundMoney2(pd * pr);
    const ce = roundMoney2(pd * cd);
    const pending = roundMoney2(Number(salaryPrevPending || 0));
    const over = 0;
    const bonus = Math.max(0, roundMoney2(Number(salaryBonus || 0)));
    const ded = Math.max(0, roundMoney2(Number(salaryDeduction || 0)));
    const simple = roundMoney2(pe + ce + pending + bonus - ded - over);
    return { pd, pr, cd, pe, ce, pending, over, bonus, ded, simple };
  }, [salaryBonus, salaryDeduction, salaryHist, salaryMonthlyCalc, salaryPrevPending]);

  useEffect(() => {
    // Auto-populate Amount Paying Now (default: pay full remaining).
    setSalaryPayingNow((cur) => {
      const trimmed = String(cur ?? '').trim();
      if (trimmed && trimmed !== '0') return cur;
      // If net final settlement is negative (advance > earned), don't allow paying final salary.
      if (paymentCalc.netSettlementDue <= 0) return '0';
      return paymentCalc.remainingBefore > 0 ? String(roundMoney2(paymentCalc.remainingBefore)) : '0';
    });
  }, [paymentCalc.netSettlementDue, paymentCalc.remainingBefore, salaryMonth]);

  useEffect(() => {
    // Auto-populate Payment Date when there's something payable.
    setSalaryPayDate((cur) => {
      const trimmed = String(cur ?? '').trim();
      if (trimmed) return cur;
      if (paymentCalc.netSettlementDue <= 0) return '';
      if (paymentCalc.remainingBefore <= 0) return '';
      return isoToDdMmYyyy(new Date().toISOString().slice(0, 10));
    });
  }, [paymentCalc.netSettlementDue, paymentCalc.remainingBefore, salaryMonth]);

  const advancePaymentsThisMonth = useMemo(() => {
    const entries = [...(((salaryHist as any)?.advanceSalaryEntries ?? []) as any[])];
    entries.sort((a, x) => String(x?.date ?? '').localeCompare(String(a?.date ?? '')));
    const total = entries.reduce((sum, e) => roundMoney2(sum + Number(e?.amount ?? 0)), 0);
    return { entries, total };
  }, [salaryHist]);

  const [finalPayStatusSourceUi, setFinalPayStatusSourceUi] = useState<'Auto' | 'Manual'>('Auto');
  const [finalPayStatusManualUi, setFinalPayStatusManualUi] = useState<'Paid' | 'Partial' | 'Unpaid'>('Unpaid');

  useEffect(() => {
    const src = (salaryHist as any)?.paymentStatusSource === 'Manual' ? 'Manual' : 'Auto';
    setFinalPayStatusSourceUi(src);
    const m = (salaryHist as any)?.manualPaymentStatus;
    if (m === 'Paid' || m === 'Partial' || m === 'Unpaid') setFinalPayStatusManualUi(m);
  }, [salaryMonth, salaryHist?.id]);

  async function paySalary() {
    if (!b) return;
    const nowIso = new Date().toISOString();
    const payIso = ddMmYyyyToIso(salaryPayDate) ?? (paymentCalc.payingNow > 0 ? nowIso.slice(0, 10) : undefined);
    const paidNow = Math.max(0, roundMoney2(paymentCalc.payingNow));
    // Block final salary payment when net settlement is not positive or nothing is pending.
    if (paymentCalc.netSettlementDue <= 0) return;
    if (paymentCalc.remainingBefore <= 0) return;
    if (paidNow <= 0) return;

    const existing = (b.salaryHistory ?? []).find((x) => x.salaryMonth === salaryMonth) ?? null;
    const nextHistory = (b.salaryHistory ?? []).filter((x) => x.salaryMonth !== salaryMonth);

    const earnedFinal = roundMoney2(salaryMonthlyCalc.finalSalary);
    const advanceTotal = totalAdvanceSalaryForMonthRecord(existing as any);
    const nextPaidTotal = Math.max(0, roundMoney2(paymentCalc.totalPaidAfter));
    const nextPending = computeFinalSalarySettlementPending(earnedFinal, advanceTotal, nextPaidTotal);
    const autoAfter = computeAutoFinalSalaryPaymentStatus(earnedFinal, advanceTotal, nextPaidTotal);
    const nextStatus =
      (existing as any)?.paymentStatusSource === 'Manual' && (existing as any)?.manualPaymentStatus
        ? (existing as any).manualPaymentStatus
        : autoAfter.status;

    const prevPayments = (((existing as any)?.payments ?? []) as any[]).filter((p) => p?.kind !== 'Advance');
    const nextPayments = [...prevPayments];
    nextPayments.unshift({
      id: `pay_${salaryMonth}_${Date.now().toString(16)}`,
      date: payIso ?? nowIso.slice(0, 10),
      amountPaid: paidNow,
      kind: 'Salary',
      paymentMode: salaryPayMode as any,
      remainingPendingAmount: nextPending,
      status: autoAfter.status as any,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const prevAdv = ((existing as any)?.advanceSalaryEntries ?? []) as any[];

    nextHistory.unshift({
      id: existing?.id ?? `sal_${salaryMonth}_${Date.now().toString(16)}`,
      salaryMonth,
      salaryType: b.salaryType,
      baseSalary: b.monthlySalary ?? 0,
      incentiveAmount: Number(salaryIncentive || 0),
      bonusAmount: Number(salaryBonus || 0),
      deductionAmount: Number(salaryDeduction || 0),
      previousPendingSalary: roundMoney2(Number(salaryPrevPending || 0)),
      finalSalaryOverride: salaryFinalOverride.trim()
        ? roundMoney2(Number(salaryFinalOverride))
        : undefined,
      leaveDeduction: salaryMonthlyCalc.unpaidLeaveDeduction,
      finalSalary: salaryMonthlyCalc.finalSalary,
      advanceSalaryEntries: prevAdv,
      advanceTaken: roundMoney2(advanceTotal),
      paidAmount: nextPaidTotal,
      pendingAmount: nextPending,
      paymentDate: payIso,
      paymentMode: salaryPayMode as any,
      paymentStatus: nextStatus as any,
      paymentStatusSource: (existing as any)?.paymentStatusSource === 'Manual' ? 'Manual' : 'Auto',
      manualPaymentStatus:
        (existing as any)?.paymentStatusSource === 'Manual' ? (existing as any)?.manualPaymentStatus : undefined,
      payments: nextPayments,
      totalWorkingDays: Math.max(0, salaryMonthlyCalc.presentDays + salaryMonthlyCalc.routeCoverageCreditedDays),
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    });

    await savePatch({
      salaryHistory: nextHistory,
      pendingSalaryAmount: nextPending,
      salaryPaidStatus: nextStatus,
      salaryPaidDate: payIso,
    });

    setSalaryPayingNow(nextPending > 0 ? String(roundMoney2(nextPending)) : '0');
  }

  async function payAdvanceSalary() {
    if (!b) return;
    const nowIso = new Date().toISOString();
    const payIso = ddMmYyyyToIso(advancePayDate) ?? (Number(advancePayingNow || 0) > 0 ? nowIso.slice(0, 10) : undefined);
    const paidNow = Math.max(0, roundMoney2(Number(advancePayingNow || 0)));
    if (paidNow <= 0) return;

    const validated = DeliveryBoyAdvanceSalaryEntrySchema.safeParse({
      date: payIso ?? nowIso.slice(0, 10),
      amount: paidNow,
      paymentMode: advancePayMode,
      purpose: advancePurpose.trim() ? advancePurpose.trim() : undefined,
    });
    if (!validated.success) return;

    const existing = (b.salaryHistory ?? []).find((x) => x.salaryMonth === salaryMonth) ?? null;
    const nextHistory = (b.salaryHistory ?? []).filter((x) => x.salaryMonth !== salaryMonth);

    const earnedFinal = roundMoney2(salaryMonthlyCalc.finalSalary);
    const prevAdv = ((existing as any)?.advanceSalaryEntries ?? []) as any[];
    const newEntry = {
      id: `adv_${salaryMonth}_${Date.now().toString(16)}`,
      createdAt: nowIso,
      updatedAt: nowIso,
      date: validated.data.date,
      amount: validated.data.amount,
      paymentMode: validated.data.paymentMode,
      transactionId: undefined,
      purpose: validated.data.purpose,
    };
    const nextAdv = [newEntry, ...prevAdv];
    const advanceTotal = nextAdv.reduce((s, e) => roundMoney2(s + Number(e.amount ?? 0)), 0);
    const paidFinal = Math.max(0, roundMoney2(Number(existing?.paidAmount ?? 0)));
    const nextPending = computeFinalSalarySettlementPending(earnedFinal, advanceTotal, paidFinal);
    const autoSt = computeAutoFinalSalaryPaymentStatus(earnedFinal, advanceTotal, paidFinal);
    const nextStatus =
      (existing as any)?.paymentStatusSource === 'Manual' && (existing as any)?.manualPaymentStatus
        ? (existing as any).manualPaymentStatus
        : autoSt.status;

    const prevPayments = (((existing as any)?.payments ?? []) as any[]).filter((p) => p?.kind !== 'Advance');

    nextHistory.unshift({
      id: existing?.id ?? `sal_${salaryMonth}_${Date.now().toString(16)}`,
      salaryMonth,
      salaryType: b.salaryType,
      baseSalary: b.monthlySalary ?? 0,
      incentiveAmount: Number(salaryIncentive || 0),
      bonusAmount: Number(salaryBonus || 0),
      deductionAmount: Number(salaryDeduction || 0),
      previousPendingSalary: roundMoney2(Number(salaryPrevPending || 0)),
      finalSalaryOverride: salaryFinalOverride.trim() ? roundMoney2(Number(salaryFinalOverride)) : undefined,
      leaveDeduction: salaryMonthlyCalc.unpaidLeaveDeduction,
      finalSalary: salaryMonthlyCalc.finalSalary,
      advanceSalaryEntries: nextAdv,
      advanceTaken: advanceTotal,
      paidAmount: paidFinal,
      pendingAmount: nextPending,
      paymentDate: existing?.paymentDate,
      paymentMode: existing?.paymentMode,
      paymentStatus: nextStatus as any,
      paymentStatusSource: (existing as any)?.paymentStatusSource === 'Manual' ? 'Manual' : 'Auto',
      manualPaymentStatus:
        (existing as any)?.paymentStatusSource === 'Manual' ? (existing as any)?.manualPaymentStatus : undefined,
      payments: prevPayments,
      totalWorkingDays: Math.max(0, salaryMonthlyCalc.presentDays + salaryMonthlyCalc.routeCoverageCreditedDays),
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    });

    await savePatch({
      salaryHistory: nextHistory,
      pendingSalaryAmount: nextPending,
      salaryPaidStatus: nextStatus,
      salaryPaidDate: existing?.paymentDate ? String(existing.paymentDate).slice(0, 10) : undefined,
    });

    setAdvancePayingNow('0');
    setAdvancePayDate('');
    setAdvancePurpose('');
  }

  async function saveFinalSalaryPaymentStatusPrefs(source: 'Auto' | 'Manual', manual?: 'Paid' | 'Partial' | 'Unpaid') {
    if (!b) return;
    const nowIso = new Date().toISOString();
    const existing = (b.salaryHistory ?? []).find((x) => x.salaryMonth === salaryMonth) ?? null;
    const earnedFinal = roundMoney2(salaryMonthlyCalc.finalSalary);
    const advanceTotal = totalAdvanceSalaryForMonthRecord(existing as any);
    const paidFinal = Math.max(0, roundMoney2(Number(existing?.paidAmount ?? 0)));
    const nextPending = computeFinalSalarySettlementPending(earnedFinal, advanceTotal, paidFinal);
    const autoSt = computeAutoFinalSalaryPaymentStatus(earnedFinal, advanceTotal, paidFinal);
    const manualPick = manual ?? finalPayStatusManualUi;
    const nextStatus = source === 'Manual' ? manualPick : autoSt.status;

    const nextHistory = (b.salaryHistory ?? []).filter((x) => x.salaryMonth !== salaryMonth);
    nextHistory.unshift({
      id: existing?.id ?? `sal_${salaryMonth}_${Date.now().toString(16)}`,
      salaryMonth,
      salaryType: b.salaryType,
      baseSalary: b.monthlySalary ?? 0,
      incentiveAmount: Number(salaryIncentive || 0),
      bonusAmount: Number(salaryBonus || 0),
      deductionAmount: Number(salaryDeduction || 0),
      previousPendingSalary: roundMoney2(Number(salaryPrevPending || 0)),
      finalSalaryOverride: salaryFinalOverride.trim() ? roundMoney2(Number(salaryFinalOverride)) : undefined,
      leaveDeduction: salaryMonthlyCalc.unpaidLeaveDeduction,
      finalSalary: salaryMonthlyCalc.finalSalary,
      advanceSalaryEntries: ((existing as any)?.advanceSalaryEntries ?? []) as any[],
      advanceTaken: advanceTotal,
      paidAmount: paidFinal,
      pendingAmount: nextPending,
      paymentDate: existing?.paymentDate,
      paymentMode: existing?.paymentMode,
      paymentStatus: nextStatus as any,
      paymentStatusSource: source,
      manualPaymentStatus: source === 'Manual' ? manualPick : undefined,
      payments: (((existing as any)?.payments ?? []) as any[]).filter((p) => p?.kind !== 'Advance'),
      totalWorkingDays: Math.max(0, salaryMonthlyCalc.presentDays + salaryMonthlyCalc.routeCoverageCreditedDays),
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    });

    await savePatch({
      salaryHistory: nextHistory,
      pendingSalaryAmount: nextPending,
      salaryPaidStatus: nextStatus,
      salaryPaidDate: existing?.paymentDate ? String(existing.paymentDate).slice(0, 10) : undefined,
    });
  }

  function salaryStatusTone(status: string) {
    if (status === 'Paid') return { bg: 'rgba(34,197,94,0.14)', fg: '#166534', border: 'rgba(34,197,94,0.22)' };
    if (status === 'Partial') return { bg: 'rgba(245,158,11,0.14)', fg: '#92400E', border: 'rgba(245,158,11,0.22)' };
    if (status === 'Unpaid') return { bg: 'rgba(239,68,68,0.14)', fg: '#B91C1C', border: 'rgba(239,68,68,0.22)' };
    return { bg: 'rgba(148,163,184,0.16)', fg: '#475569', border: 'rgba(148,163,184,0.22)' };
  }

  const [attendanceMonth, setAttendanceMonth] = useState<string>(monthKey);
  const [historyMemoMonth, setHistoryMemoMonth] = useState<string>(monthKey);
  const [historyMemoMonthPickerOpen, setHistoryMemoMonthPickerOpen] = useState(false);
  const [profileHistoryMonth, setProfileHistoryMonth] = useState<string>(monthKey);
  const [profileHistoryMonthPickerOpen, setProfileHistoryMonthPickerOpen] = useState(false);

  function shiftMonth(yyyyMm: string, deltaMonths: number): string {
    const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
    if (!m) return yyyyMm;
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const d = new Date(yyyy, mm - 1, 1);
    d.setMonth(d.getMonth() + deltaMonths);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  const isAttendanceNextDisabled = useMemo(() => attendanceMonth >= monthKey, [attendanceMonth, monthKey]);
  const isAttendancePrevDisabled = useMemo(
    () => attendanceMonth <= historySalaryOldestAllowedMonth,
    [attendanceMonth, historySalaryOldestAllowedMonth],
  );

  const isHistoryMemoNextDisabled = useMemo(() => historyMemoMonth >= monthKey, [historyMemoMonth, monthKey]);
  const isHistoryMemoPrevDisabled = useMemo(
    () => historyMemoMonth <= historySalaryOldestAllowedMonth,
    [historyMemoMonth, historySalaryOldestAllowedMonth],
  );

  const isProfileHistoryMonthNextDisabled = useMemo(() => profileHistoryMonth >= monthKey, [profileHistoryMonth, monthKey]);
  const isProfileHistoryMonthPrevDisabled = useMemo(
    () => profileHistoryMonth <= historySalaryOldestAllowedMonth,
    [profileHistoryMonth, historySalaryOldestAllowedMonth],
  );

  useEffect(() => {
    if (!salaryMonthOptions.length) return;
    if (!salaryMonthOptions.includes(attendanceMonth)) {
      setAttendanceMonth(salaryMonthOptions[0] ?? monthKey);
      setAttendanceSelected(null);
    }
  }, [salaryMonthOptions, attendanceMonth, monthKey]);

  useEffect(() => {
    if (!salaryMonthOptions.length) return;
    if (!salaryMonthOptions.includes(historyMemoMonth)) {
      setHistoryMemoMonth(salaryMonthOptions[0] ?? monthKey);
    }
  }, [salaryMonthOptions, historyMemoMonth, monthKey]);

  useEffect(() => {
    if (!salaryMonthOptions.length) return;
    if (!salaryMonthOptions.includes(profileHistoryMonth)) {
      setProfileHistoryMonth(salaryMonthOptions[0] ?? monthKey);
    }
  }, [salaryMonthOptions, profileHistoryMonth, monthKey]);

  function yyyymmdd(yyyyMm: string, day: number): string {
    return `${yyyyMm}-${String(day).padStart(2, '0')}`;
  }

  function timeLabelFromIso(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayEntry = useMemo(() => (b?.attendance ?? []).find((x) => String(x.date).slice(0, 10) === todayIso) ?? null, [b, todayIso]);

  const attendanceSelectedEntry = useMemo(() => {
    const iso = attendanceSelected?.dateIso ?? '';
    if (!iso) return null;
    return (b?.attendance ?? []).find((x) => String(x.date).slice(0, 10) === iso) ?? null;
  }, [attendanceSelected?.dateIso, b]);

  const absentCoverForSelectedDate = useMemo(() => {
    const d = String(attendanceSelected?.dateIso ?? '').slice(0, 10);
    if (!b || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    const repl =
      (b.replacements ?? []).find((r) => String((r as any)?.linkedAttendanceDate ?? '').slice(0, 10) === d) ?? null;
    const leave = (b.leaves ?? []).find((L) => String((L as any)?.linkedAttendanceDate ?? '').slice(0, 10) === d) ?? null;
    const id = (repl as any)?.replacedByDeliveryBoyId ?? (leave as any)?.replacementDeliveryBoyId;
    const name = (repl as any)?.replacedByDeliveryBoyName ?? (leave as any)?.replacementDeliveryBoyName;
    if (!id && !name) return null;
    return { id: typeof id === 'string' ? id : undefined, name: typeof name === 'string' ? name : undefined };
  }, [attendanceSelected?.dateIso, b]);

  useEffect(() => {
    if (!absentFlowOpen || !b || !attendanceSelected?.dateIso) return;
    const d = attendanceSelected.dateIso.slice(0, 10);
    const lid = autoLeaveIdForAttendanceDate(d);
    const ex = (b.leaves ?? []).find((x) => x.id === lid);
    if (ex) {
      setAbsentReplacementId(ex.replacementDeliveryBoyId);
      setAbsentReplacementName(ex.replacementDeliveryBoyName);
      const rex = (b.replacements ?? []).find((x) => x.id === autoReplacementIdForAttendanceDate(d));
      setAbsentReplTransfer(rex ? rex.transferSalaryToReplacer !== false : true);
    } else {
      setAbsentReplacementId(undefined);
      setAbsentReplacementName(undefined);
      setAbsentReplTransfer(true);
    }
  }, [absentFlowOpen, attendanceSelected?.dateIso, b, b?.leaves, b?.replacements]);

  function monthAttendanceEntries(yyyyMm: string) {
    const inMonth = (iso: string | undefined) => typeof iso === 'string' && iso.slice(0, 7) === yyyyMm;
    return (b?.attendance ?? []).filter((x) => inMonth(x.date));
  }

  const attendanceMemoSorted = useMemo(() => {
    const rows = monthAttendanceEntries(historyMemoMonth).slice();
    rows.sort((a, z) => String(z.date).localeCompare(String(a.date)));
    return rows;
  }, [b?.attendance, historyMemoMonth]);

  const profileAuditSorted = useMemo((): DeliveryBoyAuditEntry[] => {
    const rows = (b?.audit ?? []).slice();
    rows.sort((x, y) => String(y.date || y.updatedAt).localeCompare(String(x.date || x.updatedAt)));
    return rows;
  }, [b?.audit]);

  const profileAuditForHistoryMonth = useMemo((): DeliveryBoyAuditEntry[] => {
    const ym = profileHistoryMonth;
    return profileAuditSorted.filter((entry) => {
      const iso = String(entry.date || entry.updatedAt || '');
      return iso.length >= 7 && iso.slice(0, 7) === ym;
    });
  }, [profileAuditSorted, profileHistoryMonth]);

  function monthSummary(yyyyMm: string) {
    const entries = monthAttendanceEntries(yyyyMm);
    const absent = entries.filter((x) => x.attendanceStatus === 'Absent').length;
    if (!b) {
      const present = entries.filter((x) => x.attendanceStatus === 'Present').length;
      const total = Math.max(1, present + absent);
      const pct = Math.round((present / total) * 100);
      return { present, absent, pct, eligibleDays: present };
    }
    const u = computeUnifiedMonthlyPayroll(b as any, yyyyMm, { allBoys: allBoysList as any });
    const present = u.presentDays;
    const total = Math.max(1, present + absent);
    const pct = Math.round((present / total) * 100);
    return { present, absent, pct, eligibleDays: u.salaryEligibleDays };
  }

  function monthLabel(yyyyMm: string): string {
    const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
    if (!m) return yyyyMm;
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const d = new Date(yyyy, mm - 1, 1);
    return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  }

  function isoToDdMmYyyy(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }

  function isoToDdMmmYyyy(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mmm = d.toLocaleString('en-US', { month: 'short' });
    const yyyy = String(d.getFullYear());
    return `${dd} ${mmm} ${yyyy}`;
  }

  function ddMmYyyyToIso(input: string): string | undefined {
    const t = input.trim();
    if (!t) return undefined;
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return undefined;
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return undefined;
    const d = new Date(yyyy, mm - 1, dd);
    if (Number.isNaN(d.getTime())) return undefined;
    if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return undefined;
    return `${String(yyyy)}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }

  async function savePatch(patch: any) {
    if (!b) return;
    setError(null);
    try {
      await update.mutateAsync({ id: b.id, data: patch });
    } catch {
      setError('Unable to save changes. Please try again.');
    }
  }

  async function stripAutoAttendanceCredits(dateYyyyMmDd: string) {
    const d = String(dateYyyyMmDd).slice(0, 10);
    const leaveId = autoLeaveIdForAttendanceDate(d);
    const replId = autoReplacementIdForAttendanceDate(d);
    const listResp = await services.deliveryBoys.list();
    for (const item of listResp.items as any[]) {
      let nextC = [...(item.routeCoverageCredits ?? [])];
      const o = nextC.length;
      nextC = stripCreditsBySourceLeaveId(nextC, leaveId);
      nextC = stripCreditsBySourceReplacementId(nextC, replId);
      if (nextC.length !== o) {
        await update.mutateAsync({ id: item.id, data: { routeCoverageCredits: nextC } });
      }
    }
  }

  async function saveAttendanceStatusWrite(status: DeliveryBoyAdminAttendanceStatus, opts?: { closeAfterSave?: boolean }) {
    if (!b) return;
    const dateIso = attendanceSelected?.dateIso ?? '';
    if (!dateIso) return;
    const d = dateIso.slice(0, 10);
    if (status === 'Absent') {
      setAbsentFlowOpen(true);
      return;
    }
    setError(null);
    const closeAfter = opts?.closeAfterSave !== false;
    const now = new Date().toISOString();
    try {
      await stripAutoAttendanceCredits(d);
      const leaveId = autoLeaveIdForAttendanceDate(d);
      const replId = autoReplacementIdForAttendanceDate(d);
      const nextLeaves = (b.leaves ?? []).filter((x) => x.id !== leaveId);
      const nextRepl = (b.replacements ?? []).filter((x) => x.id !== replId);

      const items = [...(b.attendance ?? [])];
      const idx = items.findIndex((x) => String(x.date).slice(0, 10) === d);
      const leaverBoy = attendanceCoverForId ? allBoysList.find((x) => x.id === attendanceCoverForId) : undefined;
      const coverName = attendanceCoverForId ? leaverBoy?.fullName ?? '' : undefined;
      const coverRoute = attendanceCoverForId ? leaverBoy?.primaryRouteName ?? b.primaryRouteName : undefined;
      const prevEntry = idx >= 0 ? items[idx] : undefined;
      const coverPayload =
        status === 'Present' && attendanceCoverForId
          ? {
              coverForDeliveryBoyId: attendanceCoverForId,
              coverForDeliveryBoyName: coverName || undefined,
              routeName: coverRoute,
            }
          : {
              coverForDeliveryBoyId: undefined,
              coverForDeliveryBoyName: undefined,
              routeName: prevEntry?.routeName ?? b.primaryRouteName,
            };

      const patch = {
        attendanceStatus: status as any,
        ...coverPayload,
        adminManualOverride: true,
        routeName: coverPayload.routeName ?? b.primaryRouteName,
        updatedAt: now,
      };

      if (idx >= 0) {
        const prev = items[idx]!;
        const fromStatus = (prev as any)?.attendanceStatus as AttendanceStatus | undefined;
        const toStatus = status as AttendanceStatus;
        const history = [
          newAttendanceHistoryEntry({
            nowIso: now,
            action: 'Status Updated',
            fromStatus,
            toStatus,
          }),
          ...(((prev as any)?.history ?? []) as any[]),
        ];
        items[idx] = { ...prev, ...patch, history };
      } else {
        items.unshift({
          id: `att_${d}_${Date.now().toString(16)}`,
          date: d,
          createdAt: now,
          ...patch,
          history: [
            newAttendanceHistoryEntry({
              nowIso: now,
              action: 'Created',
              toStatus: status as AttendanceStatus,
            }),
          ],
        });
      }

      await update.mutateAsync({
        id: b.id,
        data: {
          attendance: items,
          leaves: nextLeaves,
          replacements: nextRepl,
          currentAttendanceStatus: d === todayIso ? (status as any) : b.currentAttendanceStatus,
        },
      });
      if (closeAfter) {
        setAttendanceEditOpen(false);
        setAttendanceStatusPickerOpen(false);
        setAbsentFlowOpen(false);
      }
      allBoys.refetch();
    } catch {
      setError('Unable to save attendance.');
    }
  }

  async function savePresentAndSyncLinkedLeave(opts?: { closeAfterSave?: boolean }) {
    await saveAttendanceStatusWrite('Present', opts);
  }

  async function confirmAbsentFromAttendance() {
    if (!b || !attendanceSelected?.dateIso) return;
    const dateIso = attendanceSelected.dateIso.slice(0, 10);
    const leaveId = autoLeaveIdForAttendanceDate(dateIso);
    const replId = autoReplacementIdForAttendanceDate(dateIso);
    const now = new Date().toISOString();
    setError(null);
    try {
      await stripAutoAttendanceCredits(dateIso);

      const items = [...(b.attendance ?? [])];
      const idx = items.findIndex((x) => String(x.date).slice(0, 10) === dateIso);
      const clearCover = {
        coverForDeliveryBoyId: undefined,
        coverForDeliveryBoyName: undefined,
        routeName: undefined,
      };
      if (idx >= 0) {
        const prev = items[idx]!;
        const fromStatus = (prev as any)?.attendanceStatus as AttendanceStatus | undefined;
        const history = [
          newAttendanceHistoryEntry({
            nowIso: now,
            action: 'Status Updated',
            fromStatus,
            toStatus: 'Absent',
            note: 'Marked Absent from admin attendance',
          }),
          ...(((prev as any)?.history ?? []) as any[]),
        ];
        items[idx] = { ...prev, attendanceStatus: 'Absent' as any, ...clearCover, updatedAt: now, history };
      } else {
        items.unshift({
          id: `att_${dateIso}_${Date.now().toString(16)}`,
          date: dateIso,
          attendanceStatus: 'Absent' as any,
          createdAt: now,
          updatedAt: now,
          ...clearCover,
          history: [
            newAttendanceHistoryEntry({
              nowIso: now,
              action: 'Created',
              toStatus: 'Absent',
              note: 'Marked Absent from admin attendance',
            }),
          ],
        });
      }

      const leaveRow: DeliveryBoyLeaveRequest = {
        id: leaveId,
        leaveStartDate: dateIso,
        leaveEndDate: dateIso,
        leaveType: DELIVERY_BOY_ATTENDANCE_ABSENT_LINKED_LEAVE_TYPE,
        approvalStatus: 'Approved',
        approvedBy: 'Admin',
        replacementDeliveryBoyId: absentReplacementId,
        replacementDeliveryBoyName: absentReplacementName,
        linkedAttendanceDate: dateIso,
        createdAt: (b.leaves ?? []).find((x) => x.id === leaveId)?.createdAt ?? now,
        updatedAt: now,
      };
      const nextLeaves = [leaveRow, ...(b.leaves ?? []).filter((x) => x.id !== leaveId)];

      let nextReplacements = (b.replacements ?? []).filter((x) => x.id !== replId);
      if (absentReplacementId) {
        nextReplacements = [
          {
            id: replId,
            reason: 'Absent' as ReplacementReason,
            fromDate: dateIso,
            toDate: dateIso,
            routes: [b.primaryRouteName],
            replacedByDeliveryBoyId: absentReplacementId,
            replacedByDeliveryBoyName: absentReplacementName ?? '',
            transferSalaryToReplacer: absentReplTransfer,
            notes: 'From attendance',
            linkedAttendanceDate: dateIso,
            createdAt: (b.replacements ?? []).find((x) => x.id === replId)?.createdAt ?? now,
            updatedAt: now,
          },
          ...nextReplacements,
        ];
      }

      await update.mutateAsync({
        id: b.id,
        data: {
          attendance: items,
          leaves: nextLeaves,
          replacements: nextReplacements,
          currentAttendanceStatus: dateIso === todayIso ? ('Absent' as any) : b.currentAttendanceStatus,
        },
      });

      if (absentReplacementId && absentReplTransfer) {
        const subFresh = await services.deliveryBoys.getById(absentReplacementId);
        if (subFresh) {
          const additions = buildRouteCoverageCreditsForRange({
            fromIso: dateIso,
            toIso: dateIso,
            routeName: b.primaryRouteName,
            leaverDeliveryBoyId: b.id,
            leaverDeliveryBoyName: b.fullName,
            sourceLeaveId: leaveId,
          });
          const merged = mergeRouteCoverageCreditsDedup(subFresh.routeCoverageCredits, additions);
          await update.mutateAsync({ id: absentReplacementId, data: { routeCoverageCredits: merged } });
        }
      }

      setAbsentFlowOpen(false);
      setAttendanceStatusPickerOpen(false);
      setAttendanceEditOpen(false);
      allBoys.refetch();
    } catch {
      setError('Unable to save absence.');
    }
  }

  function openAttendanceEditor(dateIso: string) {
    setAttendanceSelected({ dateIso });
    const existing = (b?.attendance ?? []).find((x) => String(x.date).slice(0, 10) === dateIso) ?? null;
    setAttendanceDraftStatus(deliveryBoyAdminAttendanceDraftFromStored(existing?.attendanceStatus));
    setAttendanceCoverForId(existing?.coverForDeliveryBoyId);
    setAttendanceEditOpen(true);
  }

  async function saveAttendanceForSelectedDate(nextStatus?: DeliveryBoyAdminAttendanceStatus, opts?: { closeAfterSave?: boolean }) {
    if (!b) return;
    const dateIso = attendanceSelected?.dateIso ?? '';
    if (!dateIso) return;
    const statusToSave = nextStatus ?? attendanceDraftStatus;
    if (statusToSave === 'Absent') {
      setAttendanceStatusPickerOpen(false);
      setAbsentFlowOpen(true);
      return;
    }
    await saveAttendanceStatusWrite(statusToSave, opts);
  }

  async function deleteAttendanceForSelectedDate() {
    if (!b) return;
    const dateIso = attendanceSelected?.dateIso ?? '';
    if (!dateIso) return;
    const d = dateIso.slice(0, 10);
    setError(null);
    try {
      await stripAutoAttendanceCredits(d);
      const leaveId = autoLeaveIdForAttendanceDate(d);
      const replId = autoReplacementIdForAttendanceDate(d);
      const now = new Date().toISOString();
      const items = (b.attendance ?? [])
        .map((x) => {
          if (String(x.date).slice(0, 10) !== d) return x;
          const fromStatus = (x as any)?.attendanceStatus as AttendanceStatus | undefined;
          const history = [
            newAttendanceHistoryEntry({
              nowIso: now,
              action: 'Deleted',
              fromStatus,
              note: 'Attendance row deleted by admin',
            }),
            ...(((x as any)?.history ?? []) as any[]),
          ];
          return { ...x, updatedAt: now, history };
        })
        .filter((x) => String(x.date).slice(0, 10) !== d);
      const nextLeaves = (b.leaves ?? []).filter((x) => x.id !== leaveId);
      const nextRepl = (b.replacements ?? []).filter((x) => x.id !== replId);
      await update.mutateAsync({
        id: b.id,
        data: {
          attendance: items,
          leaves: nextLeaves,
          replacements: nextRepl,
          currentAttendanceStatus: d === todayIso ? undefined : b.currentAttendanceStatus,
        },
      });
      setAttendanceEditOpen(false);
      allBoys.refetch();
    } catch {
      setError('Unable to delete attendance.');
    }
  }

  async function setMonthPaymentPaid(yyyyMm: string, paid: boolean, finalSalary: number) {
    if (!b) return;
    const nowIso = new Date().toISOString();
    const existing = (b.salaryHistory ?? []).find((x) => x.salaryMonth === yyyyMm) ?? null;
    const nextHistory = (b.salaryHistory ?? []).filter((x) => x.salaryMonth !== yyyyMm);

    const earned = roundMoney2(finalSalary);
    const adv = totalAdvanceSalaryForMonthRecord(existing as any);
    const netDue = finalSalarySettlementNetDue(earned, adv);
    const paidFinal = paid ? netDue : Math.max(0, roundMoney2(Number(existing?.paidAmount ?? 0)));
    const nextPending = computeFinalSalarySettlementPending(earned, adv, paidFinal);
    const autoSt = computeAutoFinalSalaryPaymentStatus(earned, adv, paidFinal);
    const nextStatus = (existing as any)?.paymentStatusSource === 'Manual' && (existing as any)?.manualPaymentStatus
      ? (existing as any).manualPaymentStatus
      : paid
        ? 'Paid'
        : autoSt.status;
    const paymentDate = paid ? (existing?.paymentDate ?? nowIso) : undefined;

    nextHistory.unshift({
      id: existing?.id ?? `sal_${yyyyMm}_${Date.now().toString(16)}`,
      salaryMonth: yyyyMm,
      salaryType: b.salaryType,
      baseSalary: b.monthlySalary ?? 0,
      incentiveAmount: b.incentiveAmount ?? 0,
      leaveDeduction: yyyyMm === monthKey ? derivedCurrent.leaveDeduction : derivedLast.leaveDeduction,
      finalSalary: earned,
      advanceSalaryEntries: ((existing as any)?.advanceSalaryEntries ?? []) as any[],
      advanceTaken: adv,
      paidAmount: paidFinal,
      pendingAmount: nextPending,
      paymentDate,
      paymentStatus: nextStatus as any,
      paymentStatusSource: (existing as any)?.paymentStatusSource === 'Manual' ? 'Manual' : 'Auto',
      manualPaymentStatus: (existing as any)?.manualPaymentStatus,
      payments: (((existing as any)?.payments ?? []) as any[]).filter((p) => p?.kind !== 'Advance'),
      totalWorkingDays: yyyyMm === monthKey ? derivedCurrent.workingDays : derivedLast.workingDays,
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    });

    await savePatch({
      salaryHistory: nextHistory,
      pendingSalaryAmount: nextPending,
    });
  }

  return (
    <View style={[styles.bg, scheme === 'dark' ? styles.bgDark : styles.bgLight, styles.rootClip]}>
      <View
        style={[
          styles.appBar,
          scheme === 'dark' ? styles.appBarDark : styles.appBarLight,
          layoutMobile && styles.appBarStack,
          { paddingTop: headerPaddingTop },
        ]}
      >
        {layoutMobile ? (
          <>
            <View style={styles.appBarRowMobile}>
              <View style={styles.appBarSideLeft}>
                <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
                  <MaterialCommunityIcons name="arrow-left" size={20} color={scheme === 'dark' ? 'white' : COLORS.text} />
                </Pressable>
              </View>
              <View style={styles.appBarTitleStretch}>
                {tab === 'salary' && b ? (
                  <View style={{ minWidth: 0, width: '100%' }}>
                    <Text variant="titleMedium" style={[styles.headerTitle, styles.headerTitleMobile, textMain]} numberOfLines={1}>
                      Salary
                    </Text>
                    <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                      {b.fullName}
                    </Text>
                  </View>
                ) : (
                  <Text variant="titleMedium" style={[styles.headerTitle, styles.headerTitleMobile, textMain]} numberOfLines={2}>
                    {tab === 'overview'
                      ? 'Profile Information'
                      : tab === 'attendance'
                        ? 'Attendance'
                        : tab === 'history'
                          ? 'History'
                          : 'Details'}
                  </Text>
                )}
              </View>
              <View style={styles.appBarSideRight}>
                {b ? (
                  <Button mode="outlined" compact onPress={() => router.push(`/(admin)/delivery-edit?id=${encodeURIComponent(b.id)}`)}>
                    Edit
                  </Button>
                ) : (
                  <View style={{ width: 8 }} />
                )}
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.tabsRowScrollMobileContent, styles.tabsBar]}
              keyboardShouldPersistTaps="handled"
            >
              {DETAIL_TABS.map((t) => (
                <TabPill key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} compact />
              ))}
            </ScrollView>
          </>
        ) : (
          <>
            <View style={styles.appBarSideLeft}>
              <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="arrow-left" size={20} color={scheme === 'dark' ? 'white' : COLORS.text} />
              </Pressable>
            </View>
            <View style={styles.appBarCenter}>
              {tab === 'salary' && b ? (
                <View style={{ alignItems: 'flex-start', minWidth: 0, alignSelf: 'stretch' }}>
                  <Text variant="titleMedium" style={[styles.headerTitle, textMain]} numberOfLines={1}>
                    Salary
                  </Text>
                  <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                    {b.fullName}
                  </Text>
                </View>
              ) : (
                <Text variant="titleMedium" style={[styles.headerTitle, textMain]} numberOfLines={2}>
                  {tab === 'overview'
                    ? 'Profile Information'
                    : tab === 'attendance'
                      ? 'Attendance'
                      : tab === 'history'
                        ? 'History'
                        : 'Details'}
                </Text>
              )}
            </View>
            <View style={styles.appBarSideRight}>
              {b ? (
                <Button mode="outlined" compact onPress={() => router.push(`/(admin)/delivery-edit?id=${encodeURIComponent(b.id)}`)}>
                  Edit
                </Button>
              ) : null}
            </View>
          </>
        )}
      </View>

      {!layoutMobile ? (
        <View style={[styles.tabsBar, scheme === 'dark' ? styles.tabsBarDark : styles.tabsBarLight, layoutTablet && styles.tabsBarTablet]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabsRowScroll, styles.tabsRowFlex]}>
            {DETAIL_TABS.map((t) => (
              <TabPill key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.container,
          layoutMobile && styles.containerMobile,
          layoutDesktop && styles.containerDesktop,
          { paddingBottom: scrollPaddingBottom(24) },
        ]}
      >
        {!b && boy.isPending ? (
          <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
            <Card.Content style={styles.sectionContent}>
              <Text variant="bodyMedium" style={textSub}>
                Loading…
              </Text>
            </Card.Content>
          </Card>
        ) : null}

        {!b && !boy.isPending && id ? (
          <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
            <Card.Content style={styles.sectionContent}>
              <Text variant="bodyMedium" style={textSub}>
                Delivery boy not found.
              </Text>
            </Card.Content>
          </Card>
        ) : null}

        {tab === 'overview' && b ? (
          <View style={[styles.overviewWrap, { gap: overviewStackGap }]}>
            <View style={[styles.headerCard, sectionCard]}>
              <View style={styles.headerTopRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="titleMedium" style={[styles.headerName, textMain]} numberOfLines={2}>
                    {b.fullName}
                  </Text>
                  <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                    {dashStr(b.mobileNumber)}
                  </Text>
                </View>
                <View style={[styles.badge, b.status === 'Active' ? styles.badgeActive : styles.badgeInactive]}>
                  <Text variant="labelSmall" style={b.status === 'Active' ? styles.badgeTextActive : styles.badgeTextInactive}>
                    {b.status}
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: 10 }}>
                <ProfileKvRow label="Assigned route" value={profileAssignedRoutes} labelStyle={textSub} valueStyle={textMain} compact={overviewNarrowPhone} />
                <ProfileKvRow label="Salary type" value={formatSalaryTypeUi(String(b.salaryType ?? ''))} labelStyle={textSub} valueStyle={textMain} compact={overviewNarrowPhone} />
                <ProfileKvRow
                  label="Monthly salary amount"
                  value={formatInr2(profileMonthlySalaryDisplay(b, monthKey))}
                  labelStyle={textSub}
                  valueStyle={textMain}
                  compact={overviewNarrowPhone}
                />
                <ProfileKvRow
                  label="Per day salary amount"
                  value={formatInr2(derivedCurrent.perDay)}
                  labelStyle={textSub}
                  valueStyle={textMain}
                  compact={overviewNarrowPhone}
                />
                <ProfileKvRow
                  label="Joining date"
                  value={dashStr(isoToDdMmmYyyy(b.joiningDate) || isoToDdMmYyyy(b.joiningDate) || String(b.joiningDate ?? '').trim())}
                  labelStyle={textSub}
                  valueStyle={textMain}
                  compact={overviewNarrowPhone}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Button mode="contained" compact disabled={b.status === 'Active' || update.isPending} onPress={() => void onProfileStatusPress('Active')}>
                  Mark active
                </Button>
                <Button mode="outlined" compact disabled={b.status === 'Inactive' || update.isPending} onPress={() => void onProfileStatusPress('Inactive')}>
                  Mark inactive
                </Button>
              </View>
            </View>
          </View>
        ) : null}

        {tab === 'attendance' && b ? (
          <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
            <Card.Content style={styles.sectionContent}>
              <View style={styles.calendarHeaderRow}>
                <Text variant="titleSmall" style={[styles.bold, textMain]}>
                  Attendance calendar
                </Text>
              </View>
              <Text variant="bodySmall" style={[textSub, { marginBottom: 8 }]}>
                Tap a day to view or change attendance. Today: {todayEntry?.attendanceStatus ?? '—'}.
              </Text>
              <View style={styles.monthNavRow}>
                <Pressable
                  disabled={isAttendancePrevDisabled}
                  onPress={() => setAttendanceMonth(shiftMonth(attendanceMonth, -1))}
                  style={({ pressed }) => [
                    styles.monthNavBtn,
                    isAttendancePrevDisabled ? styles.monthNavBtnDisabled : null,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialCommunityIcons name="chevron-left" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                </Pressable>
                <Pressable
                  onPress={() => setAttendanceMonthPickerOpen(true)}
                  style={({ pressed }) => [styles.monthNavCenter, pressed && styles.pressed]}
                >
                  <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                    {monthLabel(attendanceMonth)}
                  </Text>
                  <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                    {attendanceMonth}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={isAttendanceNextDisabled}
                  onPress={() => setAttendanceMonth(shiftMonth(attendanceMonth, 1))}
                  style={({ pressed }) => [
                    styles.monthNavBtn,
                    isAttendanceNextDisabled ? styles.monthNavBtnDisabled : null,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialCommunityIcons name="chevron-right" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                </Pressable>
              </View>

              {(() => {
                const s = monthSummary(attendanceMonth);
                const countCardStyle = [
                  styles.topStatCard,
                  scheme === 'dark' ? styles.topStatCardDark : styles.topStatCardLight,
                  layoutDesktop ? styles.topStatCardTablet : layoutTablet ? styles.topStatCardTablet : styles.topStatCardHalfMobile,
                  layoutMobile ? styles.topStatCardPadMobile : null,
                ];
                return (
                  <View style={{ width: '100%', marginBottom: 12 }}>
                    <Text variant="titleSmall" style={[styles.bold, textMain, { marginBottom: 8 }]} numberOfLines={1}>
                      {monthLabel(attendanceMonth)} · {attendanceMonth}
                    </Text>
                    <View style={[styles.topSummaryGrid, styles.topSummaryGridEqual, { columnGap: 10, rowGap: 10 }]}>
                      <View style={countCardStyle}>
                        <View style={styles.topStatCardInner}>
                          <Text variant="labelSmall" style={[styles.topStatLabel, textSub]} numberOfLines={2}>
                            Present days
                          </Text>
                          <Text variant="titleMedium" style={[styles.topStatValue, textMain]} numberOfLines={1}>
                            {String(s.present)}
                          </Text>
                        </View>
                      </View>
                      <View style={countCardStyle}>
                        <View style={styles.topStatCardInner}>
                          <Text variant="labelSmall" style={[styles.topStatLabel, textSub]} numberOfLines={2}>
                            Absent days
                          </Text>
                          <Text variant="titleMedium" style={[styles.topStatValue, textMain]} numberOfLines={1}>
                            {String(s.absent)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })()}

              <View style={[styles.calendarCard, sectionCard, { marginBottom: 12 }]}>
                <View style={styles.weekHeaderRow}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                    <Text key={`wh-${idx}`} variant="labelSmall" style={[styles.weekHeaderCell, textSub]}>
                      {d}
                    </Text>
                  ))}
                </View>
                <View style={[styles.calendarGrid, width < 380 ? styles.calendarGridTiny : null]}>
                  {(() => {
                    const m = attendanceMonth.match(/^(\d{4})-(\d{2})$/);
                    const yyyy = m ? Number(m[1]) : 0;
                    const mm = m ? Number(m[2]) : 1;
                    const dim = daysInMonth(attendanceMonth);
                    const firstDow = new Date(yyyy, mm - 1, 1).getDay();
                    const blanks = Array.from({ length: firstDow }, (_, i) => <View key={`b-${i}`} style={styles.calBlank} />);
                    const days = Array.from({ length: dim }, (_, idx) => {
                      const day = idx + 1;
                      const iso = yyyymmdd(attendanceMonth, day);
                      const ex = (b.attendance ?? []).find((x) => String(x.date).slice(0, 10) === iso);
                      const st = (ex?.attendanceStatus ?? 'Pending') as AttendanceStatus;
                      const isPresentDay = st === 'Present' || st === 'Late Arrival';
                      const isAbsentDay = st === 'Absent';
                      const dot =
                        isPresentDay
                          ? styles.attDot_present
                          : isAbsentDay
                            ? styles.attDot_absent
                            : st === 'Weekly Off'
                              ? styles.attDot_weeklyOff
                              : st === 'On Leave' || st === 'Paid Leave' || st === 'Unpaid Leave'
                                ? styles.attDot_leave
                                : styles.attDot_none;
                      const cellStatusBg =
                        isPresentDay
                          ? scheme === 'dark'
                            ? styles.calCellPresentDark
                            : styles.calCellPresentLight
                          : isAbsentDay
                            ? scheme === 'dark'
                              ? styles.calCellAbsentDark
                              : styles.calCellAbsentLight
                            : null;
                      return (
                        <Pressable
                          key={iso}
                          onPress={() => openAttendanceEditor(iso)}
                          style={({ pressed }) => [
                            styles.calCell,
                            layoutDesktop ? styles.calCellDesktop : layoutTablet ? styles.calCellTablet : styles.calCellMobile,
                            width < 380 ? styles.calCellTiny : null,
                            cellStatusBg,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={styles.calTopRow}>
                            <Text variant="labelSmall" style={[styles.calDayNum, textMain]}>
                              {String(day)}
                            </Text>
                            <View style={[styles.attDot, dot]} />
                          </View>
                          <Text variant="labelSmall" style={[styles.calMeta, textSub]} numberOfLines={1}>
                            {st}
                          </Text>
                        </Pressable>
                      );
                    });
                    return (
                      <>
                        {blanks}
                        {days}
                      </>
                    );
                  })()}
                </View>
              </View>

            </Card.Content>
          </Card>
        ) : null}

        {tab === 'salary' && b ? (
          <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
            <Card.Content
              style={[
                styles.sectionContent,
                styles.salaryScreenContent,
                layoutMobile && styles.salaryScreenContentMobile,
                layoutTablet && styles.salaryScreenContentTablet,
                layoutDesktop && styles.salaryScreenContentDesktop,
              ]}
            >
              <>
              <View style={[styles.monthNavRow, { marginBottom: 14 }]}>
                <Pressable
                  disabled={isSalaryMonthNavPrevDisabled}
                  onPress={() => setSalaryMonth(shiftMonth(salaryMonth, -1))}
                  style={({ pressed }) => [
                    styles.monthNavBtn,
                    isSalaryMonthNavPrevDisabled ? styles.monthNavBtnDisabled : null,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialCommunityIcons name="chevron-left" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                </Pressable>
                <Pressable
                  onPress={() => setSalaryMonthPickerOpen(true)}
                  style={({ pressed }) => [styles.monthNavCenter, pressed && styles.pressed]}
                >
                  <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                    {salaryMonth ? monthLabel(salaryMonth) : '—'}
                  </Text>
                  <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                    {salaryMonth || '—'}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={isSalaryMonthNavNextDisabled}
                  onPress={() => setSalaryMonth(shiftMonth(salaryMonth, 1))}
                  style={({ pressed }) => [
                    styles.monthNavBtn,
                    isSalaryMonthNavNextDisabled ? styles.monthNavBtnDisabled : null,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialCommunityIcons name="chevron-right" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                </Pressable>
              </View>

              <View
                style={[
                  styles.salaryTopCardsGrid,
                  layoutDesktop && styles.salaryTopCardsGridDesktop,
                  layoutTablet && styles.salaryTopCardsGridTablet,
                  layoutMobile && styles.salaryTopCardsGridMobile,
                ]}
              >
                {[
                  { label: 'Final salary (earned)', value: formatInr2(paymentCalc.earnedFinal), tone: false },
                  { label: 'Advance (this month)', value: formatInr2(paymentCalc.advanceTotal), tone: false },
                  { label: 'Net final settlement', value: formatInr2(paymentCalc.netSettlementDue), tone: false },
                  { label: 'Present days', value: String(salaryMonthlyCalc.presentDays), tone: false },
                  { label: 'Final pay status', value: paymentStatusUi(paymentCalc.statusCurrent), tone: true },
                ].map((c) => {
                  const tone = c.tone ? salaryUiStatusColors(String(c.value)) : null;
                  return (
                    <View
                      key={c.label}
                      style={[
                        styles.salaryTopCard,
                        layoutDesktop && styles.salaryTopCardFour,
                        layoutTablet && styles.salaryTopCardTwoCol,
                        layoutMobile && styles.salaryTopCardTwoCol,
                        layoutMobile && styles.salaryTopCardMobilePad,
                        layoutTablet && styles.salaryTopCardTabletPad,
                        scheme === 'dark' ? styles.salaryTopCardDark : styles.salaryTopCardLight,
                        tone ? { borderColor: tone.border, backgroundColor: tone.bg } : null,
                      ]}
                    >
                      <Text
                        variant="labelSmall"
                        style={[textSub, layoutMobile && styles.salaryTextMetaMobile]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {c.label}
                      </Text>
                      <Text
                        variant={layoutMobile ? 'bodyLarge' : 'titleSmall'}
                        style={[styles.bold, tone ? { color: tone.fg } : textMain, layoutMobile && styles.salaryTextValueMobile]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {c.value}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={[styles.salaryColumnWrap, salaryTwoColumn && styles.salaryColumnWrapSplit]}>
                <View style={[styles.salaryColumn, salaryTwoColumn && styles.salaryColumnDesk]}>
                  <View
                    style={[
                      styles.salaryWhiteCard,
                      scheme === 'dark' ? styles.salaryTabSummaryCardDark : styles.salaryTabSummaryCardLight,
                      layoutTablet && styles.salaryWhiteCardPadTablet,
                      layoutMobile && styles.salaryWhiteCardPadMobile,
                    ]}
                  >
                    <Text
                      variant="titleSmall"
                      style={[styles.bold, textMain, { marginBottom: layoutMobile ? 8 : 10 }, layoutMobile && styles.salarySectionTitleMobile]}
                    >
                      Salary details
                    </Text>
                    {[
                      { label: 'Salary Type', value: formatSalaryTypeUi(String(salaryMonthlyCalc.salaryType)) },
                      { label: 'Monthly Salary Amount', value: formatInr2(salaryMonthlyCalc.monthlySalary) },
                      {
                        label: 'Calculated per day salary',
                        value: formatInr2(salaryMonthlyCalc.perDaySalary),
                      },
                      {
                        label: 'Covered route per day salary',
                        value: formatInr2(salaryMonthlyCalc.perDaySalary),
                      },
                      {
                        label: 'Present days salary (per day × present days)',
                        value: formatInr2(salaryMonthlyCalc.attendanceSalary),
                      },
                      {
                        label: 'Covered route salary (per day × covered days)',
                        value: formatInr2(
                          roundMoney2(salaryMonthlyCalc.perDaySalary * salaryMonthlyCalc.routeCoverageCreditedDays),
                        ),
                      },
                      {
                        label: 'Previous balance (carry forward)',
                        value: formatInr2(roundMoney2(Number((salaryMonthlyCalc as any).previousBalance ?? (salaryMonthlyCalc as any).previousPendingSalary ?? 0))),
                      },
                      { label: 'Bonus Amount', value: formatInr2(Math.max(0, roundMoney2(Number(salaryBonus || 0)))) },
                      { label: 'Deduction Amount', value: formatInr2(Math.max(0, roundMoney2(Number(salaryDeduction || 0)))) },
                      {
                        label: 'Advance salary (this month, separate ledger)',
                        value: formatInr2(paymentCalc.advanceTotal),
                      },
                      {
                        label: 'Net due for final settlement (earned − advances)',
                        value: formatInr2(paymentCalc.netSettlementDue),
                      },
                    ].map((row) => (
                      <View key={row.label} style={[styles.salaryTabKvRow, layoutMobile && styles.salaryTabKvRowMobile]}>
                        <Text
                          variant={layoutMobile ? 'bodySmall' : 'bodyMedium'}
                          style={[textSub, styles.salaryTabKvLabel, layoutMobile && styles.salaryTextMetaMobile]}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {row.label}
                        </Text>
                        <Text
                          variant={layoutMobile ? 'bodySmall' : 'bodyMedium'}
                          style={[styles.bold, textMain, styles.salaryTabKvValue, layoutMobile && styles.salaryTextValueMobile]}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {row.value}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View
                    style={[
                      styles.salaryTabFormulaBox,
                      layoutTablet && styles.salaryFormulaPadTablet,
                      layoutMobile && styles.salaryFormulaPadMobile,
                      scheme === 'dark' ? styles.salaryTabFormulaBoxDark : null,
                    ]}
                  >
                    <Text variant="titleSmall" style={[styles.bold, textMain, layoutMobile && styles.salarySectionTitleMobile]}>
                      Final salary formula
                    </Text>
                    <Text variant="bodySmall" style={[textSub, { marginTop: 8 }, layoutMobile && styles.salaryTextMetaMobile]}>
                      (Per day × Present days) + (Per day × Covered route days) + Previous balance (carry forward) + Bonus − Deduction.
                      Absent days earn nothing; weekly off and leave records do not add base pay.
                    </Text>
                    <View style={styles.salaryTabFormulaLines}>
                      <Text variant="bodySmall" style={[textSub, layoutMobile && styles.salaryTextMetaMobile]} numberOfLines={2} ellipsizeMode="tail">
                        Per day salary = {formatInr2(salarySimpleFormula.pd)}
                      </Text>
                      <Text variant="bodySmall" style={[textSub, layoutMobile && styles.salaryTextMetaMobile]} numberOfLines={2} ellipsizeMode="tail">
                        {formatInr2(salarySimpleFormula.pd)} × {salarySimpleFormula.pr} present days = {formatInr2(salarySimpleFormula.pe)}
                      </Text>
                      <Text variant="bodySmall" style={[textSub, layoutMobile && styles.salaryTextMetaMobile]} numberOfLines={2} ellipsizeMode="tail">
                        {formatInr2(salarySimpleFormula.pd)} × {salarySimpleFormula.cd} covered route days = {formatInr2(salarySimpleFormula.ce)}
                      </Text>
                      <Text variant="bodySmall" style={[textSub, layoutMobile && styles.salaryTextMetaMobile]} numberOfLines={2} ellipsizeMode="tail">
                        + Previous balance {formatInr2(salarySimpleFormula.pending)}
                      </Text>
                      <Text variant="bodySmall" style={[textSub, layoutMobile && styles.salaryTextMetaMobile]} numberOfLines={1} ellipsizeMode="tail">
                        + Bonus {formatInr2(salarySimpleFormula.bonus)}
                      </Text>
                      <Text variant="bodySmall" style={[textSub, layoutMobile && styles.salaryTextMetaMobile]} numberOfLines={1} ellipsizeMode="tail">
                        − Deduction {formatInr2(salarySimpleFormula.ded)}
                      </Text>
                      <Text variant={layoutMobile ? 'bodySmall' : 'bodyMedium'} style={[styles.bold, textMain, { marginTop: 8 }, layoutMobile && styles.salaryTextValueMobile]} numberOfLines={2} ellipsizeMode="tail">
                        Calculated total = {formatInr2(salarySimpleFormula.simple)}
                      </Text>
                      <Text variant={layoutMobile ? 'bodySmall' : 'bodyMedium'} style={[styles.bold, textMain, layoutMobile && styles.salaryTextValueMobile]} numberOfLines={2} ellipsizeMode="tail">
                        Final salary (system) = {formatInr2(salaryMonthlyCalc.finalSalary)}
                      </Text>
                      {Math.abs(salarySimpleFormula.simple - salaryMonthlyCalc.finalSalary) > 0.5 ? (
                        <Text variant="bodySmall" style={[textSub, { marginTop: 6 }, layoutMobile && styles.salaryTextMetaMobile]} numberOfLines={4} ellipsizeMode="tail">
                          Difference is usually a final salary override on this month&apos;s record.
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View
                    style={[
                      styles.salaryPaymentCard,
                      layoutTablet && styles.salaryPaymentPadTablet,
                      layoutMobile && styles.salaryPaymentPadMobile,
                      {
                        borderWidth: 1,
                        borderColor: 'rgba(37,99,235,0.22)',
                        backgroundColor: scheme === 'dark' ? 'rgba(37,99,235,0.10)' : 'rgba(37,99,235,0.06)',
                      },
                    ]}
                  >
                    <Text
                      variant="titleSmall"
                      style={[styles.bold, textMain, { marginBottom: layoutMobile ? 8 : 10 }, layoutMobile && styles.salarySectionTitleMobile]}
                    >
                      Advance salary ledger
                    </Text>
                    <Text variant="bodySmall" style={[textSub, { marginBottom: 10 }, layoutMobile && styles.salaryTextMetaMobile]}>
                      Month {salaryMonth || '—'} · tracked separately from final salary payments. Totals feed into net settlement on the right.
                    </Text>

                    <View style={[styles.paySummaryGrid, layoutMobile && styles.paySummaryGridMobile]}>
                      {[
                        { label: 'Advance lines', value: String(advancePaymentsThisMonth.entries.length), strong: true },
                        { label: 'Total advance', value: formatInr2(advancePaymentsThisMonth.total), strong: false },
                      ].map((c) => (
                        <View key={c.label} style={[styles.paySummaryCard, layoutMobile && styles.paySummaryCardMobile]}>
                          <Text variant="bodySmall" style={styles.summaryLabel} numberOfLines={2} ellipsizeMode="tail">
                            {c.label}
                          </Text>
                          <Text
                            variant={layoutMobile ? 'bodyLarge' : 'titleSmall'}
                            style={[styles.summaryValue, c.strong ? { color: COLORS.primary, fontWeight: '900' } : textMain]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {c.value}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={[styles.paymentFieldsGrid, layoutMobile && styles.paymentFieldsGridMobile]}>
                      <View style={layoutMobile ? styles.salaryInputFullMobile : undefined}>
                        <DateInput label="Advance date" value={advancePayDate} onChange={setAdvancePayDate} dense />
                      </View>
                      <TextInput
                        dense
                        mode="outlined"
                        label="Advance amount"
                        value={advancePayingNow}
                        onChangeText={(t) => setAdvancePayingNow(t.replace(/[^\d]/g, '').slice(0, 10))}
                        keyboardType="numeric"
                        style={layoutMobile ? styles.salaryInputFullMobile : undefined}
                        contentStyle={layoutMobile ? styles.salaryInputContentMobile : undefined}
                      />
                    </View>

                    <TextInput
                      dense
                      mode="outlined"
                      label="Purpose (optional)"
                      value={advancePurpose}
                      onChangeText={setAdvancePurpose}
                      style={layoutMobile ? styles.salaryInputFullMobile : undefined}
                      contentStyle={layoutMobile ? styles.salaryInputContentMobile : undefined}
                    />

                    <Text variant={layoutMobile ? 'labelMedium' : 'labelLarge'} style={[textMain, { marginBottom: 8 }, layoutMobile && styles.salaryTextMetaMobile]}>
                      Advance mode
                    </Text>
                    <View style={[styles.salaryPayModeRow, layoutMobile && styles.salaryPayModeRowMobile]}>
                      {(['Cash', 'UPI', 'Bank Transfer', 'Card'] as const).map((mode) => (
                        <Pressable
                          key={mode}
                          onPress={() => setAdvancePayMode(mode)}
                          style={({ pressed }) => [
                            styles.salaryPayModeChip,
                            layoutMobile && styles.salaryPayModeChipMobile,
                            advancePayMode === mode && styles.salaryPayModeChipActive,
                            scheme === 'dark' && styles.salaryPayModeChipDark,
                            advancePayMode === mode && scheme === 'dark' && styles.salaryPayModeChipActiveDark,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            variant="labelSmall"
                            style={
                              advancePayMode === mode
                                ? scheme === 'dark'
                                  ? styles.profileStatusSegLabelOnDark
                                  : styles.salaryPayModeChipLabelActive
                                : textSub
                            }
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {mode}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Button
                      mode="contained"
                      buttonColor={COLORS.primary}
                      onPress={() => void payAdvanceSalary()}
                      loading={update.isPending}
                      disabled={update.isPending}
                      compact={layoutMobile}
                      style={[styles.payFullBtn, layoutMobile && styles.payFullBtnMobile, layoutMobile && styles.salaryPayBtnMobile]}
                      contentStyle={layoutMobile ? styles.salaryPayBtnContentMobile : undefined}
                      labelStyle={[styles.payCtaLabel, layoutMobile && styles.salaryPayBtnLabelMobile]}
                    >
                      Record advance
                    </Button>

                    {advancePaymentsThisMonth.entries.length ? (
                      <View style={{ marginTop: 10, gap: 8 }}>
                        {advancePaymentsThisMonth.entries.slice(0, 8).map((e) => (
                          <View key={String(e.id)} style={[styles.salaryTabKvRow, layoutMobile && styles.salaryTabKvRowMobile]}>
                            <Text variant={layoutMobile ? 'bodySmall' : 'bodyMedium'} style={[textSub, styles.salaryTabKvLabel]} numberOfLines={2}>
                              {String(e.date ?? '').slice(0, 10) || '—'} · {String(e.paymentMode ?? '—')}
                              {e.purpose ? ` · ${String(e.purpose)}` : ''}
                            </Text>
                            <Text variant={layoutMobile ? 'bodySmall' : 'bodyMedium'} style={[styles.bold, textMain, styles.salaryTabKvValue]} numberOfLines={1}>
                              {formatInr2(Number(e.amount ?? 0))}
                            </Text>
                          </View>
                        ))}
                        {advancePaymentsThisMonth.entries.length > 8 ? (
                          <Text variant="bodySmall" style={textSub}>
                            Showing latest 8 lines. Open History → Salary memo for this month for full context.
                          </Text>
                        ) : null}
                      </View>
                    ) : (
                      <Text variant="bodySmall" style={[textSub, { marginTop: 8 }]}>
                        No advance lines for this month yet.
                      </Text>
                    )}
                  </View>
                </View>

                <View style={[styles.salaryColumn, salaryTwoColumn && styles.salaryColumnDesk]}>
                  <View
                    style={[
                      styles.salaryWhiteCard,
                      scheme === 'dark' ? styles.salaryTabSummaryCardDark : styles.salaryTabSummaryCardLight,
                      layoutTablet && styles.salaryWhiteCardPadTablet,
                      layoutMobile && styles.salaryWhiteCardPadMobile,
                    ]}
                  >
                    <Text
                      variant="titleSmall"
                      style={[styles.bold, textMain, { marginBottom: layoutMobile ? 8 : 10 }, layoutMobile && styles.salarySectionTitleMobile]}
                    >
                      Bonus and deduction
                    </Text>
                    <View style={[styles.paymentFieldsGrid, layoutMobile && styles.paymentFieldsGridMobile]}>
                      <TextInput
                        dense
                        mode="outlined"
                        label="Bonus Amount"
                        value={salaryBonus}
                        onChangeText={(t) => setSalaryBonus(t.replace(/[^\d]/g, '').slice(0, 8))}
                        keyboardType="numeric"
                        style={layoutMobile ? styles.salaryInputFullMobile : undefined}
                        contentStyle={layoutMobile ? styles.salaryInputContentMobile : undefined}
                      />
                      <TextInput
                        dense
                        mode="outlined"
                        label="Deduction Amount"
                        value={salaryDeduction}
                        onChangeText={(t) => setSalaryDeduction(t.replace(/[^\d]/g, '').slice(0, 8))}
                        keyboardType="numeric"
                        style={layoutMobile ? styles.salaryInputFullMobile : undefined}
                        contentStyle={layoutMobile ? styles.salaryInputContentMobile : undefined}
                      />
                    </View>
                    <Text variant="bodySmall" style={[textSub, { marginTop: 8 }, layoutMobile && styles.salaryTextMetaMobile]}>
                      Bonus increases salary; deduction reduces it.
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.salaryPaymentCard,
                      layoutTablet && styles.salaryPaymentPadTablet,
                      layoutMobile && styles.salaryPaymentPadMobile,
                      {
                        borderWidth: 1,
                        borderColor: salaryPaymentUiTint.border,
                        backgroundColor: salaryPaymentUiTint.bg,
                      },
                    ]}
                  >
                    <Text
                      variant="titleSmall"
                      style={[styles.bold, textMain, { marginBottom: layoutMobile ? 8 : 10 }, layoutMobile && styles.salarySectionTitleMobile]}
                    >
                      Final salary settlement
                    </Text>
                    <Text variant="bodySmall" style={[textSub, { marginBottom: 10 }, layoutMobile && styles.salaryTextMetaMobile]}>
                      Only payments toward closing the month&apos;s salary count here. Advance salary is recorded in the left column ledger and reduces net
                      settlement below—it is not final salary paid.
                    </Text>
                    <Text variant="bodySmall" style={[textSub, { marginBottom: 10 }, layoutMobile && styles.salaryTextMetaMobile]}>
                      Earned {formatInr2(paymentCalc.earnedFinal)} − Advance {formatInr2(paymentCalc.advanceTotal)} = Net due{' '}
                      {formatInr2(paymentCalc.netSettlementDue)}
                    </Text>
                    <View style={[styles.paySummaryGrid, layoutMobile && styles.paySummaryGridMobile]}>
                      {[
                        { label: 'Final pay status', value: paymentStatusUi(paymentCalc.statusCurrent), strong: true },
                        { label: 'Paid toward final', value: formatInr2(paymentCalc.alreadyPaid), strong: false },
                        { label: 'Pending on final', value: formatInr2(paymentCalc.remainingBefore), strong: false },
                      ].map((c) => (
                        <View key={c.label} style={[styles.paySummaryCard, layoutMobile && styles.paySummaryCardMobile]}>
                          <Text variant="bodySmall" style={styles.summaryLabel} numberOfLines={2} ellipsizeMode="tail">
                            {c.label}
                          </Text>
                          <Text
                            variant={layoutMobile ? 'bodyLarge' : 'titleSmall'}
                            style={[styles.summaryValue, c.strong ? { color: salaryPaymentUiTint.fg, fontWeight: '900' } : textMain]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {c.value}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <Text variant="labelLarge" style={[textMain, { marginBottom: 8 }, layoutMobile && styles.salaryTextMetaMobile]}>
                      Status source (auto or manual)
                    </Text>
                    <Text variant="bodySmall" style={[textSub, { marginBottom: 8 }]}>
                      Auto follows net settlement vs paid toward final. Manual lets you set Paid / Partial / Pending for display while amounts still drive carry
                      forward.
                    </Text>
                    <View style={[styles.salaryPayModeRow, layoutMobile && styles.salaryPayModeRowMobile, { marginBottom: 10 }]}>
                      {(['Auto', 'Manual'] as const).map((src) => (
                        <Pressable
                          key={src}
                          onPress={() => setFinalPayStatusSourceUi(src)}
                          style={({ pressed }) => [
                            styles.salaryPayModeChip,
                            layoutMobile && styles.salaryPayModeChipMobile,
                            finalPayStatusSourceUi === src && styles.salaryPayModeChipActive,
                            scheme === 'dark' && styles.salaryPayModeChipDark,
                            finalPayStatusSourceUi === src && scheme === 'dark' && styles.salaryPayModeChipActiveDark,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            variant="labelSmall"
                            style={
                              finalPayStatusSourceUi === src
                                ? scheme === 'dark'
                                  ? styles.profileStatusSegLabelOnDark
                                  : styles.salaryPayModeChipLabelActive
                                : textSub
                            }
                          >
                            {src}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    {finalPayStatusSourceUi === 'Manual' ? (
                      <>
                        <Text variant="labelLarge" style={[textMain, { marginBottom: 8 }]}>
                          Manual final pay status
                        </Text>
                        <View style={[styles.salaryPayModeRow, layoutMobile && styles.salaryPayModeRowMobile, { marginBottom: 10 }]}>
                          {(['Paid', 'Partial', 'Unpaid'] as const).map((st) => (
                            <Pressable
                              key={st}
                              onPress={() => setFinalPayStatusManualUi(st)}
                              style={({ pressed }) => [
                                styles.salaryPayModeChip,
                                layoutMobile && styles.salaryPayModeChipMobile,
                                finalPayStatusManualUi === st && styles.salaryPayModeChipActive,
                                scheme === 'dark' && styles.salaryPayModeChipDark,
                                finalPayStatusManualUi === st && scheme === 'dark' && styles.salaryPayModeChipActiveDark,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Text
                                variant="labelSmall"
                                style={
                                  finalPayStatusManualUi === st
                                    ? scheme === 'dark'
                                      ? styles.profileStatusSegLabelOnDark
                                      : styles.salaryPayModeChipLabelActive
                                    : textSub
                                }
                              >
                                {st === 'Unpaid' ? 'Pending' : st}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </>
                    ) : null}
                    <Button
                      mode="outlined"
                      onPress={() =>
                        void saveFinalSalaryPaymentStatusPrefs(
                          finalPayStatusSourceUi,
                          finalPayStatusSourceUi === 'Manual' ? finalPayStatusManualUi : undefined,
                        )
                      }
                      loading={update.isPending}
                      disabled={update.isPending}
                      compact={layoutMobile}
                      style={{ marginBottom: 12 }}
                    >
                      Save status preference
                    </Button>

                    <View style={[styles.paymentFieldsGrid, layoutMobile && styles.paymentFieldsGridMobile]}>
                      <View style={layoutMobile ? styles.salaryInputFullMobile : undefined}>
                        <DateInput label="Payment Date" value={salaryPayDate} onChange={setSalaryPayDate} dense />
                      </View>
                      <TextInput
                        dense
                        mode="outlined"
                        label="Amount paying now"
                        value={salaryPayingNow}
                        onChangeText={(t) => setSalaryPayingNow(t.replace(/[^\d]/g, '').slice(0, 10))}
                        keyboardType="numeric"
                        style={layoutMobile ? styles.salaryInputFullMobile : undefined}
                        contentStyle={layoutMobile ? styles.salaryInputContentMobile : undefined}
                      />
                    </View>

                    <Text variant={layoutMobile ? 'labelMedium' : 'labelLarge'} style={[textMain, { marginBottom: 8 }, layoutMobile && styles.salaryTextMetaMobile]}>
                      Payment mode
                    </Text>
                    <View style={[styles.salaryPayModeRow, layoutMobile && styles.salaryPayModeRowMobile]}>
                      {(['Cash', 'UPI', 'Bank Transfer', 'Card'] as const).map((mode) => (
                        <Pressable
                          key={mode}
                          onPress={() => setSalaryPayMode(mode)}
                          style={({ pressed }) => [
                            styles.salaryPayModeChip,
                            layoutMobile && styles.salaryPayModeChipMobile,
                            salaryPayMode === mode && styles.salaryPayModeChipActive,
                            scheme === 'dark' && styles.salaryPayModeChipDark,
                            salaryPayMode === mode && scheme === 'dark' && styles.salaryPayModeChipActiveDark,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            variant="labelSmall"
                            style={
                              salaryPayMode === mode
                                ? scheme === 'dark'
                                  ? styles.profileStatusSegLabelOnDark
                                  : styles.salaryPayModeChipLabelActive
                                : textSub
                            }
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {mode}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Button
                      mode="contained"
                      buttonColor={COLORS.primary}
                      onPress={() => void paySalary()}
                      loading={update.isPending}
                      disabled={
                        update.isPending ||
                        paymentCalc.netSettlementDue <= 0 ||
                        paymentCalc.remainingBefore <= 0 ||
                        paymentCalc.payingNow <= 0
                      }
                      compact={layoutMobile}
                      style={[styles.payFullBtn, layoutMobile && styles.payFullBtnMobile, layoutMobile && styles.salaryPayBtnMobile]}
                      contentStyle={layoutMobile ? styles.salaryPayBtnContentMobile : undefined}
                      labelStyle={[styles.payCtaLabel, layoutMobile && styles.salaryPayBtnLabelMobile]}
                    >
                      Pay final salary
                    </Button>
                  </View>
                </View>
              </View>
              </>
            </Card.Content>
          </Card>
        ) : null}

        {tab === 'history' && b ? (
          <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
            <Card.Content style={styles.sectionContent}>
              <View style={styles.historyKindRow}>
                <TabPill
                  label="Salary memo"
                  active={historyKind === 'salary'}
                  onPress={() => setHistoryKind('salary')}
                  compact={layoutMobile}
                />
                <TabPill
                  label="Attendance memo"
                  active={historyKind === 'attendance'}
                  onPress={() => setHistoryKind('attendance')}
                  compact={layoutMobile}
                />
                <TabPill
                  label="Profile update history"
                  active={historyKind === 'profile'}
                  onPress={() => setHistoryKind('profile')}
                  compact={layoutMobile}
                />
              </View>

              {historyKind === 'salary' ? (
                <>
                  <View style={[styles.monthNavRow, { marginBottom: 14 }]}>
                    <Pressable
                      disabled={isHistorySalaryMemoPrevDisabled}
                      onPress={() => setHistorySalaryMemoMonth(shiftMonth(historySalaryMemoMonth, -1))}
                      style={({ pressed }) => [
                        styles.monthNavBtn,
                        isHistorySalaryMemoPrevDisabled ? styles.monthNavBtnDisabled : null,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialCommunityIcons name="chevron-left" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                    </Pressable>
                    <Pressable
                      onPress={() => setHistorySalaryMemoMonthPickerOpen(true)}
                      style={({ pressed }) => [styles.monthNavCenter, pressed && styles.pressed]}
                    >
                      <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                        {monthLabel(historySalaryMemoMonth)}
                      </Text>
                      <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                        {historySalaryMemoMonth}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={isHistorySalaryMemoNextDisabled}
                      onPress={() => setHistorySalaryMemoMonth(shiftMonth(historySalaryMemoMonth, 1))}
                      style={({ pressed }) => [
                        styles.monthNavBtn,
                        isHistorySalaryMemoNextDisabled ? styles.monthNavBtnDisabled : null,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialCommunityIcons name="chevron-right" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                    </Pressable>
                  </View>

                  {!historySalaryMemoPayroll || !b ? (
                    <Text variant="bodyMedium" style={[textSub, { paddingVertical: 8 }]}>
                      No salary memo for this selection.
                    </Text>
                  ) : (
                    (() => {
                      const live = historySalaryMemoPayroll;
                      const hr = historySalaryMemoHistRow;
                      const paidFinal = roundMoney2(Number((hr as any)?.paidAmount ?? 0));
                      const advanceTotalHist = totalAdvanceSalaryForMonthRecord(hr as any);
                      const autoPay = computeAutoFinalSalaryPaymentStatus(live.finalSalary, advanceTotalHist, paidFinal);
                      const displayStatus = resolveDisplayedFinalSalaryPaymentStatus(hr as any, autoPay.status);
                      const payStat = { pendingAmount: autoPay.pendingAmount, status: displayStatus };
                      const st = salaryUiStatusColors(paymentStatusUi(payStat.status));
                      const pd = live.perDaySalary;
                      const pr = live.presentDays;
                      const cd = live.routeCoverageCreditedDays;
                      const pe = roundMoney2(pd * pr);
                      const ce = roundMoney2(pd * cd);
                      const bonus = live.bonusAmount;
                      const ded = live.deductionAmount;
                      const prevP = live.previousPendingSalary;
                      const prevO = live.previousOverpayment;
                      const auto = live.finalAutoUnified;
                      const net = live.finalSalary;
                      const fo = live.finalSalaryOverride;
                      const payments = ((hr as any)?.payments ?? []) as Array<{
                        id: string;
                        date?: string;
                        amountPaid?: number;
                        paymentMode?: string;
                        remainingPendingAmount?: number;
                      }>;
                      const lastPayIso = hr?.paymentDate ? String(hr.paymentDate).slice(0, 10) : '';
                      const lastPayMonth = lastPayIso.length >= 7 ? lastPayIso.slice(0, 7) : '';

                      return (
                        <View style={{ gap: 12 }}>
                          <View style={[styles.monthlySummaryCard, sectionCard]}>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                              <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={2}>
                                Salary month · {monthLabel(historySalaryMemoMonth)} ({historySalaryMemoMonth})
                              </Text>
                              <View style={[styles.salaryHistStatusPill, { backgroundColor: st.bg, borderColor: st.border, borderWidth: 1 }]}>
                                <Text variant="labelSmall" style={{ color: st.fg, fontWeight: '900' }} numberOfLines={1}>
                                  {paymentStatusUi(payStat.status)}
                                </Text>
                              </View>
                            </View>
                            <Text variant="bodySmall" style={[textSub, { marginTop: 10 }]}>
                              Final salary (earned): {formatInr2(net)} · Advance (ledger): {formatInr2(advanceTotalHist)} · Net final settlement:{' '}
                              {formatInr2(autoPay.netSettlementDue)}
                            </Text>
                            <Text variant="bodySmall" style={textSub}>
                              Paid toward final (excludes advance): {formatInr2(paidFinal)} · Pending on final:{' '}
                              {formatInr2(payStat.pendingAmount)}
                              {(hr as any)?.paymentStatusSource === 'Manual' ? ' · Status: manual override' : ' · Status: auto'}
                            </Text>
                            <Text variant="bodySmall" style={textSub}>
                              Final settlement lines: {payments.length}
                              {paidFinal > 0 && payments.length === 0 ? ' (amount on record without line breakdown)' : ''}
                            </Text>
                            {lastPayIso ? (
                              <Text variant="bodySmall" style={textSub}>
                                Last payment date on record: {isoToDdMmmYyyy(lastPayIso) || lastPayIso}
                                {lastPayMonth ? ` · Paid in calendar month ${monthLabel(lastPayMonth)} (${lastPayMonth})` : ''}
                              </Text>
                            ) : null}
                            {!hr ? (
                              <Text variant="bodySmall" style={[textSub, { marginTop: 8 }]}>
                                No salary history row saved for this month yet—figures follow live attendance and the same rules as the Salary tab.
                              </Text>
                            ) : null}
                          </View>

                          <View style={[styles.monthlySummaryCard, sectionCard]}>
                            <Text variant="titleSmall" style={[styles.bold, textMain, { marginBottom: 8 }]}>
                              How this month is calculated
                            </Text>
                            <Text variant="bodySmall" style={[textSub, { lineHeight: 20 }]}>
                              Per day {formatInr2(pd)} × present days ({pr}) = {formatInr2(pe)}.{'\n'}
                              + Per day × route-cover days credited ({cd}) = {formatInr2(ce)}.{'\n'}
                              + Previous balance {formatInr2(roundMoney2(prevP - prevO))} + Bonus {formatInr2(bonus)} − Deduction {formatInr2(ded)}.{'\n'}
                              = Auto total {formatInr2(auto)}.
                              {fo !== undefined ? `\nFinal override applied → ${formatInr2(net)}.` : `\nNet payable ${formatInr2(net)}.`}
                            </Text>
                            <Text variant="bodySmall" style={[textSub, { marginTop: 8, lineHeight: 20 }]}>
                              Salary type: {live.salaryType}. Incentives, extra route earnings, and temp replacement lines are on the Salary tab and are not in
                              this auto net unless you override. Leave and weekly-off records do not change this auto total. Advance salary is a separate month
                              ledger and reduces net final settlement (not counted as final salary paid).
                            </Text>
                          </View>

                          {((hr as any)?.advanceSalaryEntries ?? []).length > 0 ? (
                            <View style={{ gap: 8 }}>
                              <Text variant="titleSmall" style={[styles.bold, textMain]}>
                                Advance salary ledger ({historySalaryMemoMonth})
                              </Text>
                              {((hr as any).advanceSalaryEntries as any[]).map((e) => {
                                const d = String(e.date ?? '').slice(0, 10);
                                return (
                                  <View key={String(e.id)} style={[styles.monthlySummaryCard, sectionCard]}>
                                    <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                                      {isoToDdMmmYyyy(d) || d || '—'}
                                    </Text>
                                    <Text variant="bodySmall" style={[textSub, { marginTop: 6 }]}>
                                      Advance: {formatInr2(Number(e.amount ?? 0))} · Mode: {e.paymentMode ?? '—'}
                                      {e.purpose ? ` · ${String(e.purpose)}` : ''}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          ) : null}

                          {payments.length > 0 ? (
                            <View style={{ gap: 8 }}>
                              <Text variant="titleSmall" style={[styles.bold, textMain]}>
                                Final salary settlement payments
                              </Text>
                              {payments.map((p) => {
                                const d = String(p.date ?? '').slice(0, 10);
                                const pm = d.length >= 7 ? d.slice(0, 7) : '';
                                const purpose = String((p as any)?.purpose ?? '').trim();
                                return (
                                  <View key={p.id} style={[styles.monthlySummaryCard, sectionCard]}>
                                    <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                                      {isoToDdMmmYyyy(d) || d || '—'} · {pm ? `${monthLabel(pm)} (${pm})` : '—'}
                                    </Text>
                                    <Text variant="bodySmall" style={[textSub, { marginTop: 6 }]}>
                                      Final settlement: {formatInr2(Number(p.amountPaid ?? 0))} · Mode: {p.paymentMode ?? '—'}
                                      {purpose ? ` · ${purpose}` : ''}
                                    </Text>
                                    <Text variant="bodySmall" style={textSub}>
                                      Pending on final after this line: {formatInr2(Number(p.remainingPendingAmount ?? 0))}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          ) : null}

                          <View style={{ gap: 8 }}>
                            <Text variant="titleSmall" style={[styles.bold, textMain]}>
                              Day-wise base & cover
                            </Text>
                            <Text variant="bodySmall" style={[textSub, { marginBottom: 4 }]}>
                              Each calendar day: base pay only when attendance is Present; otherwise ₹0. On Absent days, cover and route-cover salary credit
                              appear in one line below when on file. Extra lines add route-cover credit (leaver per-day rate) for days you covered someone
                              else.
                            </Text>
                            <View style={{ gap: 8 }}>
                              {historySalaryMemoDayLines.map((line, idx) => {
                                const ac = line.absentCover;
                                const coveredLabel = !ac
                                  ? '—'
                                  : dashStr(ac.coveredByDeliveryBoyName) !== '—'
                                    ? `${ac.coveredByDeliveryBoyName}${ac.coveredByDeliveryBoyId ? ` (${ac.coveredByDeliveryBoyId})` : ''}`
                                    : dashStr(ac.coveredByDeliveryBoyId);
                                const creditedLabel = !ac
                                  ? '—'
                                  : dashStr(ac.salaryCreditedToDeliveryBoyName) !== '—'
                                    ? `${ac.salaryCreditedToDeliveryBoyName}${ac.salaryCreditedToDeliveryBoyId ? ` (${ac.salaryCreditedToDeliveryBoyId})` : ''}`
                                    : dashStr(ac.salaryCreditedToDeliveryBoyId);
                                const creditNote =
                                  ac && ac.transferSalaryToReplacer === false && !ac.salaryCreditedToDeliveryBoyId
                                    ? 'Salary credit not routed to replacer (transfer off on replacement).'
                                    : null;
                                return (
                                  <View
                                    key={`${line.date}-${line.kind}-${idx}`}
                                    style={[styles.monthlySummaryCard, sectionCard, line.kind === 'cover' ? { opacity: 0.95 } : null]}
                                  >
                                    <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={2}>
                                      {isoToDdMmmYyyy(line.date) || line.date} · {line.kind === 'cover' ? 'Cover' : 'Base'} · {line.basis}
                                    </Text>
                                    <Text variant="bodySmall" style={[textSub, { marginTop: 6 }]}>
                                      {formatInr2(line.amount)}
                                    </Text>
                                    {line.kind === 'base' && line.basis === 'Absent' ? (
                                      <>
                                        <Text variant="bodySmall" style={[textSub, { marginTop: 8 }]}>
                                          Who covered this route: {coveredLabel} Route-cover salary credited to: {creditedLabel}
                                        </Text>
                                        {creditNote ? (
                                          <Text variant="bodySmall" style={[textSub, { marginTop: 4 }]}>
                                            {creditNote}
                                          </Text>
                                        ) : null}
                                      </>
                                    ) : null}
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        </View>
                      );
                    })()
                  )}
                </>
              ) : historyKind === 'attendance' ? (
                <>
                  <View style={[styles.monthNavRow, { marginBottom: 14 }]}>
                    <Pressable
                      disabled={isHistoryMemoPrevDisabled}
                      onPress={() => setHistoryMemoMonth(shiftMonth(historyMemoMonth, -1))}
                      style={({ pressed }) => [
                        styles.monthNavBtn,
                        isHistoryMemoPrevDisabled ? styles.monthNavBtnDisabled : null,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialCommunityIcons name="chevron-left" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                    </Pressable>
                    <Pressable
                      onPress={() => setHistoryMemoMonthPickerOpen(true)}
                      style={({ pressed }) => [styles.monthNavCenter, pressed && styles.pressed]}
                    >
                      <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                        {monthLabel(historyMemoMonth)}
                      </Text>
                      <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                        {historyMemoMonth}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={isHistoryMemoNextDisabled}
                      onPress={() => setHistoryMemoMonth(shiftMonth(historyMemoMonth, 1))}
                      style={({ pressed }) => [
                        styles.monthNavBtn,
                        isHistoryMemoNextDisabled ? styles.monthNavBtnDisabled : null,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialCommunityIcons name="chevron-right" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                    </Pressable>
                  </View>

                  {attendanceMemoSorted.length === 0 ? (
                    <Text variant="bodyMedium" style={[textSub, { paddingVertical: 8 }]}>
                      No attendance rows for this month.
                    </Text>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {attendanceMemoSorted.map((e) => (
                        <View key={e.id} style={[styles.monthlySummaryCard, sectionCard]}>
                          <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={2}>
                            {isoToDdMmmYyyy(e.date) || String(e.date).slice(0, 10)} · {e.attendanceStatus}
                          </Text>
                          <Text variant="bodySmall" style={[textSub, { marginTop: 6 }]}>
                            Source: {attendanceSourceLabel(e)}
                          </Text>
                          <Text variant="bodySmall" style={[textSub, { marginTop: 4 }]}>
                            Last updated: {formatUpdatedAtShort(e.updatedAt)}
                          </Text>
                          {e.coverForDeliveryBoyName ? (
                            <Text variant="bodySmall" style={[textSub, { marginTop: 4 }]}>
                              Covering route for: {e.coverForDeliveryBoyName}
                            </Text>
                          ) : null}
                          {(e.notes ?? '').trim() ? (
                            <Text variant="bodySmall" style={[textSub, { marginTop: 6 }]}>
                              Notes: {e.notes}
                            </Text>
                          ) : null}
                          {(e.remarks ?? '').trim() ? (
                            <Text variant="bodySmall" style={[textSub, { marginTop: 4 }]}>
                              Remarks: {e.remarks}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <>
                  <View style={[styles.monthNavRow, { marginBottom: 14 }]}>
                    <Pressable
                      disabled={isProfileHistoryMonthPrevDisabled}
                      onPress={() => setProfileHistoryMonth(shiftMonth(profileHistoryMonth, -1))}
                      style={({ pressed }) => [
                        styles.monthNavBtn,
                        isProfileHistoryMonthPrevDisabled ? styles.monthNavBtnDisabled : null,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialCommunityIcons name="chevron-left" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                    </Pressable>
                    <Pressable
                      onPress={() => setProfileHistoryMonthPickerOpen(true)}
                      style={({ pressed }) => [styles.monthNavCenter, pressed && styles.pressed]}
                    >
                      <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                        {monthLabel(profileHistoryMonth)}
                      </Text>
                      <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                        {profileHistoryMonth}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={isProfileHistoryMonthNextDisabled}
                      onPress={() => setProfileHistoryMonth(shiftMonth(profileHistoryMonth, 1))}
                      style={({ pressed }) => [
                        styles.monthNavBtn,
                        isProfileHistoryMonthNextDisabled ? styles.monthNavBtnDisabled : null,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialCommunityIcons name="chevron-right" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                    </Pressable>
                  </View>
                  <Text variant="bodySmall" style={[textSub, { marginBottom: 12 }]}>
                    Profile updates in {monthLabel(profileHistoryMonth)} ({profileHistoryMonth}), one line each (when, who, what changed). From Edit or this
                    screen. Newest first within the month.
                  </Text>
                  {profileAuditForHistoryMonth.length === 0 ? (
                    <Text variant="bodyMedium" style={[textSub, { paddingVertical: 8 }]}>
                      No profile updates in this month.
                    </Text>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {profileAuditForHistoryMonth.map((entry) => {
                        const when = formatUpdatedAtShort(String(entry.date || entry.updatedAt || ''));
                        const detail =
                          entry.oldValue !== undefined || entry.newValue !== undefined
                            ? ` (${dashStr(entry.oldValue)} → ${dashStr(entry.newValue)})`
                            : '';
                        const line = `${when} · ${entry.updatedBy} — ${entry.action}${detail}`;
                        return (
                          <View key={entry.id} style={[styles.monthlySummaryCard, sectionCard]}>
                            <Text variant="bodySmall" style={textSub} numberOfLines={1} ellipsizeMode="tail">
                              {line}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </>
              )}
            </Card.Content>
          </Card>
        ) : null}

      </ScrollView>

      <Portal>
        <Dialog
          visible={salaryMonthPickerOpen}
          onDismiss={() => setSalaryMonthPickerOpen(false)}
          style={[scheme === 'dark' ? styles.dialogDark : styles.dialogLight, layoutMobile ? styles.monthPickerSheet : styles.monthPickerDialog]}
        >
          <Dialog.Title>Salary month</Dialog.Title>
          <Dialog.Content>
            <View style={styles.monthPickerWrap}>
              {salaryMonthOptions.map((m) => {
                const selected = salaryMonth === m;
                const isCurrent = m === monthKey;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setSalaryMonth(m);
                      setSalaryMonthPickerOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.monthPickCard,
                      selected ? styles.monthPickCardSelected : null,
                      isCurrent ? styles.monthPickCardCurrent : null,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text variant="titleSmall" style={[styles.bold, selected ? styles.monthPickTextSelected : null]} numberOfLines={1}>
                      {monthLabel(m)}
                    </Text>
                    <Text variant="bodySmall" style={selected ? styles.monthPickSubSelected : styles.monthPickSub} numberOfLines={1}>
                      {isCurrent ? 'Current month' : m}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSalaryMonthPickerOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={salaryPaymentModePickerOpen} onDismiss={() => setSalaryPaymentModePickerOpen(false)} style={scheme === 'dark' ? styles.dialogDark : styles.dialogLight}>
          <Dialog.Title>Select payment mode</Dialog.Title>
          <Dialog.Content>
            {(['Cash', 'UPI', 'Bank Transfer', 'Card'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  setSalaryPayMode(m);
                  setSalaryPaymentModePickerOpen(false);
                }}
                style={({ pressed }) => [styles.pickItem, pressed && styles.pressed]}
              >
                <Text variant="bodyMedium" style={textMain}>
                  {m}
                </Text>
              </Pressable>
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSalaryPaymentModePickerOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={attendanceMonthPickerOpen}
          onDismiss={() => setAttendanceMonthPickerOpen(false)}
          style={[scheme === 'dark' ? styles.dialogDark : styles.dialogLight, layoutMobile ? styles.monthPickerSheet : styles.monthPickerDialog]}
        >
          <Dialog.Title>Select month</Dialog.Title>
          <Dialog.Content>
            <View style={styles.monthPickerWrap}>
              {salaryMonthOptions.map((m) => {
                const selected = attendanceMonth === m;
                const isCurrent = m === monthKey;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setAttendanceMonth(m);
                      setAttendanceSelected(null);
                      setAttendanceMonthPickerOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.monthPickCard,
                      selected ? styles.monthPickCardSelected : null,
                      isCurrent ? styles.monthPickCardCurrent : null,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text variant="titleSmall" style={[styles.bold, selected ? styles.monthPickTextSelected : null]} numberOfLines={1}>
                      {monthLabel(m)}
                    </Text>
                    <Text variant="bodySmall" style={selected ? styles.monthPickSubSelected : styles.monthPickSub} numberOfLines={1}>
                      {isCurrent ? 'Current month' : m}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAttendanceMonthPickerOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={historyMemoMonthPickerOpen}
          onDismiss={() => setHistoryMemoMonthPickerOpen(false)}
          style={[scheme === 'dark' ? styles.dialogDark : styles.dialogLight, layoutMobile ? styles.monthPickerSheet : styles.monthPickerDialog]}
        >
          <Dialog.Title>Memo month</Dialog.Title>
          <Dialog.Content>
            <View style={styles.monthPickerWrap}>
              {salaryMonthOptions.map((m) => {
                const selected = historyMemoMonth === m;
                const isCurrent = m === monthKey;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setHistoryMemoMonth(m);
                      setHistoryMemoMonthPickerOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.monthPickCard,
                      selected ? styles.monthPickCardSelected : null,
                      isCurrent ? styles.monthPickCardCurrent : null,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text variant="titleSmall" style={[styles.bold, selected ? styles.monthPickTextSelected : null]} numberOfLines={1}>
                      {monthLabel(m)}
                    </Text>
                    <Text variant="bodySmall" style={selected ? styles.monthPickSubSelected : styles.monthPickSub} numberOfLines={1}>
                      {isCurrent ? 'Current month' : m}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setHistoryMemoMonthPickerOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={profileHistoryMonthPickerOpen}
          onDismiss={() => setProfileHistoryMonthPickerOpen(false)}
          style={[scheme === 'dark' ? styles.dialogDark : styles.dialogLight, layoutMobile ? styles.monthPickerSheet : styles.monthPickerDialog]}
        >
          <Dialog.Title>Profile history month</Dialog.Title>
          <Dialog.Content>
            <View style={styles.monthPickerWrap}>
              {salaryMonthOptions.map((m) => {
                const selected = profileHistoryMonth === m;
                const isCurrent = m === monthKey;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setProfileHistoryMonth(m);
                      setProfileHistoryMonthPickerOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.monthPickCard,
                      selected ? styles.monthPickCardSelected : null,
                      isCurrent ? styles.monthPickCardCurrent : null,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text variant="titleSmall" style={[styles.bold, selected ? styles.monthPickTextSelected : null]} numberOfLines={1}>
                      {monthLabel(m)}
                    </Text>
                    <Text variant="bodySmall" style={selected ? styles.monthPickSubSelected : styles.monthPickSub} numberOfLines={1}>
                      {isCurrent ? 'Current month' : m}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setProfileHistoryMonthPickerOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={historySalaryMemoMonthPickerOpen}
          onDismiss={() => setHistorySalaryMemoMonthPickerOpen(false)}
          style={[scheme === 'dark' ? styles.dialogDark : styles.dialogLight, layoutMobile ? styles.monthPickerSheet : styles.monthPickerDialog]}
        >
          <Dialog.Title>Salary memo month</Dialog.Title>
          <Dialog.Content>
            <View style={styles.monthPickerWrap}>
              {salaryMonthOptions.map((m) => {
                const selected = historySalaryMemoMonth === m;
                const isCurrent = m === monthKey;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setHistorySalaryMemoMonth(m);
                      setHistorySalaryMemoMonthPickerOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.monthPickCard,
                      selected ? styles.monthPickCardSelected : null,
                      isCurrent ? styles.monthPickCardCurrent : null,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text variant="titleSmall" style={[styles.bold, selected ? styles.monthPickTextSelected : null]} numberOfLines={1}>
                      {monthLabel(m)}
                    </Text>
                    <Text variant="bodySmall" style={selected ? styles.monthPickSubSelected : styles.monthPickSub} numberOfLines={1}>
                      {isCurrent ? 'Current month' : m}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setHistorySalaryMemoMonthPickerOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={attendanceEditOpen}
          onDismiss={() => setAttendanceEditOpen(false)}
          style={scheme === 'dark' ? styles.dialogDark : styles.dialogLight}
        >
          <Dialog.Title>Attendance</Dialog.Title>
          <Dialog.Content>
            <View style={{ gap: 12 }}>
              <View style={[styles.monthlySummaryCard, sectionCard]}>
                <Text variant="bodySmall" style={textSub}>
                  Selected Date
                </Text>
                <Text variant="titleSmall" style={[styles.bold, textMain]}>
                  {attendanceSelected?.dateIso ?? '—'}
                </Text>
              </View>

              {!attendanceSelectedEntry ? (
                <>
                  <Pressable onPress={() => setAttendanceStatusPickerOpen(true)} style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodySmall" style={textSub}>
                        Attendance Status
                      </Text>
                      <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                        {attendanceDraftStatus}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-down" size={18} color={scheme === 'dark' ? 'white' : COLORS.text} />
                  </Pressable>

                  <Text variant="bodySmall" style={textSub}>
                    Attendance is marked by admin only.
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.kvGrid}>
                    {[
                      { label: 'Current Attendance Status', value: attendanceSelectedEntry.attendanceStatus },
                      ...(attendanceSelectedEntry.attendanceStatus === 'Absent'
                        ? [
                            {
                              label: 'Covering route by',
                              value:
                                absentCoverForSelectedDate?.name ??
                                absentCoverForSelectedDate?.id ??
                                absentReplacementName ??
                                absentReplacementId ??
                                '—',
                            },
                          ]
                        : []),
                      { label: 'Route Name', value: (attendanceSelectedEntry as any)?.routeName ?? b?.primaryRouteName ?? '—' },
                      {
                        label: 'Attendance marked at',
                        value: formatUpdatedAtShort(attendanceSelectedEntry.updatedAt ?? attendanceSelectedEntry.createdAt),
                      },
                    ].map((x) => (
                      <View key={x.label} style={[styles.miniCard, sectionCard]}>
                        <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                          {x.label}
                        </Text>
                        <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={2}>
                          {x.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            {!attendanceSelectedEntry ? (
              <>
                <Button onPress={() => setAttendanceEditOpen(false)}>Cancel</Button>
                <Button
                  mode="contained"
                  onPress={() => {
                    if (attendanceDraftStatus === 'Absent') {
                      setAbsentFlowOpen(true);
                    } else {
                      void saveAttendanceStatusWrite(attendanceDraftStatus, { closeAfterSave: true });
                    }
                  }}
                  loading={update.isPending}
                  disabled={update.isPending}
                >
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button onPress={() => setAttendanceEditOpen(false)}>Cancel</Button>
                <Button
                  mode="outlined"
                  textColor={COLORS.danger}
                  onPress={deleteAttendanceForSelectedDate}
                  loading={update.isPending}
                  disabled={update.isPending}
                >
                  Delete
                </Button>
                <Button
                  mode="contained"
                  onPress={() => {
                    setAttendanceDraftStatus(deliveryBoyAdminAttendanceDraftFromStored(attendanceSelectedEntry.attendanceStatus));
                    setAttendanceStatusPickerOpen(true);
                  }}
                  loading={update.isPending}
                  disabled={update.isPending}
                >
                  Update
                </Button>
              </>
            )}
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={attendanceStatusPickerOpen}
          onDismiss={() => setAttendanceStatusPickerOpen(false)}
          style={scheme === 'dark' ? styles.dialogDark : styles.dialogLight}
        >
          <Dialog.Title>Select status</Dialog.Title>
          <Dialog.Content>
            {DELIVERY_BOY_ADMIN_ATTENDANCE_STATUS_OPTIONS.map((label) => {
              const dot = label === 'Absent' ? 'absent' : 'present';
              return (
                <Pressable
                  key={label}
                  onPress={() => {
                    setAttendanceDraftStatus(label);
                    setAttendanceStatusPickerOpen(false);
                    saveAttendanceForSelectedDate(label, { closeAfterSave: !attendanceSelectedEntry });
                  }}
                  style={({ pressed }) => [styles.pickItem, pressed && styles.pressed]}
                >
                  <View style={styles.statusPickRow}>
                    <View style={[styles.attDot, styles[`attDot_${dot}`]]} />
                    <Text variant="bodyMedium" style={textMain}>
                      {label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAttendanceStatusPickerOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={!!picker} onDismiss={() => setPicker(null)} style={scheme === 'dark' ? styles.dialogDark : styles.dialogLight}>
          <Dialog.Title>{picker?.kind === 'backup' ? 'Select Backup Delivery Boy' : 'Select Replacement Delivery Boy'}</Dialog.Title>
          <Dialog.Content>
            {(allBoys.data?.items ?? [])
              .filter((x) => x.status === 'Active' && x.id !== id)
              .map((x) => (
                <Pressable
                  key={x.id}
                  onPress={() => {
                    if (picker?.kind === 'backup') {
                      savePatch({ backupDeliveryBoyId: x.id, backupDeliveryBoyName: x.fullName });
                    } else {
                      savePatch({ replacementDeliveryBoyId: x.id, replacementDeliveryBoyName: x.fullName });
                    }
                    setPicker(null);
                  }}
                  style={({ pressed }) => [styles.pickItem, pressed && styles.pressed]}
                >
                  <Text variant="bodyMedium" style={textMain}>
                    {x.fullName} • {x.primaryRouteName}
                  </Text>
                </Pressable>
              ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPicker(null)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={attendanceCoverPickerOpen} onDismiss={() => setAttendanceCoverPickerOpen(false)} style={scheme === 'dark' ? styles.dialogDark : styles.dialogLight}>
          <Dialog.Title>Route cover for</Dialog.Title>
          <Dialog.Content>
            {(allBoys.data?.items ?? [])
              .filter((x) => x.status === 'Active' && x.id !== id)
              .map((x) => (
                <Pressable
                  key={x.id}
                  onPress={() => {
                    setAttendanceCoverForId(x.id);
                    setAttendanceCoverPickerOpen(false);
                  }}
                  style={({ pressed }) => [styles.pickItem, pressed && styles.pressed]}
                >
                  <Text variant="bodyMedium" style={textMain}>
                    {x.fullName} • {x.primaryRouteName}
                  </Text>
                </Pressable>
              ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAttendanceCoverPickerOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={absentFlowOpen} onDismiss={() => setAbsentFlowOpen(false)} style={scheme === 'dark' ? styles.dialogDark : styles.dialogLight}>
          <Dialog.Title>Absent for this day</Dialog.Title>
          <Dialog.Content>
            <View style={{ gap: 12 }}>
              <Text variant="bodySmall" style={textSub}>
                Date: {attendanceSelected?.dateIso ?? '—'}. A linked leave record (unpaid, for payroll) and optional replacement stay in sync with Salary
                and Leaves.
              </Text>
              <Pressable onPress={() => setAbsentReplPickerOpen(true)} style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodySmall" style={textSub}>
                    Who covered the route? (optional)
                  </Text>
                  <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                    {absentReplacementName ?? absentReplacementId ?? '— Tap to select'}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-down" size={18} color={scheme === 'dark' ? 'white' : COLORS.text} />
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Text variant="bodyMedium" style={textMain}>
                  Credit salary to cover person
                </Text>
                <Switch value={absentReplTransfer} onValueChange={setAbsentReplTransfer} />
              </View>
              <Text variant="bodySmall" style={textSub}>
                When enabled, the selected cover person receives route-coverage credit for this day (same per-day amount as on their Salary tab).
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAbsentFlowOpen(false)}>Cancel</Button>
            <Button mode="contained" onPress={() => confirmAbsentFromAttendance()} loading={update.isPending} disabled={update.isPending}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={absentReplPickerOpen} onDismiss={() => setAbsentReplPickerOpen(false)} style={scheme === 'dark' ? styles.dialogDark : styles.dialogLight}>
          <Dialog.Title>Cover person</Dialog.Title>
          <Dialog.Content>
            <Pressable
              onPress={() => {
                setAbsentReplacementId(undefined);
                setAbsentReplacementName(undefined);
                setAbsentReplPickerOpen(false);
              }}
              style={({ pressed }) => [styles.pickItem, pressed && styles.pressed]}
            >
              <Text variant="bodyMedium" style={textMain}>
                None
              </Text>
            </Pressable>
            {(allBoys.data?.items ?? [])
              .filter((x) => x.status === 'Active' && x.id !== id)
              .map((x) => (
                <Pressable
                  key={x.id}
                  onPress={() => {
                    setAbsentReplacementId(x.id);
                    setAbsentReplacementName(x.fullName);
                    setAbsentReplPickerOpen(false);
                  }}
                  style={({ pressed }) => [styles.pickItem, pressed && styles.pressed]}
                >
                  <Text variant="bodyMedium" style={textMain}>
                    {x.fullName} • {x.primaryRouteName}
                  </Text>
                </Pressable>
              ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAbsentReplPickerOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  rootClip: { overflow: 'hidden' },
  bgLight: { backgroundColor: COLORS.bg },
  bgDark: { backgroundColor: '#0B1220' },

  appBar: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  appBarStack: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  appBarRowMobile: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  appBarTitleStretch: { flex: 1, minWidth: 0, justifyContent: 'center' },
  appBarEditRow: { flexDirection: 'row', justifyContent: 'flex-end', width: '100%' },
  appBarLight: { backgroundColor: 'transparent' },
  appBarDark: { backgroundColor: 'transparent' },
  appBarSideLeft: { width: 44, alignItems: 'flex-start', justifyContent: 'center' },
  appBarCenter: { flex: 1, minWidth: 0, alignItems: 'flex-start', justifyContent: 'center' },
  appBarSideRight: { minWidth: 96, alignItems: 'flex-end', justifyContent: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },

  headerTitle: { fontWeight: '900', flexShrink: 1, textAlign: 'left', alignSelf: 'stretch' },
  headerTitleMobile: { fontSize: 17 },
  editPill: { height: 40, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  editPillCompact: { height: 34, paddingHorizontal: 10, borderRadius: 12, gap: 6 },

  tabsBar: { paddingHorizontal: 16, paddingBottom: 10 },
  tabsBarTablet: { paddingBottom: 12 },
  tabsBarLight: { backgroundColor: 'transparent' },
  tabsBarDark: { backgroundColor: 'transparent' },
  tabsRowScroll: { flexDirection: 'row', gap: 8 },
  tabsRowScrollMobile: { paddingHorizontal: 16, gap: 6 },
  tabsRowScrollMobileContent: { flexDirection: 'row', flexGrow: 1, gap: 6, paddingRight: 4, alignItems: 'center' },
  tabsRowFlex: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  tabsRowWrap: { flexWrap: 'wrap' },
  tabsRowNoWrap: { flexWrap: 'nowrap' },

  tabPill: { borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, height: 40 },
  tabPillMax: { maxWidth: 180 },
  tabPillCompact: { paddingHorizontal: 10, height: 36, flexShrink: 0 },
  tabPillActive: { backgroundColor: 'rgba(37,99,235,0.14)', borderColor: 'rgba(37,99,235,0.22)' },
  tabPillInactive: { backgroundColor: 'rgba(148,163,184,0.08)', borderColor: 'rgba(148,163,184,0.18)' },
  tabTextActive: { color: '#1D4ED8', fontWeight: '900' },
  tabTextInactive: { color: 'rgba(30,41,59,0.70)', fontWeight: '800' },
  tabTextCompact: { fontSize: 13 },

  bodyScroll: { flex: 1, overflow: 'hidden' },
  container: { padding: 16, paddingBottom: 24, gap: 12, maxWidth: '100%', width: '100%' },
  containerMobile: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 28 },
  containerDesktop: { maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 28, paddingBottom: 40, paddingTop: 20 },
  bold: { fontWeight: '900' },

  overviewWrap: { width: '100%', maxWidth: '100%', overflow: 'hidden' },
  overviewColumns: { width: '100%', maxWidth: '100%' },
  overviewColumnsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  overviewCol: { width: '100%', maxWidth: '100%', minWidth: 0 },
  overviewColFlex: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, maxWidth: '100%' },

  profileSummaryCard: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  profileSummaryCardLight: { backgroundColor: '#FFFFFF', borderColor: 'rgba(15,23,42,0.08)' },
  profileSummaryCardMobile: { paddingVertical: 12, paddingHorizontal: 14 },
  profileSummaryTitle: { fontWeight: '800', marginBottom: 10 },
  profileSummaryCols: { width: '100%', gap: 0 },
  profileSummaryColsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  profileSummaryCol: { flex: 1, minWidth: 0 },

  profileKvRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.35)',
    maxWidth: '100%',
  },
  profileKvRowCompact: { paddingVertical: 8, gap: 8 },
  profileKvLabel: { fontWeight: '700', flex: 1, minWidth: 0, maxWidth: '48%', paddingRight: 8 },
  profileKvValue: { flex: 1, minWidth: 0, textAlign: 'right', maxWidth: '52%' },
  profileStatusRow: { borderBottomWidth: 0 },
  profileStatusSeg: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    maxWidth: '52%',
    flexShrink: 0,
  },
  profileStatusSegDark: { borderColor: 'rgba(255,255,255,0.18)' },
  profileStatusSegBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  profileStatusSegBtnActive: { backgroundColor: 'rgba(37,99,235,0.16)' },
  profileStatusSegBtnActiveDark: { backgroundColor: 'rgba(96,165,250,0.22)' },
  profileStatusSegLabelActive: { color: '#1D4ED8', fontWeight: '900' },
  profileStatusSegLabelOnDark: { color: 'rgba(248,250,252,0.95)', fontWeight: '900' },

  ovCardLight: { backgroundColor: '#FFFFFF', borderColor: 'rgba(15,23,42,0.08)' },
  ovCardDark: { backgroundColor: 'rgba(15,23,42,0.92)', borderColor: 'rgba(255,255,255,0.10)' },

  topSummaryGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  topSummaryGridEqual: { alignContent: 'stretch' },
  topStatCard: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    overflow: 'hidden',
    minHeight: 102,
  },
  topStatCardInner: { flex: 1, justifyContent: 'space-between', minHeight: 74 },
  topStatTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  topStatPeriod: { fontWeight: '700', marginBottom: 4 },
  topStatCardFullMobile: {
    width: '100%',
    maxWidth: '100%',
    flexBasis: '100%',
    flexGrow: 0,
  },
  topStatCardHalfMobile: { flexGrow: 1, flexShrink: 1, flexBasis: '47%', minWidth: 0, maxWidth: '100%' },
  topStatCardPadMobile: { paddingVertical: 12, paddingHorizontal: 12, minHeight: 96 },
  topStatCardTablet: { flexGrow: 1, flexShrink: 1, flexBasis: '47%', minWidth: 0, maxWidth: '100%' },
  topStatCardDesktop: { flexGrow: 1, flexShrink: 1, flexBasis: '22%', minWidth: 0 },
  topStatCardLight: { backgroundColor: '#FFFFFF', borderColor: 'rgba(15,23,42,0.08)' },
  topStatCardDark: { backgroundColor: 'rgba(15,23,42,0.92)', borderColor: 'rgba(255,255,255,0.10)' },
  topStatLabel: { fontWeight: '800', flex: 1, minWidth: 0, paddingRight: 6 },
  topStatValue: { marginTop: 4, fontWeight: '900', flexShrink: 1 },

  sectionCard: { borderRadius: 16, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  sectionContent: { gap: 10 },
  kvGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 6 },
  miniCard: { flexGrow: 1, flexBasis: 160, minWidth: 0, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.08)' },
  headerCard: { padding: 12, borderRadius: 12, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerName: { fontWeight: '900' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeActive: { backgroundColor: 'rgba(37,99,235,0.16)' },
  badgeInactive: { backgroundColor: 'rgba(239,68,68,0.14)' },
  badgeTextActive: { color: '#1D4ED8', fontWeight: '900' },
  badgeTextInactive: { color: '#B91C1C', fontWeight: '900' },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  summaryCard: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    minHeight: 72,
    justifyContent: 'space-between',
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryLabel: { color: 'rgba(100,116,139,0.95)' },
  summaryValue: { fontWeight: '900' },
  summaryHint: { marginTop: 2 },
  summaryCard_blue: { backgroundColor: 'rgba(37,99,235,0.10)', borderColor: 'rgba(37,99,235,0.14)' },
  summaryCard_green: { backgroundColor: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.14)' },
  summaryCard_red: { backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.14)' },
  summaryCard_gray: { backgroundColor: 'rgba(148,163,184,0.10)', borderColor: 'rgba(148,163,184,0.14)' },

  attSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 2 },
  attMiniCard: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    justifyContent: 'space-between',
    minHeight: 72,
  },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, height: 38, maxWidth: 220 },
  chipActive: { backgroundColor: 'rgba(37,99,235,0.14)', borderColor: 'rgba(37,99,235,0.22)' },
  chipInactive: { backgroundColor: 'rgba(148,163,184,0.08)', borderColor: 'rgba(148,163,184,0.18)' },
  chipTextActive: { color: '#1D4ED8', fontWeight: '900' },
  chipTextInactive: { color: 'rgba(30,41,59,0.70)', fontWeight: '800' },

  calendarCard: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    padding: 10,
    backgroundColor: 'rgba(148,163,184,0.05)',
  },
  historyKindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' },
  calendarHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  monthNavCenter: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2 },
  monthNavBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.08)', alignItems: 'center', justifyContent: 'center' },
  monthNavBtnDisabled: { opacity: 0.55 },
  weekHeaderRow: { flexDirection: 'row' },
  weekHeaderCell: { flexGrow: 1, flexBasis: 0, textAlign: 'center', paddingVertical: 6, fontWeight: '800' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarGridTiny: { width: 360 },
  calBlank: { width: '14.2857%', aspectRatio: 1, padding: 2 },
  calCell: {
    width: '14.2857%',
    aspectRatio: 1,
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(255,255,255,0.70)',
    justifyContent: 'space-between',
  },
  calCellDesktop: { padding: 10 },
  calCellTablet: { padding: 8 },
  calCellMobile: { padding: 6 },
  calCellTiny: { width: 52, height: 52, padding: 5, aspectRatio: undefined },
  calCellPresentLight: { backgroundColor: 'rgba(34,197,94,0.22)', borderColor: 'rgba(34,197,94,0.55)' },
  calCellPresentDark: { backgroundColor: 'rgba(34,197,94,0.26)', borderColor: 'rgba(34,197,94,0.48)' },
  calCellAbsentLight: { backgroundColor: 'rgba(239,68,68,0.18)', borderColor: 'rgba(239,68,68,0.48)' },
  calCellAbsentDark: { backgroundColor: 'rgba(239,68,68,0.26)', borderColor: 'rgba(239,68,68,0.42)' },
  calTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calDayNum: { fontWeight: '900' },
  attDot: { width: 10, height: 10, borderRadius: 999 },
  attDot_present: { backgroundColor: 'rgba(34,197,94,0.95)' },
  attDot_absent: { backgroundColor: 'rgba(239,68,68,0.95)' },
  attDot_leave: { backgroundColor: 'rgba(245,158,11,0.95)' },
  attDot_weeklyOff: { backgroundColor: 'rgba(37,99,235,0.95)' },
  attDot_upcoming: { backgroundColor: 'rgba(148,163,184,0.95)' },
  attDot_none: { backgroundColor: 'rgba(148,163,184,0.35)' },
  calMeta: { color: 'rgba(30,41,59,0.70)', fontWeight: '800' },

  monthlySummaryCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    padding: 10,
    backgroundColor: 'rgba(148,163,184,0.05)',
    gap: 10,
  },

  monthCardsRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  monthMiniCard: {
    flexGrow: 1,
    flexBasis: 260,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    padding: 10,
    backgroundColor: 'rgba(148,163,184,0.05)',
    gap: 6,
  },
  monthMiniCardActive: { borderColor: 'rgba(37,99,235,0.22)', backgroundColor: 'rgba(37,99,235,0.08)' },
  monthMiniTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },


  monthCompareRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  monthBlock: {
    flexGrow: 1,
    flexBasis: 520,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    padding: 10,
    backgroundColor: 'rgba(148,163,184,0.05)',
  },
  monthBlockHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6 },

  salaryScreenContent: { gap: 16, overflow: 'hidden', width: '100%', maxWidth: '100%', alignSelf: 'stretch' },
  salaryScreenContentMobile: { gap: 12, paddingBottom: 8 },
  salaryScreenContentTablet: { gap: 14, paddingBottom: 4 },
  salaryScreenContentDesktop: { gap: 20, paddingBottom: 8 },
  salaryMonthHeaderOuter: { width: '100%', maxWidth: '100%' },
  salaryMonthHeaderRowDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  salaryMonthHeaderStack: { flexDirection: 'column', alignItems: 'stretch', gap: 10, marginBottom: 8 },
  salaryMonthTitle: { marginBottom: 0 },
  salaryMonthPickerPill: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(148,163,184,0.06)',
    maxWidth: '100%',
  },
  salaryMonthPickerPillFull: { alignSelf: 'stretch', justifyContent: 'center' },
  salaryMonthPickerPillTablet: { paddingVertical: 7, paddingHorizontal: 11 },
  salaryMonthPickerPillDark: { borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.06)' },
  salaryTopCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: '100%',
    alignItems: 'stretch',
  },
  salaryTopCardsGridMobile: { gap: 8 },
  salaryTopCardsGridTablet: { gap: 10 },
  salaryTopCardsGridDesktop: { gap: 14 },
  salaryTopCard: {
    flexGrow: 1,
    minWidth: 0,
    maxWidth: '100%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    justifyContent: 'space-between',
  },
  salaryTopCardTwoCol: { flexBasis: '47%', maxWidth: '50%' },
  salaryTopCardFour: { flexBasis: '23%', minWidth: 112, maxWidth: '25%' },
  salaryTopCardMobilePad: { paddingVertical: 10, paddingHorizontal: 10, minHeight: 78 },
  salaryTopCardTabletPad: { paddingVertical: 11, paddingHorizontal: 11, minHeight: 82 },
  salaryTopCardLight: { backgroundColor: '#FFFFFF', borderColor: 'rgba(15,23,42,0.08)' },
  salaryTopCardDark: { backgroundColor: 'rgba(15,23,42,0.92)', borderColor: 'rgba(255,255,255,0.10)' },
  salaryTextMetaMobile: { fontSize: 12, lineHeight: 16 },
  salaryTextValueMobile: { fontSize: 13 },
  salaryMobileTitle: { fontSize: 17 },
  salarySectionTitleMobile: { fontSize: 15 },
  salaryColumnWrap: { flexDirection: 'column', gap: 16, width: '100%', maxWidth: '100%' },
  salaryColumnWrapSplit: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 20,
    width: '100%',
    maxWidth: '100%',
    alignItems: 'flex-start',
  },
  salaryColumn: { flexGrow: 1, minWidth: 0, width: '100%', maxWidth: '100%', gap: 16 },
  salaryColumnDesk: { flex: 1, flexBasis: 0, minWidth: 0, maxWidth: '50%' },
  salaryWhiteCardPadTablet: { padding: 12 },
  salaryWhiteCardPadMobile: { padding: 10 },
  salaryNotePadTablet: { padding: 9 },
  salaryNotePadMobile: { padding: 8 },
  salaryFormulaPadTablet: { padding: 10 },
  salaryFormulaPadMobile: { padding: 9 },
  salaryTabKvRowMobile: { paddingVertical: 8, gap: 8 },
  paymentFieldsGridMobile: { width: '100%', maxWidth: '100%' },
  salaryInputFullMobile: { width: '100%', maxWidth: '100%', alignSelf: 'stretch' },
  salaryInputContentMobile: { minHeight: 40 },
  paySummaryGridMobile: { flexDirection: 'column', gap: 8 },
  paySummaryCardMobile: { flexBasis: 'auto', width: '100%', minWidth: '100%', minHeight: 76 },
  salaryPaymentPadTablet: { padding: 12 },
  salaryPaymentPadMobile: { padding: 10 },
  salaryPayModeRowMobile: { gap: 6, marginBottom: 10 },
  salaryPayModeChipMobile: { paddingHorizontal: 10, paddingVertical: 6, minHeight: 34 },
  salaryPayBtnMobile: { minHeight: 42 },
  salaryPayBtnContentMobile: { minHeight: 40 },
  salaryPayBtnLabelMobile: { fontSize: 14 },
  salaryWhiteCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    width: '100%',
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  salaryWhiteCardLight: { backgroundColor: '#FFFFFF', borderColor: 'rgba(15,23,42,0.08)' },
  salaryWhiteCardDark: { backgroundColor: 'rgba(15,23,42,0.92)', borderColor: 'rgba(255,255,255,0.10)' },
  salaryNoteCard: {
    marginTop: 4,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    backgroundColor: 'rgba(148,163,184,0.06)',
  },
  salaryNoteCardDark: { borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)' },
  salaryTabKvRowLast: { borderBottomWidth: 0 },
  salaryPaymentCard: { marginTop: 0 },
  salaryHistSection: { marginTop: 8, gap: 12, width: '100%', maxWidth: '100%' },
  salaryHistSectionDesktop: { marginTop: 12, gap: 16 },
  salaryHistControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', width: '100%', maxWidth: '100%' },
  salaryHistControlsStack: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  salaryHistControl: { flexGrow: 1, flexBasis: 140, minWidth: 0 },
  salaryHistControlFull: { flexBasis: 'auto', width: '100%', maxWidth: '100%', minWidth: 0 },
  salaryHistSearch: { flexGrow: 2, flexBasis: 200, minWidth: 0 },
  salaryHistSearchMobile: { width: '100%', maxWidth: '100%', flexGrow: 0, flexBasis: 'auto', minWidth: 0 },
  salaryHistExportBtnMobile: { alignSelf: 'stretch', width: '100%' },
  salaryHistList: { gap: 10, width: '100%', maxWidth: '100%' },
  salaryHistHScroll: { width: '100%', maxWidth: '100%' },
  salaryHistHScrollContent: { paddingBottom: 4, flexGrow: 1 },
  salaryHistTableInnerTablet: { minWidth: 720, maxWidth: '100%', paddingRight: 4 },
  salaryHistTableWrap: { width: '100%', maxWidth: '100%', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(148,163,184,0.14)' },
  salaryHistTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  salaryHistTableHeaderLight: { backgroundColor: 'rgba(148,163,184,0.10)', borderBottomColor: 'rgba(148,163,184,0.25)' },
  salaryHistTableHeaderDark: { backgroundColor: 'rgba(255,255,255,0.06)', borderBottomColor: 'rgba(255,255,255,0.10)' },
  salaryHistTh: { flex: 1, minWidth: 0, fontWeight: '800' },
  salaryHistThLabel: { fontWeight: '800' },
  salaryHistThRight: { textAlign: 'right' },
  salaryHistTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  salaryHistTableRowLight: { borderBottomColor: 'rgba(148,163,184,0.2)' },
  salaryHistTableRowDark: { borderBottomColor: 'rgba(255,255,255,0.08)' },
  salaryHistTableRowAltLight: { backgroundColor: 'rgba(148,163,184,0.04)' },
  salaryHistTableRowAltDark: { backgroundColor: 'rgba(255,255,255,0.03)' },
  salaryHistColMonth: { flex: 2, minWidth: 80, fontWeight: '700' },
  salaryHistColNum: { flex: 1, minWidth: 68, textAlign: 'right', fontWeight: '700' },
  salaryHistColStatus: { flex: 1, minWidth: 80, maxWidth: 128 },
  salaryHistColAction: { width: 88, minWidth: 88, alignItems: 'flex-end' },
  salaryHistCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    width: '100%',
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  salaryHistCardLight: { backgroundColor: '#FFFFFF', borderColor: 'rgba(15,23,42,0.08)' },
  salaryHistCardDark: { backgroundColor: 'rgba(15,23,42,0.92)', borderColor: 'rgba(255,255,255,0.10)' },
  salaryHistCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  salaryHistCardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  salaryHistStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, maxWidth: '100%' },
  salaryHistCardMobile: { padding: 10 },

  salaryTabSummaryCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    width: '100%',
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  salaryTabSummaryCardLight: { backgroundColor: '#FFFFFF', borderColor: 'rgba(15,23,42,0.08)' },
  salaryTabSummaryCardDark: { backgroundColor: 'rgba(15,23,42,0.92)', borderColor: 'rgba(255,255,255,0.10)' },
  salaryTabSummaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
  salaryTabKvGrid: { width: '100%' },
  salaryTabKvGridTwoCol: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12 },
  salaryTabKvRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.35)',
    width: '100%',
  },
  salaryTabKvRowDesktop: { width: '48%', maxWidth: '48%' },
  salaryTabKvLabel: { flex: 1, minWidth: 0, paddingRight: 8 },
  salaryTabKvValue: { flex: 1, minWidth: 0, textAlign: 'right' },
  salaryTabFormulaBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(148,163,184,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  salaryTabFormulaBoxDark: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)' },
  salaryTabFormulaLines: { marginTop: 8, gap: 4 },
  salaryTabEditableBlock: { marginTop: 16, gap: 10 },
  salaryPayModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  salaryPayModeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  salaryPayModeChipActive: { backgroundColor: 'rgba(37,99,235,0.14)', borderColor: 'rgba(37,99,235,0.28)' },
  salaryPayModeChipDark: { borderColor: 'rgba(255,255,255,0.18)' },
  salaryPayModeChipActiveDark: { backgroundColor: 'rgba(96,165,250,0.22)', borderColor: 'rgba(96,165,250,0.35)' },
  salaryPayModeChipLabelActive: { color: '#1D4ED8', fontWeight: '900' },

  salarySectionStack: { gap: 12, marginTop: 6 },
  salarySection: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.14)', padding: 10, backgroundColor: 'rgba(148,163,184,0.05)' },
  salarySectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  monthTag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(37,99,235,0.12)', borderWidth: 1, borderColor: 'rgba(37,99,235,0.14)' },
  monthTagText: { color: '#1D4ED8', fontWeight: '900' },

  compactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%' },

  paymentCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    backgroundColor: 'rgba(148,163,184,0.06)',
  },
  paymentCardPaid: { borderColor: 'rgba(34,197,94,0.18)' },
  paymentCardPartial: { borderColor: 'rgba(245,158,11,0.22)' },
  paymentCardUnpaid: { borderColor: 'rgba(239,68,68,0.18)' },
  paySummaryGrid: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paySummaryCard: { flexGrow: 1, flexBasis: 220, minWidth: 0, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.06)', paddingHorizontal: 10, paddingVertical: 10, gap: 6 },
  payHistoryItem: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.06)', paddingHorizontal: 10, paddingVertical: 10, gap: 6 },
  payHistoryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  payHistoryMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  paymentHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleTextPaid: { color: COLORS.accent, fontWeight: '900' },
  toggleTextUnpaid: { color: COLORS.danger, fontWeight: '900' },
  paymentHelper: { marginTop: 2 },
  helperPaid: { color: COLORS.accent, fontWeight: '800' },
  helperUnpaid: { color: COLORS.warning, fontWeight: '800' },
  paymentFieldsGrid: { marginTop: 10, gap: 10 },
  payFullBtn: { marginTop: 10, borderRadius: 12 },
  payFullBtnMobile: { width: '100%' },

  histControlsWrap: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  // Use width-based layout switching (histLayout) so it reacts smoothly on resize.
  histControlsDesktop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' },
  histControlsTablet: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  histControlsMobile: { flexDirection: 'column', alignItems: 'stretch' },
  fullWidth: { width: '100%' },
  histControl: { flexGrow: 1, flexBasis: 180, minWidth: 0 },
  histSearch: { flexGrow: 2, flexBasis: 260, minWidth: 220 },
  histExportBtnFull: { width: '100%' },

  histControlsMobileWrap: { marginTop: 10, gap: 10 },
  histControlsMobileRow2: { flexDirection: 'row', gap: 10 },
  histControlMobileHalf: { flex: 1, minWidth: 0 },
  pickerRowMobile: { height: 44, borderRadius: 12, paddingHorizontal: 10 },
  mobileControlText: { fontSize: 13 },
  histSearchMobile: { width: '100%' },
  searchContentMobile: { minHeight: 40 },
  histExportRowMobile: { flexDirection: 'row', justifyContent: 'flex-end' },
  histExportBtnMobile: { height: 40, paddingHorizontal: 0 },
  histExportBtnMobileContent: { height: 40, paddingHorizontal: 16 },
  histExportBtnMobileLabel: { fontSize: 13, fontWeight: '900' },
  trAlt: { backgroundColor: 'rgba(148,163,184,0.06)' },
  actionCell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 90 },
  histMobileCard: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.06)', padding: 10 },
  histMobileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  histMobileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 6, flexWrap: 'wrap' },

  tableWrap: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', overflow: 'hidden', backgroundColor: 'rgba(148,163,184,0.06)' },
  tableOuter: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, backgroundColor: 'rgba(148,163,184,0.10)' },
  tableHeaderDense: { paddingHorizontal: 8, paddingVertical: 8 },
  headerTextDense: { fontSize: 11 },
  headerTwoLine: { textAlign: 'center', lineHeight: 13 },
  th: { flex: 1, fontWeight: '900' },
  thFixed: { flexGrow: 0, flexShrink: 0, fontWeight: '900' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 },
  trDense: { paddingHorizontal: 8, paddingVertical: 6 },
  td: { flex: 1, paddingVertical: 6 },
  tdFixed: { flexGrow: 0, flexShrink: 0, paddingVertical: 6 },
  tdDense: { paddingVertical: 4, fontSize: 12 },
  trEmpty: { justifyContent: 'center', minHeight: 120 },
  emptyStateText: { textAlign: 'center' },
  trPlaceholder: { opacity: 0.7 },
  centerCell: { alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },

  colMonth: { minWidth: 120, maxWidth: 120 },
  colMoney: { minWidth: 120, maxWidth: 120 },
  colPending: { minWidth: 110, maxWidth: 110 },
  colDate: { minWidth: 160, maxWidth: 160, textAlign: 'center' },
  colMode: { minWidth: 140, maxWidth: 140 },
  colStatus: { minWidth: 100, maxWidth: 100 },
  colAction: { minWidth: 80, maxWidth: 80 },

  colMonthMobile: { minWidth: 90, maxWidth: 90 },
  colMoneyMobile: { minWidth: 90, maxWidth: 90 },
  colPendingMobile: { minWidth: 110, maxWidth: 110 },
  colDateMobile: { minWidth: 150, maxWidth: 150, textAlign: 'center' },
  colModeMobile: { minWidth: 100, maxWidth: 100 },
  colStatusMobile: { minWidth: 80, maxWidth: 80 },
  colActionMobile: { minWidth: 70, maxWidth: 70 },

  statusChipDense: { paddingHorizontal: 8, paddingVertical: 4 },
  viewBtnDense: { paddingHorizontal: 0 },
  viewBtnDenseLabel: { fontSize: 12 },

  pillInlineRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center' },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pillGreen: { backgroundColor: 'rgba(34,197,94,0.90)' },
  pillRed: { backgroundColor: 'rgba(239,68,68,0.90)' },
  pillText: { color: 'white', fontWeight: '900' },
  formGrid: { gap: 10 },

  payCtaLabel: { fontWeight: '900' },
  salaryStatusRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusPillCompact: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusPillPaid: { backgroundColor: 'rgba(34,197,94,0.90)' },
  statusPillPartial: { backgroundColor: 'rgba(245,158,11,0.92)' },
  statusPillPendingRed: { backgroundColor: 'rgba(239,68,68,0.90)' },
  statusPillText: { color: 'white', fontWeight: '900' },
  statusPillTextCompact: { fontSize: 11, fontWeight: '900' },
  pillRow: { height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.06)' },
  pickerRow: { height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.06)' },

  dialogLight: { backgroundColor: 'white' },
  dialogDark: { backgroundColor: '#0F172A' },
  pickItem: { paddingVertical: 10 },
  statusPickRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  statusChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },

  monthPickerDialog: { borderRadius: 16 },
  monthPickerSheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, marginTop: 'auto', marginBottom: 0 },
  monthPickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  monthPickCard: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(148,163,184,0.05)',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    gap: 2,
  },
  monthPickCardSelected: { backgroundColor: 'rgba(37,99,235,0.12)', borderColor: 'rgba(37,99,235,0.22)' },
  monthPickCardCurrent: { borderColor: 'rgba(37,99,235,0.22)' },
  monthPickTextSelected: { color: '#1D4ED8' },
  monthPickSub: { color: 'rgba(30,41,59,0.70)' },
  monthPickSubSelected: { color: 'rgba(29,78,216,0.95)', fontWeight: '800' },

  sectionCardLight: { backgroundColor: 'white', borderColor: 'rgba(37,99,235,0.10)' },
  sectionCardDark: { backgroundColor: 'rgba(15,23,42,0.70)', borderColor: 'rgba(255,255,255,0.10)' },
  textOnLight: { color: COLORS.text },
  textOnDark: { color: 'rgba(255,255,255,0.96)' },
  subtleOnLight: { color: 'rgba(30,41,59,0.70)' },
  subtleOnDark: { color: 'rgba(255,255,255,0.78)' },
});

