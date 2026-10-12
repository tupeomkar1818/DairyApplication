import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ICustomerService } from '@/src/domain/customers/service.interface';
import type {
  CreateCustomerRequest,
  CustomerListResponse,
  CustomerResponse,
  CustomerSubscriptionPlanDto,
  UpdateCustomerRequest,
} from '@/src/domain/customers/dtos';
import type { Customer, CustomerSubscriptionPlan } from '@/src/domain/customers/entities';
import { planLineTotal, subscriptionPlanActiveDaysInMonth } from '@/src/domain/customers/planSchedule';
import { DomainError } from '@/src/domain/shared/errors';
import { strings } from '@/src/i18n/strings';
import { endOfMonthForDate, formatLocalIsoYmd, parsePlanBoundaryToDate } from '@/src/domain/shared/planBoundaryDates';
import { assertMobileFree, moveLoginToMobile, removeLoginFor } from '@/src/infrastructure/accountLinks';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';
import {
  CUSTOMER_BILLING_LEDGER_PREFIX,
  CUSTOMER_DAILY_PRODUCT_ORDERS_STORE_PREFIX,
  CUSTOMER_SUBSCRIPTION_CALENDAR_STORE_PREFIX,
  CUSTOMER_SUBSCRIPTION_PLAN_HISTORY_MEMO_PREFIX,
  CUSTOMERS_STORE_KEY,
} from '@/src/infrastructure/storage/keys';

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

async function readCustomers(): Promise<Customer[]> {
  return (await readJson<Customer[]>(CUSTOMERS_STORE_KEY)) ?? [];
}

async function writeCustomers(items: Customer[]): Promise<void> {
  await writeJson(CUSTOMERS_STORE_KEY, items);
}

function nextDeliveryIso(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

/** Local calendar day `daysFromNow` away, as YYYY-MM-DD (plan boundary dates are calendar days, not instants). */
function localYmdFromToday(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return formatLocalIsoYmd(d);
}

/**
 * Older data stored plan boundaries as UTC timestamps (`toISOString`), which shifts the calendar day for non-UTC
 * users. Convert timestamps to the local YYYY-MM-DD they were created on; leave date-only values untouched.
 */
function planBoundaryAsLocalYmd<T extends string | undefined>(value: T): T | string {
  const t = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T/.test(t)) return value;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? value : formatLocalIsoYmd(d);
}

function assertMobileAvailable(items: Customer[], mobile: string, exceptId?: string): void {
  const m = mobile.trim();
  if (items.some((c) => c.id !== exceptId && String(c.mobile ?? '').trim() === m)) {
    throw new DomainError('CUSTOMER_MOBILE_EXISTS', strings('customers').errors.mobileExists);
  }
}

/**
 * Keep each plan line's identity across saves: reuse the incoming id (new id only for new or duplicated ids),
 * keep the original `createdAt` (issue date shown in subscription history) and refresh `updatedAt`.
 */
function withPlanIdentity(
  plans: CustomerSubscriptionPlanDto[],
  now: string,
  previous: CustomerSubscriptionPlan[] = [],
): CustomerSubscriptionPlan[] {
  const prevById = new Map(previous.map((p) => [p.id, p] as const));
  const seen = new Set<string>();
  return plans.map((p) => {
    let id = String(p.id ?? '').trim();
    if (!id || seen.has(id)) id = newId('sub');
    seen.add(id);
    return {
      ...p,
      id,
      createdAt: prevById.get(id)?.createdAt ?? p.createdAt ?? now,
      updatedAt: now,
    };
  });
}

/** Removes a deleted customer's per-customer side stores (calendar, day orders, plan memos, billing ledger). */
async function removeCustomerScopedStorage(customerId: string): Promise<void> {
  const keys = [
    `${CUSTOMER_SUBSCRIPTION_CALENDAR_STORE_PREFIX}:${customerId}`,
    `${CUSTOMER_DAILY_PRODUCT_ORDERS_STORE_PREFIX}:${customerId}`,
    `${CUSTOMER_SUBSCRIPTION_PLAN_HISTORY_MEMO_PREFIX}:${customerId}`,
  ];
  try {
    const all = await AsyncStorage.getAllKeys();
    const ledgerPrefix = `${CUSTOMER_BILLING_LEDGER_PREFIX}:${customerId}:`;
    keys.push(...all.filter((k) => k.startsWith(ledgerPrefix)));
  } catch {
    // Listing keys is best-effort; the exact keys above are still removed.
  }
  await AsyncStorage.multiRemove(keys);
}

const SUBSCRIPTION_STATUSES = new Set(['Active', 'Paused', 'Expired', 'Cancelled', 'Inactive']);

function coerceSubscriptionStatus(v: unknown): 'Active' | 'Paused' | 'Expired' | 'Cancelled' | 'Inactive' {
  const s = String(v ?? '');
  return SUBSCRIPTION_STATUSES.has(s) ? (s as any) : 'Active';
}

