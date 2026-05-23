import type { ICustomerService } from '@/src/domain/customers/service.interface';
import type { CreateCustomerRequest, CustomerListResponse, CustomerResponse, UpdateCustomerRequest } from '@/src/domain/customers/dtos';
import type { Customer } from '@/src/domain/customers/entities';
import { endOfMonthForDate, parsePlanBoundaryToDate } from '@/src/domain/shared/planBoundaryDates';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';
import { CUSTOMERS_STORE_KEY } from '@/src/infrastructure/storage/keys';

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

const SUBSCRIPTION_STATUSES = new Set(['Active', 'Paused', 'Expired', 'Cancelled', 'Inactive']);

function coerceSubscriptionStatus(v: unknown): 'Active' | 'Paused' | 'Expired' | 'Cancelled' | 'Inactive' {
  const s = String(v ?? '');
  return SUBSCRIPTION_STATUSES.has(s) ? (s as any) : 'Active';
}

function subscriptionPlanEndIsoForStart(startRaw: unknown): string | undefined {
  const start = parsePlanBoundaryToDate(String(startRaw ?? ''));
  if (!start) return undefined;
  return endOfMonthForDate(start).toISOString();
}

function normalizeCustomer(c: Customer): Customer {
  const normalizedPlans = (c.subscriptionPlans ?? []).map((p) => {
    const items = Math.max(1, Number((p as any).numberOfItems ?? 1));
    const base = Number(p.originalPrice ?? 0);
    const disc = Number(p.discountedPrice ?? 0);
    const unit = disc > 0 && disc < base ? disc : base;
    const alignedEnd = subscriptionPlanEndIsoForStart(p.startDate);
    const hasEnd = p.endDate !== undefined && p.endDate !== null && String(p.endDate).trim() !== '';
    return {
      ...p,
      numberOfItems: items,
      originalPrice: Number.isFinite(base) ? base : 0,
      discountedPrice: Number.isFinite(disc) ? disc : 0,
      effectiveFinalPrice: Number.isFinite(unit) ? unit : 0,
      status: coerceSubscriptionStatus(p.status),
      subscriptionKind: p.subscriptionKind ?? 'Monthly',
      productAdditionTag: p.productAdditionTag ?? 'Regular',
      endDate: hasEnd ? p.endDate : alignedEnd ?? p.endDate,
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
    lastPaymentDate: c.lastPaymentDate ?? nextDeliveryIso(-25),
    routeName: c.routeName ?? '',
    assignedDeliveryBoyId: (c as any).assignedDeliveryBoyId,
    assignedDeliveryBoyName: c.assignedDeliveryBoyName ?? 'Unassigned',
    payments: c.payments ?? [],
    extraOrders: c.extraOrders ?? [],
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

async function ensureSeedCustomers(): Promise<Customer[]> {
  const existing = await readCustomers();
  if (existing.length > 0) {
    const normalized = existing.map(normalizeCustomer);
    await writeCustomers(normalized);
    return normalized;
  }

  const now = nowIso();
  const seeded: Customer[] = [
    {
      id: newId('cust'),
      name: 'Rahul Patil',
      mobile: '9999999999',
      dateOfBirth: '14/06/1994',
      address: 'Near Main Road, Ward 3',
      societyName: 'Shiv Residency',
      houseFlatNumber: 'Block B-402',
      routeName: 'Route A',
      assignedDeliveryBoyName: 'Unpaid Salary Test',
      deliveryTime: 'Morning',
      paymentType: 'Monthly',
      status: 'Active',
      subscriptionKind: 'Monthly',
      subscriptionStatus: 'Active',
      subscriptionPaymentStatus: 'Paid',
      subscriptionStartDate: now,
      subscription: [
        { productName: 'Cow Milk', quantityLabel: '500 ml' },
        { productName: 'Buffalo Milk', quantityLabel: '1 Litre' },
        { productName: 'Curd', quantityLabel: '500 gm' },
      ],
      subscriptionPlans: [
        {
          id: newId('sub'),
          productName: 'Cow Milk',
          numberOfItems: 1,
          quantityLabel: '500 ml',
          unitType: 'ml',
          subscriptionKind: 'Monthly',
          productAdditionTag: 'Regular',
          deliveryTime: 'Morning',
          frequency: 'Daily',
          startDate: now,
          originalPrice: 56,
          discountedPrice: 52,
          effectiveFinalPrice: 52,
          paymentStatus: 'Paid',
          status: 'Active',
          notes: 'Primary daily line',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: newId('sub'),
          productName: 'Curd',
          numberOfItems: 1,
          quantityLabel: '500 gm',
          unitType: 'gram',
          subscriptionKind: 'Monthly',
          productAdditionTag: 'Permanent',
          deliveryTime: 'Morning',
          frequency: 'Weekend Only',
          startDate: now,
          addedDate: now,
          originalPrice: 40,
          discountedPrice: 0,
          effectiveFinalPrice: 40,
          paymentStatus: 'Paid',
          status: 'Active',
          notes: 'Added permanently — Sundays',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: newId('sub'),
          productName: 'Paneer',
          numberOfItems: 1,
          quantityLabel: '200 gm',
          unitType: 'gram',
          subscriptionKind: 'Monthly',
          productAdditionTag: 'Temporary',
          deliveryTime: 'Evening',
          frequency: 'Daily',
          startDate: now,
          endDate: nextDeliveryIso(14),
          originalPrice: 120,
          discountedPrice: 110,
          effectiveFinalPrice: 110,
          paymentStatus: 'Pending',
          status: 'Active',
          notes: 'Guest supply — temporary window',
          createdAt: now,
          updatedAt: now,
        },
      ],
      monthlyBillAmount: 5200,
      pendingAmount: 0,
      lastPaymentDate: nextDeliveryIso(-25),
      nextDueDate: nextDeliveryIso(5),
      nextDeliveryDate: nextDeliveryIso(1),
      payments: [
        {
          id: newId('pay'),
          paymentDate: nextDeliveryIso(-25),
          amountPaid: 5200,
          paymentMode: 'UPI',
          transactionId: 'TXN-DEMO-001',
          collectedBy: 'Admin',
          pendingBalanceAfter: 0,
          notes: 'Monthly payment',
          createdAt: now,
          updatedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId('cust'),
      name: 'Sneha Kulkarni',
      mobile: '8888888888',
      dateOfBirth: '02/11/1997',
      address: 'Lane 2, Opp. Temple',
      societyName: 'Green View',
      routeName: 'Route B',
      deliveryTime: 'Evening',
      paymentType: 'UPI',
      status: 'Active',
      subscriptionKind: 'Daily',
      subscriptionStatus: 'Paused',
      subscriptionPaymentStatus: 'Pending',
      subscriptionStartDate: now,
      subscription: [{ productName: 'Paneer', quantityLabel: '250 gram' }],
      subscriptionPlans: [
        {
          id: newId('sub'),
          productName: 'Paneer',
          numberOfItems: 2,
          quantityLabel: '250 gram',
          unitType: 'Packet',
          subscriptionKind: 'Daily',
          deliveryDate: nextDeliveryIso(1),
          deliveryTime: 'Evening',
          frequency: 'Daily',
          startDate: now,
          endDate: nextDeliveryIso(5),
          originalPrice: 90,
          discountedPrice: 0,
          effectiveFinalPrice: 90,
          dailyCost: 90,
          paymentStatus: 'Pending',
          status: 'Active',
          notes: 'Short guest order — 5 days',
          createdAt: now,
          updatedAt: now,
        },
      ],
      monthlyBillAmount: 900,
      pendingAmount: 820,
      nextDueDate: nextDeliveryIso(2),
      nextDeliveryDate: nextDeliveryIso(1),
      createdAt: now,
      updatedAt: now,
    },
  ];

  await writeCustomers(seeded);
  return seeded;
}

function computeMonthlyBill(subscription: Customer['subscription']): number {
  // Simple mock estimate: fixed rupees per item line, keeps UI stable.
  const basePerItem = 480;
  return Math.max(0, subscription.length) * basePerItem;
}

function computeMonthlyBillFromPlans(plans: Customer['subscriptionPlans']): number {
  const active = (plans ?? []).filter((p) => p.status === 'Active');
  const perDay = active.reduce((sum, p) => {
    const items = Math.max(1, Number((p as any).numberOfItems ?? 1));
    const base = Number(p.originalPrice ?? 0);
    const disc = Number(p.discountedPrice ?? 0);
    const unit = disc > 0 && disc < base ? disc : base;
    const line = items * (Number.isFinite(unit) ? unit : 0);
    return sum + line;
  }, 0);
  // Simple monthly estimate (30 days); real billing will be based on delivery logs later.
  return Math.round(perDay * 30);
}

export class CustomerServiceMock implements ICustomerService {
  async list(): Promise<CustomerListResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await ensureSeedCustomers();
    return { items, total: items.length };
  }

  async getById(id: string): Promise<CustomerResponse | null> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await ensureSeedCustomers();
    return items.find((c) => c.id === id) ?? null;
  }

  async create(data: CreateCustomerRequest): Promise<CustomerResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await ensureSeedCustomers();
    const now = nowIso();
    const subscription = data.subscription ?? [];
    const subscriptionPlans = (data.subscriptionPlans ?? []).map((p) => ({
      id: newId('sub'),
      createdAt: now,
      updatedAt: now,
      ...p,
    }));
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
    const items = await ensureSeedCustomers();
    const idx = items.findIndex((c) => c.id === id);
    if (idx < 0) {
      throw new Error(`Customer not found: ${id}`);
    }
    const now = nowIso();
    const current = items[idx]!;
    /** Distinguish “omit field” (keep current) from “send []” (clear). */
    const subscription = data.subscription !== undefined ? data.subscription : current.subscription;
    const subscriptionPlans =
      data.subscriptionPlans !== undefined
        ? data.subscriptionPlans.map((p) => ({
            id: newId('sub'),
            createdAt: now,
            updatedAt: now,
            ...p,
          }))
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
    return updated;
  }

  async delete(id: string): Promise<void> {
    await sleep(DEFAULT_DELAY_MS);
    const items = await ensureSeedCustomers();
    await writeCustomers(items.filter((c) => c.id !== id));
  }
}

