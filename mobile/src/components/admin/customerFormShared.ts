import { buildSubscriptionPayloadFromPlans, type AdminProductLite } from '@/src/components/admin/buildSubscriptionPayloadFromPlans';
import {
  dobToIsoDate,
  endOfMonthDdMmYyyy,
  fmtDdMmYyyy,
  isoDateToDob,
} from '@/src/components/admin/customerFormDates';
import type { CustomerSubscriptionItemDto, CustomerSubscriptionPlanDto, CustomerResponse } from '@/src/domain/customers/dtos';
import { CreateCustomerRequestSchema } from '@/src/domain/customers/validations';

export type CustomerFormTab = 'basic' | 'address' | 'billing';

export type CustomerFormState = {
  name: string;
  mobile: string;
  dateOfBirth: string;
  alternateMobile: string;
  appAccessEnabled: boolean;

  houseFlatNumber: string;
  societyName: string;
  streetArea: string;
  landmark: string;
  city: string;
  pincode: string;
  routeName: string;
  assignedDeliveryBoyId: string;
  assignedDeliveryBoyName: string;
  address: string;

  subscriptionStartDate: string;
  subscriptionEndDate: string;
  deliveryTime: 'Morning' | 'Evening' | 'Both';
  subscriptionFrequency:
    | 'Daily'
    | 'Alternate Day'
    | 'Weekly'
    | 'Specific Days'
    | 'Weekend Only'
    | 'Morning Only'
    | 'Evening Only'
    | 'Morning and Evening';
  subscriptionStatus: 'Active' | 'Paused' | 'Expired' | 'Cancelled' | 'Inactive';
  preferredDeliveryNotes: string;

  subscriptionPlans: CustomerSubscriptionPlanDto[];

  billingType: 'Postpaid' | 'Prepaid';
  billingDate: string;
  billingCycleDate: string;
  advanceBalance: string;
  securityDeposit: string;
  pendingAmount: string;
  discountAmount: string;
  taxPercentage: string;
  lastPaymentDate: string;
  nextDueDate: string;
  preferredPaymentMode: 'Cash' | 'UPI' | 'Bank' | 'Other';

  complaintNotes: string;
  internalAdminNotes: string;
  specialDeliveryInstructions: string;

  status: 'Active' | 'Inactive';
};

function toDobField(value: string | undefined | null): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  return isoDateToDob(v) ?? '';
}

export function emptyCustomerForm(): CustomerFormState {
  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const endOfMonth = fmtDdMmYyyy(new Date(now.getFullYear(), now.getMonth(), lastDayOfMonth));
  const defaultPlanStart = fmtDdMmYyyy(now);

  return {
    name: '',
    mobile: '',
    dateOfBirth: '',
    alternateMobile: '',
    appAccessEnabled: true,

    houseFlatNumber: '',
    address: '',
    societyName: '',
    streetArea: '',
    landmark: '',
    city: '',
    pincode: '',
    routeName: '',
    assignedDeliveryBoyId: '',
    assignedDeliveryBoyName: '',

    subscriptionStartDate: '',
    subscriptionEndDate: '',
    deliveryTime: 'Morning',
    subscriptionFrequency: 'Daily',
    subscriptionStatus: 'Active',
    preferredDeliveryNotes: '',

    subscriptionPlans: [
      {
        productName: 'Cow Milk',
        numberOfItems: 1,
        quantityLabel: '500 ml',
        unitType: 'ml',
        subscriptionKind: 'Monthly',
        productAdditionTag: 'Regular',
        deliveryTime: 'Morning',
        frequency: 'Daily',
        startDate: defaultPlanStart,
        endDate: endOfMonthDdMmYyyy(defaultPlanStart) ?? undefined,
        originalPrice: 32,
        discountedPrice: 0,
        effectiveFinalPrice: 32,
        status: 'Active',
      },
    ],

    billingType: 'Postpaid',
    billingDate: endOfMonth,
    billingCycleDate: String(lastDayOfMonth),
    advanceBalance: '0',
    securityDeposit: '0',
    pendingAmount: '0',
    discountAmount: '0',
    taxPercentage: '0',
    lastPaymentDate: '',
    nextDueDate: '',
    preferredPaymentMode: 'UPI',

    complaintNotes: '',
    internalAdminNotes: '',
    specialDeliveryInstructions: '',

    status: 'Active',
  };
}