function subscriptionPlanEndIsoForStart(startRaw: unknown): string | undefined {
  const start = parsePlanBoundaryToDate(String(startRaw ?? ''));
  if (!start) return undefined;
  // Local YYYY-MM-DD: `toISOString()` turned local midnight into the previous UTC day (plan ended a day early in IST).
  return formatLocalIsoYmd(endOfMonthForDate(start));
}

function normalizeCustomer(c: Customer): Customer {
  const normalizedPlans = (c.subscriptionPlans ?? []).map((p) => {
    const items = Math.max(1, Number((p as any).numberOfItems ?? 1));
    const base = Number(p.originalPrice ?? 0);
    const disc = Number(p.discountedPrice ?? 0);
    const unit = disc > 0 && disc < base ? disc : base;
    const startDate = planBoundaryAsLocalYmd(p.startDate);
    const alignedEnd = subscriptionPlanEndIsoForStart(startDate);
    const hasEnd = p.endDate !== undefined && p.endDate !== null && String(p.endDate).trim() !== '';
    return {
      ...p,
      startDate,
      pauseStartDate: planBoundaryAsLocalYmd(p.pauseStartDate),
      pauseEndDate: planBoundaryAsLocalYmd(p.pauseEndDate),
      resumeDate: planBoundaryAsLocalYmd(p.resumeDate),
      deliveryDate: planBoundaryAsLocalYmd(p.deliveryDate),
      numberOfItems: items,
      originalPrice: Number.isFinite(base) ? base : 0,
      discountedPrice: Number.isFinite(disc) ? disc : 0,
      effectiveFinalPrice: Number.isFinite(unit) ? unit : 0,
      status: coerceSubscriptionStatus(p.status),
      subscriptionKind: p.subscriptionKind ?? 'Monthly',
      productAdditionTag: p.productAdditionTag ?? 'Regular',
      // An open-ended line has no end on purpose; only a line that simply lacks one takes its start month's end.
      endDate: hasEnd ? planBoundaryAsLocalYmd(p.endDate) : p.openEnded ? undefined : alignedEnd ?? p.endDate,
    };
  });
  return {
    ...c,
    societyName: c.societyName ?? '',
    subscription: c.subscription ?? [],
    monthlyBillAmount: Number.isFinite(c.monthlyBillAmount) ? c.monthlyBillAmount : 0,
    nextDeliveryDate: c.nextDeliveryDate ?? nextDeliveryIso(1),
    dateOfBirth: c.dateOfBirth,
    pendingAmount: Number.isFinite(c.pendingAmount) ? c.pendingAmount : 0,
    nextDueDate: c.nextDueDate ?? nextDeliveryIso(5),
    // Never fabricate a payment date: a customer who has not paid yet shows "—".
    lastPaymentDate: c.lastPaymentDate,
    routeName: c.routeName ?? '',
    assignedDeliveryBoyId: (c as any).assignedDeliveryBoyId,
    assignedDeliveryBoyName: c.assignedDeliveryBoyName ?? 'Unassigned',
    payments: c.payments ?? [],
    paymentRequests: c.paymentRequests ?? [],
    extraOrders: c.extraOrders ?? [],
    offerClaims: c.offerClaims ?? [],
    subscriptionExceptions: c.subscriptionExceptions ?? [],
    favouriteProductIds: c.favouriteProductIds ?? [],
    deliveries: c.deliveries ?? [],
    complaints: c.complaints ?? [],
    audit: c.audit ?? [],
    subscriptionPlans: normalizedPlans,
    subscriptionKind: c.subscriptionKind ?? 'Monthly',
    subscriptionPaymentStatus: c.subscriptionPaymentStatus,
    subscriptionPause: c.subscriptionPause,
    subscriptionStatus: c.subscriptionStatus ? coerceSubscriptionStatus(c.subscriptionStatus) : undefined,
  };
}

async function loadCustomers(): Promise<Customer[]> {
  const existing = await readCustomers();
  if (existing.length > 0) {
    const normalized = existing.map(normalizeCustomer);
    // Only persist when normalization changed something: an unconditional write here fires the storage
    // listener, which invalidates the customer queries, which read again — an endless refetch loop.
    if (JSON.stringify(normalized) !== JSON.stringify(existing)) {
      await writeCustomers(normalized);
    }
    return normalized;
  }

  // A fresh store stays empty: every customer is added by the admin.
  return [];
}

