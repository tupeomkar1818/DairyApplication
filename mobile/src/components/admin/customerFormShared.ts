import { buildSubscriptionPayloadFromPlans, type AdminProductLite } from '@/src/components/admin/buildSubscriptionPayloadFromPlans';
import { parseMapLocation, type CustomerGeoLocation } from '@/src/domain/customers/location';
import {
  dobToIsoDate,
  endOfMonthDdMmYyyy,
  fmtDdMmYyyy,
  toDdMmYyyyFromFlexibleDate,
} from '@/src/components/admin/customerFormDates';
import type { CustomerSubscriptionItemDto, CustomerSubscriptionPlanDto, CustomerResponse } from '@/src/domain/customers/dtos';
import { CreateCustomerRequestSchema, EditCustomerProfileRequestSchema } from '@/src/domain/customers/validations';

export type CustomerFormTab = 'basic' | 'address' | 'billing';

/** `create` validates the full new-customer payload; `edit` validates only the fields the form edits. */
export type CustomerFormMode = 'create' | 'edit';

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
  /** A Google Maps link or "lat, lng" for the customer's door. */
  mapLink: string;
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

  paymentType: 'Cash' | 'UPI' | 'Monthly';
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

/** Stored date (DD/MM/YYYY, YYYY-MM-DD or ISO timestamp) → DD/MM/YYYY form value. */
function toDobField(value: string | undefined | null): string {
  return toDdMmYyyyFromFlexibleDate(value);
}

function optionalTrimmed(value: string): string | undefined {
  const t = value.trim();
  return t ? t : undefined;
}

function optionalNumber(value: string): number | undefined {
  return value.trim() ? Number(value) : undefined;
}

function optionalIsoDate(ddmmyyyy: string): string | undefined {
  const t = ddmmyyyy.trim();
  return t ? dobToIsoDate(t) ?? t : undefined;
}

/**
 * Digits-only Indian mobile input, capped at 10 digits. A pasted country/trunk prefix is dropped
 * ("+91 98765 43210" → "9876543210", "098765 43210" → "9876543210"). Prefixes are only stripped at the exact
 * prefixed lengths, so typing an extra digit onto a full number that starts with 91 does not eat its first digits.
 */