export function customerFormFromResponse(c: CustomerResponse): CustomerFormState {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return {
    name: c.name,
    mobile: c.mobile,
    dateOfBirth: toDobField(c.dateOfBirth),
    alternateMobile: c.alternateMobile ?? '',
    appAccessEnabled: c.status === 'Active',

    houseFlatNumber: c.houseFlatNumber ?? '',
    societyName: c.societyName ?? '',
    streetArea: c.streetArea ?? '',
    landmark: c.landmark ?? '',
    city: c.city ?? '',
    pincode: c.pincode ?? '',
    routeName: c.routeName ?? '',
    assignedDeliveryBoyId: (c as CustomerResponse & { assignedDeliveryBoyId?: string }).assignedDeliveryBoyId ?? '',
    assignedDeliveryBoyName: c.assignedDeliveryBoyName ?? '',
    address: c.address ?? '',

    subscriptionStartDate: toDobField(c.subscriptionStartDate),
    subscriptionEndDate: toDobField(c.subscriptionEndDate),
    deliveryTime: c.deliveryTime ?? 'Morning',
    subscriptionFrequency: 'Daily',
    subscriptionStatus: c.subscriptionStatus ?? 'Active',
    preferredDeliveryNotes: c.preferredDeliveryNotes ?? '',

    subscriptionPlans: (c.subscriptionPlans ?? []).map((p) => ({
      productName: p.productName,
      numberOfItems: (p as CustomerSubscriptionPlanDto & { numberOfItems?: number }).numberOfItems ?? 1,
      quantityLabel: p.quantityLabel,
      unitType: p.unitType,
      subscriptionKind: p.subscriptionKind ?? 'Monthly',
      deliveryDate: p.deliveryDate ? toDobField(p.deliveryDate) : undefined,
      deliveryTime: p.deliveryTime,
      frequency: p.frequency,
      startDate: toDobField(p.startDate),
      endDate: (() => {
        const sd = toDobField(p.startDate);
        if (sd && /^\d{2}\/\d{2}\/\d{4}$/.test(sd)) {
          const eom = endOfMonthDdMmYyyy(sd);
          if (eom) return eom;
        }
        return p.endDate ? toDobField(p.endDate) : undefined;
      })(),
      pauseStartDate: p.pauseStartDate ? toDobField(p.pauseStartDate) : undefined,
      pauseEndDate: p.pauseEndDate ? toDobField(p.pauseEndDate) : undefined,
      resumeDate: p.resumeDate ? toDobField(p.resumeDate) : undefined,
      pauseReason: p.pauseReason,
      pauseStatus: p.pauseStatus,
      productAdditionTag: p.productAdditionTag ?? 'Regular',
      notes: p.notes,
      originalPrice: p.originalPrice,
      discountedPrice: p.discountedPrice,
      effectiveFinalPrice: p.effectiveFinalPrice,
      paymentStatus: p.paymentStatus,
      dailyCost: p.dailyCost,
      addedDate: p.addedDate ? toDobField(p.addedDate) : undefined,
      status: p.status,
    })) as CustomerSubscriptionPlanDto[],

    billingType: (c.billingType as CustomerFormState['billingType']) ?? 'Postpaid',
    billingDate: (() => {
      const day = Math.min(lastDay, Math.max(1, Number(c.billingCycleDate ?? lastDay)));
      return fmtDdMmYyyy(new Date(now.getFullYear(), now.getMonth(), day));
    })(),
    billingCycleDate: String(c.billingCycleDate ?? lastDay),
    advanceBalance: String(c.advanceBalance ?? 0),
    securityDeposit: String(c.securityDeposit ?? 0),
    pendingAmount: String(c.pendingAmount ?? 0),
    discountAmount: String(c.discountAmount ?? 0),
    taxPercentage: String(c.taxPercentage ?? 0),
    lastPaymentDate: toDobField(c.lastPaymentDate),
    nextDueDate: toDobField(c.nextDueDate),
    preferredPaymentMode: (c.preferredPaymentMode as CustomerFormState['preferredPaymentMode']) ?? 'UPI',

    complaintNotes: c.complaintNotes ?? '',
    internalAdminNotes: c.internalAdminNotes ?? '',
    specialDeliveryInstructions: c.specialDeliveryInstructions ?? '',
    status: c.status,
  };
}

