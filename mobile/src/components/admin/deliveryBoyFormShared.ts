import type { DeliveryBoyResponse } from '@/src/domain/deliveryBoys/dtos';
import { daysInMonth, roundMoney2 } from '@/src/domain/deliveryBoys/salary';
import { CreateDeliveryBoyRequestSchema } from '@/src/domain/deliveryBoys/validations';
import { strings } from '@/src/i18n/strings';

/** Form state, validation and payload building shared by the Add / Edit Delivery Boy screens. */

export type SimpleDeliveryBoyForm = {
  fullName: string;
  mobileNumber: string;
  primaryRouteName: string;
  joiningDate: string;
  monthlySalary: string;
  perDaySalary: string;
  salaryType: 'Fixed Monthly Salary' | 'Attendance Based Salary';
  status: 'Active' | 'Inactive';
};

export function emptySimpleDeliveryBoyForm(): SimpleDeliveryBoyForm {
  return {
    fullName: '',
    mobileNumber: '',
    primaryRouteName: '',
    joiningDate: '',
    monthlySalary: '',
    perDaySalary: '',
    salaryType: 'Fixed Monthly Salary',
    status: 'Active',
  };
}

function isoToDdMmYyyy(iso: string | undefined): string {
  if (!iso) return '';
  // Date-only strings parse as UTC midnight in `new Date()`, which shifts a day west of UTC; read them as local.
  const ymd = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = ymd ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function calendarMonthKeyNow(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

/** Days in the current calendar month — the divisor when converting between monthly and per-day pay. */
export function daysThisMonth(): number {
  return daysInMonth(calendarMonthKeyNow());
}

export function parseMonthlyRupees(s: string): number {
  const t = s.replace(/\D/g, '');
  if (!t) return 0;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : 0;
}

export function parsePerDayAmount(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Switching salary type keeps the amounts in step: the other field is recomputed from the one that has a value. */
export function applySalaryTypeSwitch(
  s: SimpleDeliveryBoyForm,
  nextType: SimpleDeliveryBoyForm['salaryType'],
): SimpleDeliveryBoyForm {
  if (nextType === s.salaryType) return s;
  const days = daysThisMonth();
  const m = parseMonthlyRupees(s.monthlySalary);
  const p = parsePerDayAmount(s.perDaySalary);

  if (nextType === 'Fixed Monthly Salary') {
    if (m > 0) {
      return { ...s, salaryType: nextType, perDaySalary: String(roundMoney2(m / days)) };
    }
    if (p !== undefined && p > 0) {
      return { ...s, salaryType: nextType, monthlySalary: String(Math.round(p * days)) };
    }
    return { ...s, salaryType: nextType };
  }

  if (p !== undefined && p > 0) {
    return { ...s, salaryType: nextType, monthlySalary: String(Math.round(p * days)) };
  }
  if (m > 0) {
    return { ...s, salaryType: nextType, perDaySalary: String(roundMoney2(m / days)) };
  }
  return { ...s, salaryType: nextType };
}

export function simpleFormFromDeliveryBoy(b: DeliveryBoyResponse): SimpleDeliveryBoyForm {
  const type = b.salaryType ?? 'Fixed Monthly Salary';
  const days = daysThisMonth();
  let monthlySalary = String(b.monthlySalary ?? '');
  let perDaySalary = b.perDaySalary != null ? String(b.perDaySalary) : '';

  if (type === 'Attendance Based Salary') {
    const pd = b.perDaySalary != null && Number(b.perDaySalary) > 0 ? Number(b.perDaySalary) : undefined;
    if (pd !== undefined) {
      perDaySalary = String(roundMoney2(pd));
      monthlySalary = String(Math.round(pd * days));
    }
  } else if (type === 'Fixed Monthly Salary') {
    const m = Number(b.monthlySalary ?? 0);
    if (m > 0 && b.perDaySalary == null) {
      perDaySalary = String(roundMoney2(m / days));
    }
  }

  return {
    fullName: b.fullName ?? '',
    mobileNumber: b.mobileNumber ?? '',
    primaryRouteName: b.primaryRouteName ?? '',
    joiningDate: isoToDdMmYyyy(b.joiningDate),
    monthlySalary,
    perDaySalary,
    salaryType: type,
    status: b.status ?? 'Active',
  };
}

export function ddmmyyyyToIso(value: string): string | null {
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return `${String(yyyy)}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function buildCreatePayloadFromSimpleForm(form: SimpleDeliveryBoyForm, joiningIso: string) {
  const monthly = parseMonthlyRupees(form.monthlySalary);
  const manualPerDay = parsePerDayAmount(form.perDaySalary);
  // Fixed Monthly: the per-day field is a read-only preview for this month; payroll derives per-day from the
  // target month's days, so persisting it here would freeze the wrong rate for other months.
  const perDaySalary: number | undefined = form.salaryType === 'Attendance Based Salary' ? manualPerDay : undefined;
  return {
    fullName: form.fullName.trim(),
    mobileNumber: form.mobileNumber.trim(),
    primaryRouteName: form.primaryRouteName.trim(),
    joiningDate: joiningIso,
    monthlySalary: form.salaryType === 'Attendance Based Salary' ? 0 : monthly,
    salaryType: form.salaryType,
    perDaySalary,
    status: form.status,
    appAccessEnabled: true as const,
  };
}

export function buildUpdatePayloadFromSimpleForm(form: SimpleDeliveryBoyForm, joiningIso: string) {
  const p = buildCreatePayloadFromSimpleForm(form, joiningIso);
  return {
    fullName: p.fullName,
    mobileNumber: p.mobileNumber,
    primaryRouteName: p.primaryRouteName,
    joiningDate: p.joiningDate,
    monthlySalary: p.monthlySalary,
    salaryType: p.salaryType,
    perDaySalary: p.perDaySalary,
    status: p.status,
  };
}

export function validateSimpleDeliveryBoyForm(form: SimpleDeliveryBoyForm): Record<string, string> {
  const t = strings('deliveryBoys').errors;
  const errs: Record<string, string> = {};
  const joiningIso = ddmmyyyyToIso(form.joiningDate.trim());
  if (!form.joiningDate.trim()) errs.joiningDate = t.joiningDateRequired;
  else if (!joiningIso) errs.joiningDate = t.dateInvalid;

  const monthly = parseMonthlyRupees(form.monthlySalary);
  if (form.salaryType === 'Fixed Monthly Salary') {
    if (!monthly || monthly <= 0) errs.monthlySalary = t.monthlySalaryRequired;
  }

  if (form.salaryType === 'Attendance Based Salary') {
    const pd = parsePerDayAmount(form.perDaySalary);
    if (pd === undefined || pd <= 0) errs.perDaySalary = t.perDaySalaryRequired;
  }

  const payload = buildCreatePayloadFromSimpleForm(form, joiningIso ?? '');
  const parsed = CreateDeliveryBoyRequestSchema.safeParse(payload);
  if (!parsed.success) {
    for (const iss of parsed.error.issues) {
      const key = String(iss.path[0] ?? '_form');
      if (!errs[key]) errs[key] = iss.message;
    }
  }

  return errs;
}
