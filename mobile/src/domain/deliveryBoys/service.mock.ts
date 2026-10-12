import { roundMoney2 } from '@/src/domain/deliveryBoys/salary';
import type { IDeliveryBoyService } from '@/src/domain/deliveryBoys/service.interface';
import { DomainError } from '@/src/domain/shared/errors';
import { strings } from '@/src/i18n/strings';
import type { CreateDeliveryBoyRequest, DeliveryBoyListResponse, DeliveryBoyResponse, UpdateDeliveryBoyRequest } from '@/src/domain/deliveryBoys/dtos';
import type { DeliveryBoy as DeliveryBoyEntity } from '@/src/domain/deliveryBoys/entities';
import {
  assertMobileFree,
  moveLoginToMobile,
  removeLoginFor,
  syncCustomersWithDeliveryBoy,
} from '@/src/infrastructure/accountLinks';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';
import { DELIVERY_BOYS_STORE_KEY } from '@/src/infrastructure/storage/keys';

const DEFAULT_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function calendarMonthKeyNow(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

async function readDeliveryBoys(): Promise<DeliveryBoyEntity[]> {
  return (await readJson<DeliveryBoyEntity[]>(DELIVERY_BOYS_STORE_KEY)) ?? [];
}

async function writeDeliveryBoys(items: DeliveryBoyEntity[]): Promise<void> {
  await writeJson(DELIVERY_BOYS_STORE_KEY, items);
}

/** Migrate legacy advance rows out of `payments` into `advanceSalaryEntries`; keep final settlement lines only in `payments`. */
function normalizeSalaryHistoryRow(x: any) {
  const paymentsRaw = (x?.payments ?? []).map((p: any) => ({
    ...p,
    amountPaid: Number(p?.amountPaid ?? 0),
    remainingPendingAmount: Number(p?.remainingPendingAmount ?? 0),
    kind: p?.kind === 'Advance' || p?.kind === 'Salary' ? p.kind : undefined,
    purpose: typeof p?.purpose === 'string' ? p.purpose : undefined,
  }));
  const advFromPayments = paymentsRaw
    .filter((p: any) => p.kind === 'Advance')
    .map((p: any) => ({
      id: p.id,
      createdAt: p.createdAt ?? new Date().toISOString(),
      updatedAt: p.updatedAt ?? new Date().toISOString(),
      date: p.date,
      amount: p.amountPaid,
      paymentMode: p.paymentMode,
      transactionId: p.transactionId,
      purpose: p.purpose,
    }));
  let advanceSalaryEntries = (x?.advanceSalaryEntries ?? []).map((e: any) => ({
    ...e,
    amount: Number(e?.amount ?? 0),
    paymentMode: e?.paymentMode,
    date: e?.date,
    transactionId: e?.transactionId,
    purpose: e?.purpose,
    createdAt: e?.createdAt,
    updatedAt: e?.updatedAt,
  }));
  if (!advanceSalaryEntries.length && advFromPayments.length) {
    advanceSalaryEntries = advFromPayments;
  }
  const payments = paymentsRaw.filter((p: any) => p.kind !== 'Advance');
  const advanceTaken =
    x?.advanceTaken !== undefined
      ? Number(x.advanceTaken)
      : advanceSalaryEntries.reduce((s: number, e: any) => roundMoney2(s + Number(e.amount ?? 0)), 0);
  const manual = x?.manualPaymentStatus;
  return {
    ...x,
    baseSalary: Number(x?.baseSalary ?? 0),
    finalSalary: Number(x?.finalSalary ?? 0),
    paidAmount: x?.paidAmount !== undefined ? Number(x.paidAmount) : undefined,
    pendingAmount: x?.pendingAmount !== undefined ? Number(x.pendingAmount) : undefined,
    bonusAmount: x?.bonusAmount !== undefined ? Number(x.bonusAmount) : undefined,
    deductionAmount: x?.deductionAmount !== undefined ? Number(x.deductionAmount) : undefined,
    previousPendingSalary: x?.previousPendingSalary !== undefined ? Number(x.previousPendingSalary) : undefined,
    previousOverpayment: x?.previousOverpayment !== undefined ? Number(x.previousOverpayment) : undefined,
    finalSalaryOverride: x?.finalSalaryOverride !== undefined ? Number(x.finalSalaryOverride) : undefined,
    paymentStatusSource: x?.paymentStatusSource === 'Manual' ? 'Manual' : x?.paymentStatusSource === 'Auto' ? 'Auto' : undefined,
    manualPaymentStatus:
      manual === 'Paid' || manual === 'Unpaid' || manual === 'Partial' ? manual : undefined,
    advanceSalaryEntries,
    advanceTaken,
    payments,
  };
}

function normalizeDeliveryBoy(b: DeliveryBoyEntity): DeliveryBoyEntity {
  return {
    ...b,
    fullName: (b as any).fullName ?? (b as any).name ?? '',
    mobileNumber: b.mobileNumber ?? '',
    primaryRouteName: (b as any).primaryRouteName ?? (b as any).routeName ?? '',
    assignedRoutes: (b as any).assignedRoutes ?? [((b as any).primaryRouteName ?? (b as any).routeName ?? '').trim()].filter(Boolean),
    joiningDate: (b as any).joiningDate ?? b.createdAt ?? nowIso(),
    salaryType: (b as any).salaryType ?? 'Fixed Monthly Salary',
    monthlySalary: Number((b as any).monthlySalary ?? (b as any).baseSalary ?? 0),
    perDaySalary: (b as any).perDaySalary !== undefined ? Number((b as any).perDaySalary) : undefined,
    incentiveAmount: (b as any).incentiveAmount !== undefined ? Number((b as any).incentiveAmount) : undefined,
    pendingSalaryAmount: (b as any).pendingSalaryAmount !== undefined ? Number((b as any).pendingSalaryAmount) : undefined,
    salaryPaidStatus: (b as any).salaryPaidStatus,
    salaryPaidDate: (b as any).salaryPaidDate,
    status: (b as any).status ?? ((b as any).isActive === false ? 'Inactive' : 'Active'),
    appAccessEnabled: typeof (b as any).appAccessEnabled === 'boolean' ? (b as any).appAccessEnabled : true,
    shiftTiming: (b as any).shiftTiming ?? 'Morning',
    weeklyOffDay: (b as any).weeklyOffDay ?? 'Sunday',
    photoUri: (b as any).photoUri,
    extraRoutePaymentAmount:
      (b as any).extraRoutePaymentAmount !== undefined ? Number((b as any).extraRoutePaymentAmount) : undefined,
    replacementPaymentAmount:
      (b as any).replacementPaymentAmount !== undefined ? Number((b as any).replacementPaymentAmount) : undefined,
    paidLeaveAllowedPerMonth:
      (b as any).paidLeaveAllowedPerMonth !== undefined ? Number((b as any).paidLeaveAllowedPerMonth) : undefined,
    leaveSalaryRule: (b as any).leaveSalaryRule,
    sickLeavePaid: typeof (b as any).sickLeavePaid === 'boolean' ? (b as any).sickLeavePaid : undefined,
    temporaryReplacementAllowed:
      typeof (b as any).temporaryReplacementAllowed === 'boolean' ? (b as any).temporaryReplacementAllowed : undefined,
    attendance: (b as any).attendance ?? [],
    leaves: (b as any).leaves ?? [],
    replacements: (b as any).replacements ?? [],
    routeCoverageCredits: (b as any).routeCoverageCredits ?? [],
    salaryHistory: ((b as any).salaryHistory ?? []).map((x: any) => normalizeSalaryHistoryRow(x)),
    performance: (b as any).performance ?? [],
    complaints: (b as any).complaints ?? [],
    audit: (b as any).audit ?? [],
  };
}

async function loadDeliveryBoys(): Promise<DeliveryBoyEntity[]> {
  const existing = await readDeliveryBoys();
  if (existing.length > 0) {
    const normalized = existing.map(normalizeDeliveryBoy);
    const changed = normalized.some((b, i) => {
      const prev = existing[i] as any;
      return prev?.status !== b.status || prev?.primaryRouteName !== b.primaryRouteName;
    });
    if (changed) await writeDeliveryBoys(normalized);
    return normalized;
  }

  // A fresh store stays empty: every delivery partner is added by the admin.
  return [];
}

export class DeliveryBoyServiceMock implements IDeliveryBoyService {
  async list(): Promise<DeliveryBoyListResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await loadDeliveryBoys();
    return { items: items as unknown as DeliveryBoyResponse[], total: items.length };
  }

  async getById(id: string): Promise<DeliveryBoyResponse | null> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await loadDeliveryBoys();
    const found = items.find((b) => b.id === id);
    return found ? (found as unknown as DeliveryBoyResponse) : null;
  }

  async create(data: CreateDeliveryBoyRequest): Promise<DeliveryBoyResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await loadDeliveryBoys();
    // One number, one person: not a customer's, another partner's or the admin's number.
    await assertMobileFree(data.mobileNumber, {});
    const now = nowIso();

    const created: DeliveryBoyEntity = {
      id: newId('db'),
      fullName: data.fullName.trim(),
      mobileNumber: data.mobileNumber.trim(),
      alternateMobileNumber: data.alternateMobileNumber?.trim() ? data.alternateMobileNumber.trim() : undefined,
      address: data.address?.trim() ? data.address.trim() : undefined,
      aadhaarNumber: data.aadhaarNumber?.trim() ? data.aadhaarNumber.trim() : undefined,
      panNumber: data.panNumber?.trim() ? data.panNumber.trim() : undefined,
      joiningDate: data.joiningDate,
      salaryType: data.salaryType ?? 'Fixed Monthly Salary',
      monthlySalary: data.monthlySalary,
      // No derived per-day for Fixed Monthly: payroll divides monthly by the target month's days (see resolvePerDaySalary).
      perDaySalary: data.perDaySalary,
      incentiveAmount: data.incentiveAmount,
      bankDetails: data.bankDetails,
      upiId: data.upiId?.trim() ? data.upiId.trim() : undefined,
      assignedRoutes: data.assignedRoutes ?? [data.primaryRouteName.trim(), (data.additionalRouteName ?? '').trim()].filter(Boolean),
      primaryRouteName: data.primaryRouteName.trim(),
      additionalRouteName: data.additionalRouteName?.trim() ? data.additionalRouteName.trim() : undefined,
      shiftTiming: data.shiftTiming ?? 'Morning',
      weeklyOffDay: data.weeklyOffDay ?? 'Sunday',
      emergencyContactName: data.emergencyContactName?.trim() ? data.emergencyContactName.trim() : undefined,
      emergencyContactNumber: data.emergencyContactNumber?.trim() ? data.emergencyContactNumber.trim() : undefined,
      photoUri: data.photoUri,
      extraRoutePaymentAmount: data.extraRoutePaymentAmount,
      replacementPaymentAmount: data.replacementPaymentAmount,
      paidLeaveAllowedPerMonth: data.paidLeaveAllowedPerMonth,
      leaveSalaryRule: data.leaveSalaryRule,
      sickLeavePaid: data.sickLeavePaid,
      temporaryReplacementAllowed: data.temporaryReplacementAllowed,
      status: data.status ?? 'Active',
      appAccessEnabled: data.appAccessEnabled ?? true,
      backupDeliveryBoyId: data.backupDeliveryBoyId,
      backupDeliveryBoyName: data.backupDeliveryBoyName,
      currentAttendanceStatus: undefined,
      totalPaidLeaves: data.totalPaidLeaves,
      totalUnpaidLeaves: data.totalUnpaidLeaves,
      replacementDeliveryBoyId: data.replacementDeliveryBoyId,
      replacementDeliveryBoyName: undefined,
      replacementPerDaySalary: data.replacementPerDaySalary,
      replacementStartDate: data.replacementStartDate,
      replacementEndDate: data.replacementEndDate,
      attendance: [],
      leaves: [],
      replacements: [],
      routeCoverageCredits: [],
      salaryHistory: [],
      performance: [],
      complaints: [],
      audit: [
        {
          id: newId('audit'),
          date: now,
          action: 'Joined company',
          updatedBy: 'Admin',
          createdAt: now,
          updatedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const next = [created, ...items];
    await writeDeliveryBoys(next);
    return created as unknown as DeliveryBoyResponse;
  }

  async update(id: string, data: UpdateDeliveryBoyRequest): Promise<DeliveryBoyResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await loadDeliveryBoys();
    const idx = items.findIndex((b) => b.id === id);
    if (idx < 0) throw new DomainError('DELIVERY_BOY_NOT_FOUND', strings('deliveryBoys').errors.notFound);

    const now = nowIso();
    const current = items[idx]!;
    if (data.mobileNumber !== undefined && data.mobileNumber.trim() !== current.mobileNumber) {
      await assertMobileFree(data.mobileNumber, { deliveryBoyId: id });
    }

    const audit = [...(current.audit ?? [])];
    const pushAudit = (action: string, oldValue?: string, newValue?: string) => {
      audit.unshift({
        id: newId('audit'),
        date: now,
        action,
        updatedBy: 'Admin',
        oldValue,
        newValue,
        createdAt: now,
        updatedAt: now,
      });
    };

    if (data.primaryRouteName !== undefined && data.primaryRouteName.trim() !== current.primaryRouteName) {
      pushAudit('Primary route updated', current.primaryRouteName, data.primaryRouteName.trim());
    }
    if (data.additionalRouteName !== undefined && (data.additionalRouteName.trim() || '') !== (current.additionalRouteName ?? '')) {
      pushAudit('Additional route updated', current.additionalRouteName ?? '', data.additionalRouteName.trim());
    }
    if (data.status !== undefined && data.status !== current.status) {
      pushAudit('Status updated', current.status, data.status);
    }
    if (data.monthlySalary !== undefined && Number(data.monthlySalary) !== Number(current.monthlySalary)) {
      pushAudit('Monthly salary updated', String(current.monthlySalary), String(data.monthlySalary));
    }
    if (data.appAccessEnabled !== undefined && data.appAccessEnabled !== current.appAccessEnabled) {
      pushAudit('App access updated', String(current.appAccessEnabled), String(data.appAccessEnabled));
    }

    const routesKey = (routes: string[] | undefined) =>
      [...(routes ?? []).map((x) => String(x).trim()).filter(Boolean)].sort().join(', ');
    const bankKey = (bd: DeliveryBoyEntity['bankDetails']) => JSON.stringify(bd ?? null);

    if (data.fullName !== undefined && data.fullName.trim() !== current.fullName) {
      pushAudit('Full name updated', current.fullName, data.fullName.trim());
    }
    if (data.mobileNumber !== undefined && data.mobileNumber.trim() !== current.mobileNumber) {
      pushAudit('Mobile number updated', current.mobileNumber, data.mobileNumber.trim());
    }
    if (
      data.joiningDate !== undefined &&
      String(data.joiningDate).slice(0, 10) !== String(current.joiningDate).slice(0, 10)
    ) {
      pushAudit('Joining date updated', String(current.joiningDate).slice(0, 10), String(data.joiningDate).slice(0, 10));
    }
    if (data.salaryType !== undefined && data.salaryType !== current.salaryType) {
      pushAudit('Salary type updated', current.salaryType, data.salaryType);
    }
    if (
      data.perDaySalary !== undefined &&
      roundMoney2(Number(data.perDaySalary)) !== roundMoney2(Number(current.perDaySalary ?? 0))
    ) {
      pushAudit('Per day salary updated', String(current.perDaySalary ?? ''), String(data.perDaySalary));
    }
    if (data.alternateMobileNumber !== undefined) {
      const next = data.alternateMobileNumber.trim() ? data.alternateMobileNumber.trim() : '';
      const prev = (current.alternateMobileNumber ?? '').trim();
      if (next !== prev) pushAudit('Alternate mobile updated', prev || '—', next || '—');
    }
    if (data.address !== undefined) {
      const next = data.address.trim() ? data.address.trim() : '';
      const prev = (current.address ?? '').trim();
      if (next !== prev) pushAudit('Address updated', prev || '—', next || '—');
    }
    if (data.aadhaarNumber !== undefined) {
      const next = data.aadhaarNumber.trim() ? data.aadhaarNumber.trim() : '';
      const prev = (current.aadhaarNumber ?? '').trim();
      if (next !== prev) pushAudit('Aadhaar updated', prev || '—', next || '—');
    }
    if (data.panNumber !== undefined) {
      const next = data.panNumber.trim() ? data.panNumber.trim() : '';
      const prev = (current.panNumber ?? '').trim();
      if (next !== prev) pushAudit('PAN updated', prev || '—', next || '—');
    }
    if (
      data.incentiveAmount !== undefined &&
      roundMoney2(Number(data.incentiveAmount)) !== roundMoney2(Number(current.incentiveAmount ?? 0))
    ) {
      pushAudit('Incentive amount updated', String(current.incentiveAmount ?? 0), String(data.incentiveAmount));
    }
    if (data.shiftTiming !== undefined && data.shiftTiming !== current.shiftTiming) {
      pushAudit('Shift timing updated', current.shiftTiming, data.shiftTiming);
    }
    if (data.weeklyOffDay !== undefined && data.weeklyOffDay !== current.weeklyOffDay) {
      pushAudit('Weekly off updated', current.weeklyOffDay, data.weeklyOffDay);
    }
    if (data.assignedRoutes !== undefined && routesKey(data.assignedRoutes) !== routesKey(current.assignedRoutes)) {
      pushAudit('Assigned routes updated', routesKey(current.assignedRoutes) || '—', routesKey(data.assignedRoutes) || '—');
    }
    if (data.upiId !== undefined) {
      const next = data.upiId.trim() ? data.upiId.trim() : '';
      const prev = (current.upiId ?? '').trim();
      if (next !== prev) pushAudit('UPI ID updated', prev || '—', next || '—');
    }
    if (data.bankDetails !== undefined && bankKey(data.bankDetails) !== bankKey(current.bankDetails)) {
      pushAudit('Bank details updated', bankKey(current.bankDetails), bankKey(data.bankDetails));
    }
    if (data.emergencyContactName !== undefined) {
      const next = data.emergencyContactName.trim() ? data.emergencyContactName.trim() : '';
      const prev = (current.emergencyContactName ?? '').trim();
      if (next !== prev) pushAudit('Emergency contact name updated', prev || '—', next || '—');
    }
    if (data.emergencyContactNumber !== undefined) {
      const next = data.emergencyContactNumber.trim() ? data.emergencyContactNumber.trim() : '';
      const prev = (current.emergencyContactNumber ?? '').trim();
      if (next !== prev) pushAudit('Emergency contact number updated', prev || '—', next || '—');
    }
    if (data.photoUri !== undefined && String(data.photoUri ?? '') !== String(current.photoUri ?? '')) {
      pushAudit('Photo updated', current.photoUri ? 'Previous image' : '—', data.photoUri ? 'New image' : 'Removed');
    }
    if (
      data.extraRoutePaymentAmount !== undefined &&
      roundMoney2(Number(data.extraRoutePaymentAmount)) !== roundMoney2(Number(current.extraRoutePaymentAmount ?? 0))
    ) {
      pushAudit('Extra route payment default updated', String(current.extraRoutePaymentAmount ?? ''), String(data.extraRoutePaymentAmount));
    }
    if (
      data.replacementPaymentAmount !== undefined &&
      roundMoney2(Number(data.replacementPaymentAmount)) !== roundMoney2(Number(current.replacementPaymentAmount ?? 0))
    ) {
      pushAudit('Replacement payment default updated', String(current.replacementPaymentAmount ?? ''), String(data.replacementPaymentAmount));
    }
    if (data.backupDeliveryBoyId !== undefined && data.backupDeliveryBoyId !== current.backupDeliveryBoyId) {
      pushAudit(
        'Backup delivery boy updated',
        [current.backupDeliveryBoyName, current.backupDeliveryBoyId].filter(Boolean).join(' · ') || '—',
        [data.backupDeliveryBoyName, data.backupDeliveryBoyId].filter(Boolean).join(' · ') || '—',
      );
    }
    if (data.replacementDeliveryBoyId !== undefined && data.replacementDeliveryBoyId !== current.replacementDeliveryBoyId) {
      pushAudit(
        'Replacement assignee updated',
        [current.replacementDeliveryBoyName, current.replacementDeliveryBoyId].filter(Boolean).join(' · ') || '—',
        [data.replacementDeliveryBoyName, data.replacementDeliveryBoyId].filter(Boolean).join(' · ') || '—',
      );
    }
    if (
      data.lastWorkingDate !== undefined &&
      String(data.lastWorkingDate ?? '').slice(0, 10) !== String(current.lastWorkingDate ?? '').slice(0, 10)
    ) {
      pushAudit(
        'Last working date updated',
        String(current.lastWorkingDate ?? '—').slice(0, 10),
        String(data.lastWorkingDate ?? '—').slice(0, 10),
      );
    }
    if (data.reasonForLeaving !== undefined && String(data.reasonForLeaving ?? '') !== String(current.reasonForLeaving ?? '')) {
      pushAudit('Reason for leaving updated', String(current.reasonForLeaving ?? '—'), String(data.reasonForLeaving ?? '—'));
    }
    if (
      data.paidLeaveAllowedPerMonth !== undefined &&
      Number(data.paidLeaveAllowedPerMonth) !== Number(current.paidLeaveAllowedPerMonth ?? 0)
    ) {
      pushAudit('Paid leave allowance (per month) updated', String(current.paidLeaveAllowedPerMonth ?? ''), String(data.paidLeaveAllowedPerMonth));
    }
    if (data.leaveSalaryRule !== undefined && data.leaveSalaryRule !== current.leaveSalaryRule) {
      pushAudit('Leave salary rule updated', String(current.leaveSalaryRule ?? '—'), String(data.leaveSalaryRule));
    }
    if (data.sickLeavePaid !== undefined && data.sickLeavePaid !== current.sickLeavePaid) {
      pushAudit('Sick leave paid flag updated', String(current.sickLeavePaid), String(data.sickLeavePaid));
    }
    if (data.temporaryReplacementAllowed !== undefined && data.temporaryReplacementAllowed !== current.temporaryReplacementAllowed) {
      pushAudit('Temporary replacement allowed updated', String(current.temporaryReplacementAllowed), String(data.temporaryReplacementAllowed));
    }
    if (
      data.replacementPerDaySalary !== undefined &&
      roundMoney2(Number(data.replacementPerDaySalary)) !== roundMoney2(Number(current.replacementPerDaySalary ?? 0))
    ) {
      pushAudit('Replacement per-day salary updated', String(current.replacementPerDaySalary ?? ''), String(data.replacementPerDaySalary));
    }
    if (
      data.replacementStartDate !== undefined &&
      String(data.replacementStartDate ?? '').slice(0, 10) !== String(current.replacementStartDate ?? '').slice(0, 10)
    ) {
      pushAudit(
        'Replacement start date updated',
        String(current.replacementStartDate ?? '—').slice(0, 10),
        String(data.replacementStartDate ?? '—').slice(0, 10),
      );
    }
    if (
      data.replacementEndDate !== undefined &&
      String(data.replacementEndDate ?? '').slice(0, 10) !== String(current.replacementEndDate ?? '').slice(0, 10)
    ) {
      pushAudit(
        'Replacement end date updated',
        String(current.replacementEndDate ?? '—').slice(0, 10),
        String(data.replacementEndDate ?? '—').slice(0, 10),
      );
    }

    const updated: DeliveryBoyEntity = {
      ...current,
      fullName: data.fullName !== undefined ? data.fullName.trim() : current.fullName,
      mobileNumber: data.mobileNumber !== undefined ? data.mobileNumber.trim() : current.mobileNumber,
      alternateMobileNumber: data.alternateMobileNumber !== undefined ? (data.alternateMobileNumber.trim() ? data.alternateMobileNumber.trim() : undefined) : current.alternateMobileNumber,
      address: data.address !== undefined ? (data.address.trim() ? data.address.trim() : undefined) : current.address,
      aadhaarNumber: data.aadhaarNumber !== undefined ? (data.aadhaarNumber.trim() ? data.aadhaarNumber.trim() : undefined) : current.aadhaarNumber,
      panNumber: data.panNumber !== undefined ? (data.panNumber.trim() ? data.panNumber.trim() : undefined) : current.panNumber,
      lastWorkingDate: data.lastWorkingDate !== undefined ? data.lastWorkingDate : current.lastWorkingDate,
      reasonForLeaving: data.reasonForLeaving !== undefined ? data.reasonForLeaving : current.reasonForLeaving,
      joiningDate: data.joiningDate !== undefined ? data.joiningDate : current.joiningDate,
      salaryType: data.salaryType !== undefined ? data.salaryType : current.salaryType,
      monthlySalary: data.monthlySalary !== undefined ? data.monthlySalary : current.monthlySalary,
      perDaySalary: data.perDaySalary !== undefined ? data.perDaySalary : current.perDaySalary,
      incentiveAmount: data.incentiveAmount !== undefined ? data.incentiveAmount : current.incentiveAmount,
      pendingSalaryAmount: data.pendingSalaryAmount !== undefined ? data.pendingSalaryAmount : current.pendingSalaryAmount,
      salaryPaidStatus: data.salaryPaidStatus !== undefined ? data.salaryPaidStatus : current.salaryPaidStatus,
      salaryPaidDate: data.salaryPaidDate !== undefined ? data.salaryPaidDate : current.salaryPaidDate,
      bankDetails: data.bankDetails !== undefined ? data.bankDetails : current.bankDetails,
      upiId: data.upiId !== undefined ? (data.upiId.trim() ? data.upiId.trim() : undefined) : current.upiId,
      assignedRoutes: data.assignedRoutes !== undefined ? data.assignedRoutes : current.assignedRoutes,
      primaryRouteName: data.primaryRouteName !== undefined ? data.primaryRouteName.trim() : current.primaryRouteName,
      additionalRouteName: data.additionalRouteName !== undefined ? (data.additionalRouteName.trim() ? data.additionalRouteName.trim() : undefined) : current.additionalRouteName,
      shiftTiming: data.shiftTiming !== undefined ? data.shiftTiming : current.shiftTiming,
      weeklyOffDay: data.weeklyOffDay !== undefined ? data.weeklyOffDay : current.weeklyOffDay,
      emergencyContactName: data.emergencyContactName !== undefined ? (data.emergencyContactName.trim() ? data.emergencyContactName.trim() : undefined) : current.emergencyContactName,
      emergencyContactNumber: data.emergencyContactNumber !== undefined ? (data.emergencyContactNumber.trim() ? data.emergencyContactNumber.trim() : undefined) : current.emergencyContactNumber,
      photoUri: data.photoUri !== undefined ? data.photoUri : current.photoUri,
      extraRoutePaymentAmount:
        data.extraRoutePaymentAmount !== undefined ? data.extraRoutePaymentAmount : current.extraRoutePaymentAmount,
      replacementPaymentAmount:
        data.replacementPaymentAmount !== undefined ? data.replacementPaymentAmount : current.replacementPaymentAmount,
      paidLeaveAllowedPerMonth:
        data.paidLeaveAllowedPerMonth !== undefined ? data.paidLeaveAllowedPerMonth : current.paidLeaveAllowedPerMonth,
      leaveSalaryRule: data.leaveSalaryRule !== undefined ? data.leaveSalaryRule : current.leaveSalaryRule,
      sickLeavePaid: data.sickLeavePaid !== undefined ? data.sickLeavePaid : current.sickLeavePaid,
      temporaryReplacementAllowed:
        data.temporaryReplacementAllowed !== undefined ? data.temporaryReplacementAllowed : current.temporaryReplacementAllowed,
      status: data.status !== undefined ? data.status : current.status,
      appAccessEnabled: data.appAccessEnabled !== undefined ? data.appAccessEnabled : current.appAccessEnabled,
      backupDeliveryBoyId: data.backupDeliveryBoyId !== undefined ? data.backupDeliveryBoyId : current.backupDeliveryBoyId,
      backupDeliveryBoyName: data.backupDeliveryBoyName !== undefined ? data.backupDeliveryBoyName : current.backupDeliveryBoyName,
      totalPaidLeaves: data.totalPaidLeaves !== undefined ? data.totalPaidLeaves : current.totalPaidLeaves,
      totalUnpaidLeaves: data.totalUnpaidLeaves !== undefined ? data.totalUnpaidLeaves : current.totalUnpaidLeaves,
      replacementDeliveryBoyId: data.replacementDeliveryBoyId !== undefined ? data.replacementDeliveryBoyId : current.replacementDeliveryBoyId,
      replacementDeliveryBoyName: data.replacementDeliveryBoyName !== undefined ? data.replacementDeliveryBoyName : current.replacementDeliveryBoyName,
      replacementPerDaySalary: data.replacementPerDaySalary !== undefined ? data.replacementPerDaySalary : current.replacementPerDaySalary,
      replacementStartDate: data.replacementStartDate !== undefined ? data.replacementStartDate : current.replacementStartDate,
      replacementEndDate: data.replacementEndDate !== undefined ? data.replacementEndDate : current.replacementEndDate,
      currentAttendanceStatus:
        data.currentAttendanceStatus !== undefined ? data.currentAttendanceStatus : current.currentAttendanceStatus,
      attendance: data.attendance !== undefined ? data.attendance : current.attendance,
      leaves: data.leaves !== undefined ? data.leaves : current.leaves,
      replacements: data.replacements !== undefined ? data.replacements : current.replacements,
      routeCoverageCredits: data.routeCoverageCredits !== undefined ? data.routeCoverageCredits : current.routeCoverageCredits,
      salaryHistory: data.salaryHistory !== undefined ? data.salaryHistory : current.salaryHistory,
      complaints: data.complaints !== undefined ? data.complaints : current.complaints,
      performance: data.performance !== undefined ? data.performance : current.performance,
      audit: data.audit !== undefined ? data.audit : audit,

      totalWorkingDays: data.totalWorkingDays !== undefined ? data.totalWorkingDays : current.totalWorkingDays,
      totalAttendanceDays: data.totalAttendanceDays !== undefined ? data.totalAttendanceDays : current.totalAttendanceDays,
      totalLeaveDays: data.totalLeaveDays !== undefined ? data.totalLeaveDays : current.totalLeaveDays,
      totalReplacementDays: data.totalReplacementDays !== undefined ? data.totalReplacementDays : current.totalReplacementDays,
      totalDeliveriesCompleted: data.totalDeliveriesCompleted !== undefined ? data.totalDeliveriesCompleted : current.totalDeliveriesCompleted,
      performanceRating: data.performanceRating !== undefined ? data.performanceRating : current.performanceRating,
      updatedAt: now,
    };

    const next = [...items];
    next[idx] = updated;
    await writeDeliveryBoys(next);
    // Their customers show the new name; their login follows a new number.
    if (updated.fullName !== current.fullName) await syncCustomersWithDeliveryBoy({ id, fullName: updated.fullName });
    if (updated.mobileNumber !== current.mobileNumber) await moveLoginToMobile(id, updated.mobileNumber);
    return updated as unknown as DeliveryBoyResponse;
  }

  async delete(id: string): Promise<void> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await loadDeliveryBoys();
    await writeDeliveryBoys(items.filter((b) => b.id !== id));
    // Their customers become unassigned (not left pointing at nobody), and the login goes.
    await syncCustomersWithDeliveryBoy({ id, deleted: true });
    await removeLoginFor(id);
  }
}