export function validateCustomerForm(form: CustomerFormState, adminProducts: AdminProductLite[]) {
  const built = buildSubscriptionPayloadFromPlans(form.subscriptionPlans ?? [], adminProducts);
  return CreateCustomerRequestSchema.safeParse({
    ...form,
    dateOfBirth: form.dateOfBirth.trim() ? form.dateOfBirth.trim() : undefined,
    alternateMobile: form.alternateMobile.trim() ? form.alternateMobile.trim() : undefined,
    appAccessEnabled: form.appAccessEnabled,
    status: form.appAccessEnabled ? 'Active' : 'Inactive',

    houseFlatNumber: form.houseFlatNumber.trim() ? form.houseFlatNumber.trim() : undefined,
    streetArea: form.streetArea.trim() ? form.streetArea.trim() : undefined,
    landmark: undefined,
    city: form.city.trim() ? form.city.trim() : undefined,
    pincode: form.pincode.trim() ? form.pincode.trim() : undefined,
    routeName: form.routeName.trim() ? form.routeName.trim() : undefined,
    assignedDeliveryBoyId: form.assignedDeliveryBoyId.trim() ? form.assignedDeliveryBoyId.trim() : undefined,
    assignedDeliveryBoyName: form.assignedDeliveryBoyName.trim() ? form.assignedDeliveryBoyName.trim() : undefined,

    subscriptionStartDate: form.subscriptionStartDate.trim()
      ? dobToIsoDate(form.subscriptionStartDate.trim()) ?? form.subscriptionStartDate.trim()
      : undefined,
    subscriptionEndDate: form.subscriptionEndDate.trim()
      ? dobToIsoDate(form.subscriptionEndDate.trim()) ?? form.subscriptionEndDate.trim()
      : undefined,
    subscriptionStatus: form.subscriptionStatus,
    subscriptionFrequency: form.subscriptionFrequency,
    preferredDeliveryNotes: form.preferredDeliveryNotes.trim() ? form.preferredDeliveryNotes.trim() : undefined,

    deliveryTime: form.deliveryTime,
    paymentType: 'Monthly',

    billingType: form.billingType,
    billingCycleDate:
      form.billingType === 'Postpaid'
        ? (() => {
            const ddmmyyyy = form.billingDate.trim();
            if (!ddmmyyyy) return form.billingCycleDate.trim() ? Number(form.billingCycleDate) : undefined;
            const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (!m) return form.billingCycleDate.trim() ? Number(form.billingCycleDate) : undefined;
            const day = Number(m[1]);
            if (!Number.isFinite(day) || day < 1 || day > 31) {
              return form.billingCycleDate.trim() ? Number(form.billingCycleDate) : undefined;
            }
            return day;
          })()
        : undefined,
    advanceBalance: form.advanceBalance.trim() ? Number(form.advanceBalance) : undefined,
    securityDeposit: form.securityDeposit.trim() ? Number(form.securityDeposit) : undefined,
    pendingAmount: form.pendingAmount.trim() ? Number(form.pendingAmount) : undefined,
    discountAmount: form.discountAmount.trim() ? Number(form.discountAmount) : undefined,
    taxPercentage: form.taxPercentage.trim() ? Number(form.taxPercentage) : undefined,
    lastPaymentDate: form.lastPaymentDate.trim()
      ? dobToIsoDate(form.lastPaymentDate.trim()) ?? form.lastPaymentDate.trim()
      : undefined,
    nextDueDate: form.nextDueDate.trim() ? dobToIsoDate(form.nextDueDate.trim()) ?? form.nextDueDate.trim() : undefined,
    preferredPaymentMode: form.preferredPaymentMode,

    complaintNotes: form.complaintNotes.trim() ? form.complaintNotes.trim() : undefined,
    internalAdminNotes: form.internalAdminNotes.trim() ? form.internalAdminNotes.trim() : undefined,
    specialDeliveryInstructions: form.specialDeliveryInstructions.trim()
      ? form.specialDeliveryInstructions.trim()
      : undefined,

    subscription: built.subscription as CustomerSubscriptionItemDto[],
    subscriptionPlans: built.subscriptionPlans as CustomerSubscriptionPlanDto[],
  });
}
