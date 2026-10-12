import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = vi.hoisted(() => new Map<string, string>());

vi.mock('@/src/infrastructure/storage/storage', () => ({
  readJson: async (key: string) => {
    const raw = memory.get(key);
    return raw ? JSON.parse(raw) : null;
  },
  writeJson: async (key: string, value: unknown) => {
    memory.set(key, JSON.stringify(value));
  },
  subscribeStorageKey: () => () => undefined,
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getAllKeys: async () => [...memory.keys()],
    multiRemove: async (keys: string[]) => keys.forEach((k) => memory.delete(k)),
  },
}));

import type { User } from '@/src/domain/auth/entities';
import type { CreateCustomerRequest } from '@/src/domain/customers/dtos';
import { CustomerServiceMock } from '@/src/domain/customers/service.mock';
import type { CreateDeliveryBoyRequest } from '@/src/domain/deliveryBoys/dtos';
import { DeliveryBoyServiceMock } from '@/src/domain/deliveryBoys/service.mock';
import { ProductServiceMock } from '@/src/domain/products/service.mock';
import { ADMIN_MOBILE_NUMBER } from '@/src/infrastructure/accountLinks';
import { USERS_STORE_KEY } from '@/src/infrastructure/storage/keys';

const customers = new CustomerServiceMock();
const boys = new DeliveryBoyServiceMock();

function customerData(overrides: Partial<CreateCustomerRequest> = {}): CreateCustomerRequest {
  return {
    name: 'Asha',
    mobile: '9123456780',
    address: 'A-1',
    societyName: 'Green View',
    deliveryTime: 'Morning',
    paymentType: 'Cash',
    status: 'Active',
    subscription: [],
    ...overrides,
  } as CreateCustomerRequest;
}

function boyData(overrides: Partial<CreateDeliveryBoyRequest> = {}): CreateDeliveryBoyRequest {
  return {
    fullName: 'Sagar',
    mobileNumber: '9000000001',
    joiningDate: '2026-09-01',
    primaryRouteName: 'Route A',
    monthlySalary: 12000,
    ...overrides,
  };
}

function users(): User[] {
  return JSON.parse(memory.get(USERS_STORE_KEY) ?? '[]') as User[];
}

beforeEach(() => {
  memory.clear();
  vi.useFakeTimers();
});

/** The mock services pause before answering; run them to completion. */
async function run<T>(fn: () => Promise<T>): Promise<T> {
  const p = fn();
  p.catch(() => undefined);
  await vi.runAllTimersAsync();
  return p;
}

describe('starting fresh', () => {
  it('has no sample customers, delivery partners or products', async () => {
    expect((await run(() => customers.list())).items).toEqual([]);
    expect((await run(() => boys.list())).items).toEqual([]);
    expect((await run(() => new ProductServiceMock().list())).items).toEqual([]);
  });
});

describe('one mobile number, one person', () => {
  it("refuses a customer on a delivery partner's number or the admin's number, and the other way round", async () => {
    await run(() => boys.create(boyData({ mobileNumber: '9000000001' })));
    await expect(run(() => customers.create(customerData({ mobile: '9000000001' })))).rejects.toMatchObject({ code: 'MOBILE_IN_USE' });
    await expect(run(() => customers.create(customerData({ mobile: ADMIN_MOBILE_NUMBER })))).rejects.toMatchObject({ code: 'MOBILE_IN_USE' });

    const asha = await run(() => customers.create(customerData({ mobile: '9123456780' })));
    await expect(run(() => boys.create(boyData({ fullName: 'Ravi', mobileNumber: '9123456780' })))).rejects.toMatchObject({
      code: 'MOBILE_IN_USE',
    });
    // Keeping one's own number on an edit is fine.
    await expect(run(() => customers.update(asha.id, { mobile: '9123456780', name: 'Asha P' }))).resolves.toMatchObject({ name: 'Asha P' });
  });
});

describe('a login follows its record', () => {
  it('moves to the new number when the admin changes it, and goes when the record is deleted', async () => {
    const asha = await run(() => customers.create(customerData()));
    memory.set(
      USERS_STORE_KEY,
      JSON.stringify([{ id: 'user_asha', name: 'Asha', mobileNumber: '9123456780', role: 'customer', isActive: true, linkedRecordId: asha.id }]),
    );

    await run(() => customers.update(asha.id, { mobile: '9123456799' }));
    expect(users()).toMatchObject([{ id: 'user_asha', mobileNumber: '9123456799', linkedRecordId: asha.id }]);

    await run(() => customers.delete(asha.id));
    expect(users()).toEqual([]);
  });
});

describe("customers keep up with their delivery partner", () => {
  it("show a renamed partner's new name, and become unassigned when the partner is deleted", async () => {
    const sagar = await run(() => boys.create(boyData()));
    const asha = await run(() =>
      customers.create(customerData({ assignedDeliveryBoyId: sagar.id, assignedDeliveryBoyName: 'Sagar' } as Partial<CreateCustomerRequest>)),
    );
    const other = await run(() => customers.create(customerData({ name: 'Ravi', mobile: '9123456781' })));

    await run(() => boys.update(sagar.id, { fullName: 'Sagar Jadhav' }));
    expect((await run(() => customers.getById(asha.id)))?.assignedDeliveryBoyName).toBe('Sagar Jadhav');

    await run(() => boys.delete(sagar.id));
    const after = await run(() => customers.getById(asha.id));
    expect(after?.assignedDeliveryBoyId).toBeUndefined();
    expect(after?.assignedDeliveryBoyName).toBe('Unassigned');
    expect((await run(() => customers.getById(other.id)))?.name).toBe('Ravi');
  });
});
