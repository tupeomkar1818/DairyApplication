import { buildMyAttendanceDays, buildMySalaryMonth, type MyAttendanceDay } from '@/src/components/delivery/mySalary';
import type { DeliveryBoy } from '@/src/domain/deliveryBoys/entities';
import type { DeliveryBoyResponse } from '@/src/domain/deliveryBoys/dtos';
import { filterBoys, sum, type ReportData } from '@/src/domain/reports/data';
import { dayOf, inRange, monthsOfRange, type ReportRange } from '@/src/domain/reports/dateRange';
import { formatReportDate, percentOf, paymentModeLabel, reportStatusLabel } from '@/src/domain/reports/format';
import type { ReportDocument, ReportFilterValues, ReportTable } from '@/src/domain/reports/model';
import { strings } from '@/src/i18n/strings';

/**
 * The team: attendance day by day and salary. Both reuse the payroll rules the Salary tab and the delivery app use —
 * a present day earns the day rate, a day covering an absent colleague's route earns that colleague's rate.
 */

const text = (value: unknown) => String(value ?? '').trim();

/** Attendance days of one boy inside the range, oldest first (future days and days outside employment left out). */
export function attendanceDaysInRange(
  boy: DeliveryBoyResponse,
  allBoys: readonly DeliveryBoyResponse[],
  range: ReportRange,
  today: string,
): MyAttendanceDay[] {
  const upTo = range.toYmd < today ? range.toYmd : today;
  const out: MyAttendanceDay[] = [];
  for (const month of monthsOfRange(range)) {
    for (const day of buildMyAttendanceDays(boy as DeliveryBoy, allBoys as DeliveryBoy[], month, upTo)) {
      if (inRange(day.dateYmd, range)) out.push(day);
    }
  }
  return out.sort((a, b) => a.dateYmd.localeCompare(b.dateYmd));
}

function attendanceSummary(days: readonly MyAttendanceDay[]) {
  const present = days.filter((d) => d.status === 'Present').length;
  const absent = days.filter((d) => d.status === 'Absent').length;
  const notMarked = days.filter((d) => d.status === 'Not marked').length;
  const other = days.length - present - absent - notMarked;
  const cover = days.filter((d) => !!d.coverNote).length;
  return { present, absent, notMarked, other, cover, pct: percentOf(present, present + absent) };
}