function computeMonthlyBill(subscription: Customer['subscription']): number {
  // Simple mock estimate: fixed rupees per item line, keeps UI stable.
  const basePerItem = 480;
  return Math.max(0, subscription.length) * basePerItem;
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Estimated bill for the current month: each Active line's per-delivery total × the days that line is active this
 * month (start/end dates and pause window honoured; Daily-kind lines count only their delivery date). Frequency is
 * not modelled by the plan schedule (see `subscriptionPlanActiveDaysInMonth`), so every active day counts.
 * Actual month bills are delivery-based (customerSubscriptionMonthUtils).
 */
export function computeMonthlyBillFromPlans(plans: Customer['subscriptionPlans'], monthYyyyMm = currentMonthKey()): number {
  const total = (plans ?? [])
    .filter((p) => p.status === 'Active')
    .reduce((sum, p) => sum + planLineTotal(p) * subscriptionPlanActiveDaysInMonth(p, monthYyyyMm), 0);
  return Math.round(total);
}

export class CustomerServiceMock implements ICustomerService {
  async list(): Promise<CustomerListResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await loadCustomers();
    return { items, total: items.length };
  }

  async getById(id: string): Promise<CustomerResponse | null> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await loadCustomers();
    return items.find((c) => c.id === id) ?? null;
  }

  async create(data: CreateCustomerRequest): Promise<CustomerResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await loadCustomers();
    assertMobileAvailable(items, data.mobile);
    // One number, one person: not a delivery partner's or the admin's number either.
    await assertMobileFree(data.mobile);
    const now = nowIso();
    const subscription = data.subscription ?? [];
    const subscriptionPlans = withPlanIdentity(data.subscriptionPlans ?? [], now);
    const created: Customer = {
      id: newId('cust'),
      name: data.name.trim(),
      mobile: data.mobile.trim(),
      dateOfBirth: data.dateOfBirth,
      alternateMobile: data.alternateMobile,
      appAccessEnabled: data.appAccessEnabled ?? true,
      address: data.address.trim(),
      societyName: data.societyName.trim(),
      houseFlatNumber: data.houseFlatNumber,
      streetArea: data.streetArea,
      city: data.city,
      pincode: data.pincode,
      landmark: data.landmark,
      geoLocation: data.geoLocation,
      mapLink: data.mapLink,
      routeName: data.routeName,
      assignedDeliveryBoyId: (data as any).assignedDeliveryBoyId,
      assignedDeliveryBoyName: data.assignedDeliveryBoyName,
      deliveryTime: data.deliveryTime,
      subscriptionStartDate: data.subscriptionStartDate,
      subscriptionEndDate: data.subscriptionEndDate,
      subscriptionStatus: data.subscriptionStatus,
      subscriptionKind: data.subscriptionKind,
      subscriptionPaymentStatus: data.subscriptionPaymentStatus,
      subscriptionPause: data.subscriptionPause,
      subscriptionFrequency: data.subscriptionFrequency,
      preferredDeliveryNotes: data.preferredDeliveryNotes,
      paymentType: data.paymentType,
      status: data.status,
      subscription,
      subscriptionPlans,
      billingType: data.billingType,
      billingCycleDate: data.billingCycleDate,
      advanceBalance: data.advanceBalance,
      securityDeposit: data.securityDeposit,
      pendingAmount: data.pendingAmount,
      discountAmount: data.discountAmount,
      taxPercentage: data.taxPercentage,
      lastPaymentDate: data.lastPaymentDate,
      nextDueDate: data.nextDueDate,
      preferredPaymentMode: data.preferredPaymentMode,
      complaintNotes: data.complaintNotes,
      internalAdminNotes: data.internalAdminNotes,
      specialDeliveryInstructions: data.specialDeliveryInstructions,
      monthlyBillAmount: subscriptionPlans.length ? computeMonthlyBillFromPlans(subscriptionPlans) : computeMonthlyBill(subscription),
      nextDeliveryDate: nextDeliveryIso(1),
      createdAt: now,
      updatedAt: now,
    };
    const next = [created, ...items];
    await writeCustomers(next);
    return created;
  }

  async update(id: string, data: UpdateCustomerRequest): Promise<CustomerResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await loadCustomers();
    const idx = items.findIndex((c) => c.id === id);
    if (idx < 0) {
      throw new DomainError('CUSTOMER_NOT_FOUND', strings('customers').errors.notFound(id));
    }
    if (data.mobile !== undefined) {
      assertMobileAvailable(items, data.mobile, id);
      await assertMobileFree(data.mobile, { customerId: id });
    }
    const now = nowIso();
    const current = items[idx]!;
    /** Distinguish “omit field” (keep current) from “send []” (clear). */
    const subscription = data.subscription !== undefined ? data.subscription : current.subscription;
    const subscriptionPlans =
      data.subscriptionPlans !== undefined
        ? withPlanIdentity(data.subscriptionPlans, now, current.subscriptionPlans ?? [])
        : current.subscriptionPlans ?? [];
    const updated: Customer = {
      ...current,
      ...data,
      name: data.name !== undefined ? data.name.trim() : current.name,
      mobile: data.mobile !== undefined ? data.mobile.trim() : current.mobile,
      address: data.address !== undefined ? data.address.trim() : current.address,
      societyName: data.societyName !== undefined ? data.societyName.trim() : current.societyName,
      subscription,
      subscriptionPlans,
      monthlyBillAmount: subscriptionPlans.length ? computeMonthlyBillFromPlans(subscriptionPlans) : computeMonthlyBill(subscription),
      updatedAt: now,
    };
    const next = [...items];
    next[idx] = updated;
    await writeCustomers(next);
    // The customer keeps their login on the new number.
    if (updated.mobile !== current.mobile) await moveLoginToMobile(id, updated.mobile);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await loadCustomers();
    await writeCustomers(items.filter((c) => c.id !== id));
    await removeCustomerScopedStorage(id);
    await removeLoginFor(id);
  }
}