export function sanitizeMobileInput(text: string): string {
  let digits = text.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('091')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export function sanitizePincodeInput(text: string): string {
  return text.replace(/\D/g, '').slice(0, 6);
}

/** Full address auto-generated from the structured address fields (read-only on the form). */
export function buildAutoAddress(
  form: Pick<CustomerFormState, 'houseFlatNumber' | 'societyName' | 'streetArea' | 'city' | 'pincode'>,
): string {
  return [form.houseFlatNumber, form.societyName, form.streetArea, form.city, form.pincode]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

function validCycleDay(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : undefined;
}

/**
 * Billing cycle day (1–31) to save. The billing-date picker shows the stored day clamped to a real date in the
 * current month (31 → 30/09); when the picked day is just that clamped display, keep the stored day instead of
 * silently turning a month-end (31) cycle into the 30th.
 */
function billingCycleDayFromForm(form: CustomerFormState): number | undefined {
  if (form.billingType === 'Prepaid') return undefined;
  const storedDay = validCycleDay(form.billingCycleDate.trim() || undefined);
  if (form.billingType !== 'Postpaid') return storedDay;
  const m = form.billingDate.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const pickedDay = m ? validCycleDay(m[1]) : undefined;
  if (!m || pickedDay === undefined) return storedDay;
  if (storedDay !== undefined) {
    const daysInPickedMonth = new Date(Number(m[3]), Number(m[2]), 0).getDate();
    if (Math.min(storedDay, daysInPickedMonth) === pickedDay) return storedDay;
  }
  return pickedDay;
}

/** Plan DTO → form row (DD/MM dates). Keeps id/createdAt so saving never re-issues the line. */
function planToFormRow(p: CustomerSubscriptionPlanDto): CustomerSubscriptionPlanDto {
  const startDate = toDobField(p.startDate);
  return {
    id: p.id,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    productName: p.productName,
    numberOfItems: p.numberOfItems ?? 1,
    quantityLabel: p.quantityLabel,
    unitType: p.unitType,
    subscriptionKind: p.subscriptionKind ?? 'Monthly',
    deliveryDate: p.deliveryDate ? toDobField(p.deliveryDate) : undefined,
    deliveryTime: p.deliveryTime,
    frequency: p.frequency,
    startDate,
    // Keep the stored end date; only a line without one defaults to the end of its start month.
    endDate: toDobField(p.endDate) || (startDate ? endOfMonthDdMmYyyy(startDate) ?? undefined : undefined),
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
  };
}

export function emptyCustomerForm(): CustomerFormState {
  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const endOfMonth = fmtDdMmYyyy(new Date(now.getFullYear(), now.getMonth(), lastDayOfMonth));

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
    mapLink: '',
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

    // No sample plan: subscriptions are added on the customer's Subscription tab, from the real catalog.
    subscriptionPlans: [],

    paymentType: 'Monthly',
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
  const storedCycleDay = validCycleDay(c.billingCycleDate);

  return {
    name: c.name,
    mobile: c.mobile,
    dateOfBirth: toDobField(c.dateOfBirth),
    alternateMobile: c.alternateMobile ?? '',
    appAccessEnabled: c.appAccessEnabled ?? c.status === 'Active',

    houseFlatNumber: c.houseFlatNumber ?? '',
    societyName: c.societyName ?? '',
    streetArea: c.streetArea ?? '',
    landmark: c.landmark ?? '',
    mapLink: c.mapLink ?? (c.geoLocation ? `${c.geoLocation.latitude}, ${c.geoLocation.longitude}` : ''),
    city: c.city ?? '',
    pincode: c.pincode ?? '',
    routeName: c.routeName ?? '',
    assignedDeliveryBoyId: c.assignedDeliveryBoyId ?? '',
    assignedDeliveryBoyName: c.assignedDeliveryBoyName ?? '',
    address: c.address ?? '',

    subscriptionStartDate: toDobField(c.subscriptionStartDate),
    subscriptionEndDate: toDobField(c.subscriptionEndDate),
    deliveryTime: c.deliveryTime ?? 'Morning',
    subscriptionFrequency: c.subscriptionFrequency ?? 'Daily',
    subscriptionStatus: c.subscriptionStatus ?? 'Active',
    preferredDeliveryNotes: c.preferredDeliveryNotes ?? '',

    subscriptionPlans: (c.subscriptionPlans ?? []).map(planToFormRow),

    paymentType: c.paymentType ?? 'Monthly',
    billingType: (c.billingType as CustomerFormState['billingType']) ?? 'Postpaid',
    // Display only: the stored cycle day clamped to a real date this month. The raw day stays in billingCycleDate.
    billingDate: fmtDdMmYyyy(new Date(now.getFullYear(), now.getMonth(), Math.min(lastDay, storedCycleDay ?? lastDay))),
    billingCycleDate: String(storedCycleDay ?? lastDay),
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

/**
 * The map location the admin typed. Empty keeps whatever is stored (e.g. a pin the delivery boy saved at the door);
 * coordinates — typed or inside a long Google Maps link — become the pin; a short share link is kept as a link.
 */
function mapLocationFromForm(value: string): { mapLink?: string; geoLocation?: CustomerGeoLocation } {
  const text = value.trim();
  if (!text) return {};
  const coords = parseMapLocation(text);
  return coords
    ? { mapLink: text, geoLocation: { ...coords, source: 'admin', updatedAt: new Date().toISOString() } }
    : { mapLink: text };
}

/**
 * Fields the admin customer form actually edits. An edit sends only these keys; every other stored field
 * (landmark, payment dates, notes, subscription header…) is omitted — not sent as `undefined` — so the update keeps it.
 */
function editableFieldsFromForm(form: CustomerFormState) {
  return {
    name: form.name.trim(),
    mobile: form.mobile.trim(),
    dateOfBirth: optionalTrimmed(form.dateOfBirth),
    alternateMobile: optionalTrimmed(form.alternateMobile),
    appAccessEnabled: form.appAccessEnabled,
    status: form.status,

    address: form.address.trim(),
    societyName: form.societyName.trim(),
    houseFlatNumber: optionalTrimmed(form.houseFlatNumber),
    streetArea: optionalTrimmed(form.streetArea),
    landmark: optionalTrimmed(form.landmark),
    ...mapLocationFromForm(form.mapLink),
    city: optionalTrimmed(form.city),
    pincode: optionalTrimmed(form.pincode),
    routeName: optionalTrimmed(form.routeName),
    assignedDeliveryBoyId: optionalTrimmed(form.assignedDeliveryBoyId),
    assignedDeliveryBoyName: optionalTrimmed(form.assignedDeliveryBoyName),

    // Required by the schema; carried unchanged from the stored customer (not editable here).
    deliveryTime: form.deliveryTime,
    paymentType: form.paymentType,

    billingType: form.billingType,
    billingCycleDate: billingCycleDayFromForm(form),
  };
}

/** New customer: full payload including the subscription lines built from `form.subscriptionPlans`. */
export function validateCustomerForm(form: CustomerFormState, adminProducts: AdminProductLite[]) {
  const built = buildSubscriptionPayloadFromPlans(form.subscriptionPlans ?? [], adminProducts);
  return CreateCustomerRequestSchema.safeParse({
    ...editableFieldsFromForm(form),
    landmark: optionalTrimmed(form.landmark),

    subscriptionStartDate: optionalIsoDate(form.subscriptionStartDate),
    subscriptionEndDate: optionalIsoDate(form.subscriptionEndDate),
    subscriptionStatus: form.subscriptionStatus,
    subscriptionFrequency: form.subscriptionFrequency,
    preferredDeliveryNotes: optionalTrimmed(form.preferredDeliveryNotes),

    advanceBalance: optionalNumber(form.advanceBalance),
    securityDeposit: optionalNumber(form.securityDeposit),
    pendingAmount: optionalNumber(form.pendingAmount),
    discountAmount: optionalNumber(form.discountAmount),
    taxPercentage: optionalNumber(form.taxPercentage),
    lastPaymentDate: optionalIsoDate(form.lastPaymentDate),
    nextDueDate: optionalIsoDate(form.nextDueDate),
    preferredPaymentMode: form.preferredPaymentMode,

    complaintNotes: optionalTrimmed(form.complaintNotes),
    internalAdminNotes: optionalTrimmed(form.internalAdminNotes),
    specialDeliveryInstructions: optionalTrimmed(form.specialDeliveryInstructions),

    subscription: built.subscription as CustomerSubscriptionItemDto[],
    // A new customer may start without a subscription (it is set up afterwards on the Subscription tab).
    subscriptionPlans: built.subscriptionPlans.length ? (built.subscriptionPlans as CustomerSubscriptionPlanDto[]) : undefined,
  });
}

/**
 * Existing customer: validates only the edited profile/address/billing fields. Subscription lines are managed on the
 * Subscription tab, so a customer with no plans can still be edited and saving never rewrites their plans.
 */
export function validateCustomerEditForm(form: CustomerFormState) {
  return EditCustomerProfileRequestSchema.safeParse(editableFieldsFromForm(form));
}

export function validateCustomerFormForMode(mode: CustomerFormMode, form: CustomerFormState, adminProducts: AdminProductLite[]) {
  return mode === 'edit' ? validateCustomerEditForm(form) : validateCustomerForm(form, adminProducts);
}