export function buildAttendanceReport(
  data: ReportData,
  range: ReportRange,
  filters: ReportFilterValues,
  options: { title?: string; kind?: string; subject?: string; showDays?: boolean } = {},
): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const boys = filterBoys(data.boys, filters).filter((b) => b.status !== 'Inactive' || options.showDays);
  const perBoy = boys.map((b) => ({ b, days: attendanceDaysInRange(b, data.boys, range, data.today) }));
  const all = perBoy.flatMap((x) => x.days);
  const s = attendanceSummary(all);

  const tables: ReportTable[] = [];
  if (!options.showDays || perBoy.length > 1) {
    tables.push({
      id: 'byBoy',
      title: t.tables.byDeliveryBoy,
      columns: [
        { key: 'name', label: L.deliveryBoy, kind: 'text', primary: true },
        { key: 'route', label: L.route, kind: 'text' },
        { key: 'present', label: L.present, kind: 'number' },
        { key: 'absent', label: L.absent, kind: 'number' },
        { key: 'notMarked', label: L.notMarked, kind: 'number' },
        { key: 'cover', label: L.coverDays, kind: 'number' },
        { key: 'pct', label: L.attendance, kind: 'percent' },
      ],
      rows: perBoy
        .map(({ b, days }) => {
          const x = attendanceSummary(days);
          return {
            name: text(b.fullName),
            route: text(b.primaryRouteName) || '—',
            present: x.present,
            absent: x.absent,
            notMarked: x.notMarked,
            cover: x.cover,
            pct: x.present + x.absent ? x.pct : null,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
      totals: { name: null, route: null, present: s.present, absent: s.absent, notMarked: s.notMarked, cover: s.cover, pct: s.present + s.absent ? s.pct : null },
      emptyText: t.attendance.emptyBoys,
    });
  }

  if (options.showDays || perBoy.length === 1) {
    tables.push({
      id: 'days',
      title: t.attendance.daysTitle,
      columns: [
        { key: 'date', label: L.date, kind: 'date', primary: true },
        ...(perBoy.length > 1 ? [{ key: 'name', label: L.deliveryBoy, kind: 'text' as const }] : []),
        { key: 'status', label: L.status, kind: 'text' },
        { key: 'note', label: L.note, kind: 'text' },
        { key: 'earned', label: L.earned, kind: 'money' },
      ],
      rows: perBoy
        .flatMap(({ b, days }) =>
          days.map((d) => ({
            date: d.dateYmd,
            name: text(b.fullName),
            status: reportStatusLabel(d.status),
            note: [d.coverNote, d.coveredByName ? t.attendance.coveredBy(d.coveredByName) : ''].filter(Boolean).join(' · ') || '—',
            earned: d.earned,
          })),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
      totals: { date: null, name: null, status: null, note: null, earned: sum(all, (d) => d.earned) },
      emptyText: t.attendance.emptyDays,
    });
  }

  return {
    kind: options.kind ?? 'attendance',
    title: options.title ?? t.catalog.attendance.title,
    subject: options.subject,
    range,
    generatedAtIso: data.nowIso,
    stats: [
      { label: L.presentDays, value: s.present, kind: 'number', tone: 'good' },
      { label: L.absentDays, value: s.absent, kind: 'number', tone: s.absent ? 'bad' : 'default' },
      { label: L.notMarked, value: s.notMarked, kind: 'number', tone: s.notMarked ? 'warn' : 'default' },
      { label: L.coverDays, value: s.cover, kind: 'number', hint: t.attendance.coverHint },
      { label: L.attendance, value: s.present + s.absent ? s.pct : '—', kind: s.present + s.absent ? 'percent' : 'text' },
    ],
    trend: undefined,
    tables,
    notes: [t.attendance.notePercent, t.attendance.noteLeftOut],
  };
}

type MoneyEntry = { ymd: string; boy: DeliveryBoyResponse; kind: 'Advance' | 'Salary'; amount: number; mode: string; reference: string; note: string; month: string };

function salaryEntriesInRange(boys: readonly DeliveryBoyResponse[], range: ReportRange): MoneyEntry[] {
  const out: MoneyEntry[] = [];
  for (const boy of boys) {
    for (const rec of boy.salaryHistory ?? []) {
      for (const a of rec.advanceSalaryEntries ?? []) {
        const ymd = dayOf(a.date);
        if (!inRange(ymd, range)) continue;
        out.push({ ymd, boy, kind: 'Advance', amount: Math.max(0, Number(a.amount ?? 0)), mode: text(a.paymentMode), reference: text(a.transactionId), note: text(a.purpose), month: rec.salaryMonth });
      }
      for (const p of rec.payments ?? []) {
        const ymd = dayOf(p.date);
        if (!inRange(ymd, range)) continue;
        out.push({
          ymd,
          boy,
          kind: p.kind === 'Advance' ? 'Advance' : 'Salary',
          amount: Math.max(0, Number(p.amountPaid ?? 0)),
          mode: text(p.paymentMode),
          reference: text(p.transactionId),
          note: text(p.purpose),
          month: rec.salaryMonth,
        });
      }
    }
  }
  return out.sort((a, b) => b.ymd.localeCompare(a.ymd));
}

export function buildSalaryReport(
  data: ReportData,
  range: ReportRange,
  filters: ReportFilterValues,
  options: { title?: string; kind?: string; subject?: string; showMonths?: boolean } = {},
): ReportDocument {
  const t = strings('reports');
  const L = t.labels;
  const boys = filterBoys(data.boys, filters);
  const lastMonth = (range.toYmd < data.today ? range.toYmd : data.today).slice(0, 7);
  const months = monthsOfRange(range).filter((m) => m <= data.today.slice(0, 7));

  const perBoy = boys
    .map((b) => {
      const days = attendanceDaysInRange(b, data.boys, range, data.today);
      const month = buildMySalaryMonth(b as DeliveryBoy, data.boys as DeliveryBoy[], lastMonth, data.today);
      return { b, days, earned: sum(days, (d) => d.earned), month };
    })
    // Inactive boys only when they earned or were paid something in the range.
    .filter((x) => x.b.status !== 'Inactive' || x.earned > 0);
  const entries = salaryEntriesInRange(perBoy.map((x) => x.b), range);

  const earned = sum(perBoy, (x) => x.earned);
  const advances = sum(entries.filter((e) => e.kind === 'Advance'), (e) => e.amount);
  const paid = sum(entries.filter((e) => e.kind === 'Salary'), (e) => e.amount);
  const pendingNow = sum(perBoy, (x) => x.month.pending);

  const tables: ReportTable[] = [
    {
      id: 'byBoy',
      title: t.tables.byDeliveryBoy,
      columns: [
        { key: 'name', label: L.deliveryBoy, kind: 'text', primary: true },
        { key: 'type', label: L.salaryType, kind: 'text' },
        { key: 'present', label: L.presentDays, kind: 'number' },
        { key: 'earned', label: L.earnedInPeriod, kind: 'money' },
        { key: 'advances', label: L.advancesPaid, kind: 'money' },
        { key: 'paid', label: L.salaryPaid, kind: 'money' },
        { key: 'pending', label: t.salary.pendingColumn(formatReportDate(lastMonth)), kind: 'money' },
      ],
      rows: perBoy
        .map((x) => ({
          name: text(x.b.fullName),
          type: x.b.salaryType === 'Attendance Based Salary' ? t.salary.perDay : t.salary.monthly,
          present: x.days.filter((d) => d.status === 'Present').length,
          earned: x.earned,
          advances: sum(entries.filter((e) => e.boy.id === x.b.id && e.kind === 'Advance'), (e) => e.amount),
          paid: sum(entries.filter((e) => e.boy.id === x.b.id && e.kind === 'Salary'), (e) => e.amount),
          pending: x.month.pending,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      totals: { name: null, type: null, present: null, earned, advances, paid, pending: pendingNow },
      emptyText: t.attendance.emptyBoys,
    },
  ];

  if (options.showMonths || perBoy.length === 1) {
    tables.push({
      id: 'months',
      title: t.salary.monthsTitle,
      note: t.salary.monthsNote,
      columns: [
        { key: 'month', label: L.month, kind: 'date', primary: true },
        ...(perBoy.length > 1 ? [{ key: 'name', label: L.deliveryBoy, kind: 'text' as const }] : []),
        { key: 'present', label: L.present, kind: 'number' },
        { key: 'bonus', label: L.bonus, kind: 'money' },
        { key: 'deduction', label: L.deduction, kind: 'money' },
        { key: 'earned', label: L.salaryForMonth, kind: 'money' },
        { key: 'advance', label: L.advance, kind: 'money' },
        { key: 'paid', label: L.paid, kind: 'money' },
        { key: 'pending', label: L.pending, kind: 'money' },
        { key: 'status', label: L.status, kind: 'text' },
      ],
      rows: perBoy
        .flatMap((x) =>
          months.map((m) => {
            const s = buildMySalaryMonth(x.b as DeliveryBoy, data.boys as DeliveryBoy[], m, data.today);
            return {
              month: m,
              name: text(x.b.fullName),
              present: s.presentDays,
              bonus: s.bonus,
              deduction: s.deduction,
              earned: s.earned,
              advance: s.advanceTaken,
              paid: s.paidToDate,
              pending: s.pending,
              status: reportStatusLabel(s.status),
            };
          }),
        )
        .sort((a, b) => b.month.localeCompare(a.month) || a.name.localeCompare(b.name)),
      emptyText: t.salary.emptyMonths,
    });
  }

  tables.push({
    id: 'payments',
    title: t.salary.paymentsTitle,
    columns: [
      { key: 'date', label: L.date, kind: 'date' },
      { key: 'name', label: L.deliveryBoy, kind: 'text', primary: true },
      { key: 'kind', label: L.type, kind: 'text' },
      { key: 'month', label: L.forMonth, kind: 'date' },
      { key: 'mode', label: L.mode, kind: 'text' },
      { key: 'reference', label: L.reference, kind: 'text' },
      { key: 'amount', label: L.amount, kind: 'money' },
    ],
    rows: entries.map((e) => ({
      date: e.ymd,
      name: text(e.boy.fullName),
      kind: e.kind === 'Advance' ? t.salary.advance : t.salary.salary,
      month: e.month,
      mode: e.mode ? paymentModeLabel(e.mode) : '—',
      reference: e.reference || '—',
      amount: e.amount,
    })),
    totals: { date: null, name: null, kind: null, month: null, mode: null, reference: null, amount: advances + paid },
    emptyText: t.salary.emptyPayments,
  });

  return {
    kind: options.kind ?? 'salary',
    title: options.title ?? t.catalog.salary.title,
    subject: options.subject,
    range,
    generatedAtIso: data.nowIso,
    stats: [
      { label: L.earnedInPeriod, value: earned, kind: 'money', tone: 'good', hint: t.salary.earnedHint },
      { label: L.advancesPaid, value: advances, kind: 'money' },
      { label: L.salaryPaid, value: paid, kind: 'money' },
      { label: t.salary.pendingFor(formatReportDate(lastMonth)), value: pendingNow, kind: 'money', tone: pendingNow > 0 ? 'warn' : 'default' },
    ],
    tables,
    notes: [
      t.salary.noteEarned,
      t.salary.notePaidDay,
    ],
  };
}
