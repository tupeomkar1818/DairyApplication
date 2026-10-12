import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    getAllKeys: vi.fn(async () => [...store.keys()]),
    multiRemove: vi.fn(async (keys: string[]) => {
      for (const k of keys) store.delete(k);
    }),
  };
});

vi.mock('@/src/infrastructure/storage/storage', () => ({
  readJson: async (key: string) => {
    const raw = storage.store.get(key);
    return raw ? JSON.parse(raw) : null;
  },
  writeJson: async (key: string, value: unknown) => {
    storage.store.set(key, JSON.stringify(value));
  },
  subscribeStorageKey: () => () => undefined,
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getAllKeys: storage.getAllKeys, multiRemove: storage.multiRemove },
}));

import { buildSubscriptionPayloadFromPlans } from '@/src/components/admin/buildSubscriptionPayloadFromPlans';
import {
  customerFormFromResponse,
  emptyCustomerForm,
  sanitizeMobileInput,
  validateCustomerEditForm,
  validateCustomerForm,
} from '@/src/components/admin/customerFormShared';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { CustomerServiceMock } from '@/src/domain/customers/service.mock';
import { CustomerSubscriptionFieldsUpdateSchema } from '@/src/domain/customers/validations';
import { DomainError } from '@/src/domain/shared/errors';

function baseCustomer(overrides: Partial<CustomerResponse> = {}): CustomerResponse {
  return {
    id: 'cust_1',
    name: 'Asha',
    mobile: '9876543210',
    address: 'A-1, Green View',
    societyName: 'Green View',
    houseFlatNumber: 'A-1',
    landmark: 'Near temple',
    deliveryTime: 'Evening',
    paymentType: 'UPI',
    status: 'Active',
    appAccessEnabled: false,
    billingType: 'Postpaid',
    billingCycleDate: 31,
    lastPaymentDate: '2026-09-01T20:00:00.000Z',
    subscriptionFrequency: 'Weekend Only',
    subscription: [],
    subscriptionPlans: [
      {
        id: 'sub_keep',
        productName: 'Cow Milk',
        numberOfItems: 1,
        quantityLabel: '500 ml',
        deliveryTime: 'Morning',
        frequency: 'Daily',
        startDate: '2026-09-10T00:00:00.000Z',
        endDate: '2026-11-20',
        originalPrice: 30,
        status: 'Active',
        createdAt: '2026-09-10T08:00:00.000Z',
        updatedAt: '2026-09-10T08:00:00.000Z',
      },
    ],
    monthlyBillAmount: 0,
    nextDeliveryDate: '2026-09-16T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('customerFormFromResponse', () => {
  it('keeps plan identity and the stored end date (not end of the start month)', () => {
    const form = customerFormFromResponse(baseCustomer());
    const row = form.subscriptionPlans[0]!;
    expect(row.id).toBe('sub_keep');
    expect(row.createdAt).toBe('2026-09-10T08:00:00.000Z');
    expect(row.endDate).toBe('20/11/2026');
    // Full ISO timestamps map to a real DD/MM/YYYY (previously '' → "Start date must be valid").
    expect(row.startDate).toMatch(/^\d{2}\/09\/2026$/);
  });

  it('defaults a missing plan end date to the end of its start month', () => {
    const c = baseCustomer();
    const form = customerFormFromResponse({ ...c, subscriptionPlans: [{ ...c.subscriptionPlans![0]!, startDate: '2026-02-10', endDate: undefined }] });
    expect(form.subscriptionPlans[0]!.endDate).toBe('28/02/2026');
  });

  it('reads stored values instead of hard-coded defaults', () => {
    const form = customerFormFromResponse(baseCustomer());
    expect(form.appAccessEnabled).toBe(false);
    expect(form.subscriptionFrequency).toBe('Weekend Only');
    expect(form.paymentType).toBe('UPI');
    expect(form.billingCycleDate).toBe('31');
    expect(form.lastPaymentDate).toMatch(/^\d{2}\/09\/2026$/);
  });
});

describe('validateCustomerForm (new customer)', () => {
  it('starts with no subscription and saves one without a plan', () => {
    const form = emptyCustomerForm();
    expect(form.subscriptionPlans).toEqual([]);
    const parsed = validateCustomerForm(
      { ...form, name: 'Priya', mobile: '9123456780', houseFlatNumber: 'A-1', societyName: 'Green Park', address: 'A-1, Green Park' },
      [],
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.subscription).toEqual([]);
    expect(parsed.data.subscriptionPlans).toBeUndefined();
  });
});

describe('validateCustomerEditForm', () => {
  it('sends only edited fields and allows a customer without plans', () => {
    const parsed = validateCustomerEditForm(customerFormFromResponse(baseCustomer({ subscriptionPlans: [] })));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const keys = Object.keys(parsed.data);
    for (const untouched of ['subscription', 'subscriptionPlans', 'lastPaymentDate', 'nextDueDate', 'subscriptionFrequency', 'preferredPaymentMode']) {
      expect(keys).not.toContain(untouched);
    }
    // Landmark is editable on the form, so it round-trips.
    expect(parsed.data.landmark).toBe('Near temple');
    expect(parsed.data.paymentType).toBe('UPI');
    expect(parsed.data.deliveryTime).toBe('Evening');
    // Billing date shows a clamped day in short months; the stored month-end (31) cycle day is kept.
    expect(parsed.data.billingCycleDate).toBe(31);
  });
});

describe('sanitizeMobileInput', () => {
  it('strips a pasted +91 / leading 0 prefix', () => {
    expect(sanitizeMobileInput('+91 98765 43210')).toBe('9876543210');
    expect(sanitizeMobileInput('098765 43210')).toBe('9876543210');
    expect(sanitizeMobileInput('9123456789')).toBe('9123456789');
    // An extra digit typed onto a full number starting with 91 is dropped, not the prefix.
    expect(sanitizeMobileInput('91234567890')).toBe('9123456789');
  });
});

/** The service starts empty, so each test adds the customers it needs, the way the admin would. */
async function addCustomer(svc: CustomerServiceMock, overrides: Partial<CustomerResponse> = {}): Promise<CustomerResponse> {
  const { id: _id, createdAt: _c, updatedAt: _u, lastPaymentDate: _l, ...data } = baseCustomer(overrides);
  const created = await svc.create(data as never);
  return (await svc.getById(created.id))!;
}

describe('CustomerServiceMock plan identity', () => {
  beforeEach(() => {
    storage.store.clear();
    storage.getAllKeys.mockClear();
    storage.multiRemove.mockClear();
  });

  it('preserves plan id/createdAt through form → payload → update and keeps the end date', async () => {
    const svc = new CustomerServiceMock();
    expect((await svc.list()).items).toEqual([]);
    const before = await addCustomer(svc, { mobile: '9999999999' });

    const form = customerFormFromResponse(before);
    const built = buildSubscriptionPayloadFromPlans(form.subscriptionPlans, []);
    const payload = CustomerSubscriptionFieldsUpdateSchema.parse({
      deliveryTime: before.deliveryTime,
      subscription: built.subscription,
      subscriptionPlans: built.subscriptionPlans,
    });
    const updated = await svc.update(before.id, payload);

    const plans = updated.subscriptionPlans ?? [];
    expect(plans.map((p) => p.id)).toEqual((before.subscriptionPlans ?? []).map((p) => p.id));
    expect(plans.map((p) => p.createdAt)).toEqual((before.subscriptionPlans ?? []).map((p) => p.createdAt));
    expect(plans.map((p) => p.endDate)).toEqual((before.subscriptionPlans ?? []).map((p) => p.endDate));
  }, 10_000);

  it('profile edit keeps stored plans and non-edited fields', async () => {
    const svc = new CustomerServiceMock();
    const sneha = await addCustomer(svc, { name: 'Sneha', mobile: '8888888888' });
    const parsed = validateCustomerEditForm({ ...customerFormFromResponse(sneha), name: 'Sneha K' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const updated = await svc.update(sneha.id, parsed.data);
    expect(updated.name).toBe('Sneha K');
    expect(updated.paymentType).toBe('UPI');
    expect(updated.subscriptionPlans).toEqual(sneha.subscriptionPlans);
    expect(updated.lastPaymentDate).toBeUndefined();
  }, 10_000);

  it('rejects duplicate mobiles and unknown ids with domain errors', async () => {
    const svc = new CustomerServiceMock();
    const rahul = await addCustomer(svc, { name: 'Rahul', mobile: '9999999999' });
    const sneha = await addCustomer(svc, { name: 'Sneha', mobile: '8888888888' });

    await expect(svc.update(sneha.id, { mobile: rahul.mobile })).rejects.toMatchObject({ code: 'CUSTOMER_MOBILE_EXISTS' });
    await expect(svc.update('missing', { name: 'x' })).rejects.toBeInstanceOf(DomainError);
  }, 10_000);

  it('delete removes the customer side stores', async () => {
    const svc = new CustomerServiceMock();
    const rahul = await addCustomer(svc, { mobile: '9999999999' });
    storage.store.set(`DAIRY_CUSTOMER_DAY_ORDER_V1:${rahul.id}`, '[]');
    storage.store.set(`DAIRY_CUSTOMER_BILL_LEDGER_V1:${rahul.id}:2026-09`, '[]');
    await svc.delete(rahul.id);
    expect(storage.store.has(`DAIRY_CUSTOMER_DAY_ORDER_V1:${rahul.id}`)).toBe(false);
    expect(storage.store.has(`DAIRY_CUSTOMER_BILL_LEDGER_V1:${rahul.id}:2026-09`)).toBe(false);
  }, 10_000);
});
