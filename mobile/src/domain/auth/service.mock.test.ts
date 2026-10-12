import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** In-memory AsyncStorage / SecureStore backing for the mock services. */
const memory = vi.hoisted(() => new Map<string, string>());

vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => memory.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: async (key: string) => {
      memory.delete(key);
    },
  },
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => memory.get(`secure:${key}`) ?? null,
  setItemAsync: async (key: string, value: string) => {
    memory.set(`secure:${key}`, value);
  },
  deleteItemAsync: async (key: string) => {
    memory.delete(`secure:${key}`);
  },
}));

import type { User } from '@/src/domain/auth/entities';
import { AuthServiceMock } from '@/src/domain/auth/service.mock';
import { DomainError, type DomainErrorCode } from '@/src/domain/shared/errors';
import { CUSTOMERS_STORE_KEY, DELIVERY_BOYS_STORE_KEY, USERS_STORE_KEY } from '@/src/infrastructure/storage/keys';

type CustomerRow = { id: string; name: string; mobile: string; status: string; appAccessEnabled?: boolean };
type DeliveryBoyRow = { id: string; fullName: string; mobileNumber: string; status: string; appAccessEnabled: boolean };

const svc = new AuthServiceMock();

function seedCustomers(rows: CustomerRow[]) {
  memory.set(CUSTOMERS_STORE_KEY, JSON.stringify(rows));
}

function seedDeliveryBoys(rows: DeliveryBoyRow[]) {
  memory.set(DELIVERY_BOYS_STORE_KEY, JSON.stringify(rows));
}

function storedUsers(): User[] {
  return JSON.parse(memory.get(USERS_STORE_KEY) ?? '[]') as User[];
}

/** Runs a service call to completion under fake timers (the mocks sleep before responding). */
async function run<T>(fn: () => Promise<T>): Promise<T> {
  const p = fn();
  p.catch(() => undefined);
  await vi.runAllTimersAsync();
  return p;
}

async function expectDomainError(fn: () => Promise<unknown>, code: DomainErrorCode): Promise<DomainError> {
  let caught: unknown;
  try {
    await run(fn);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(DomainError);
  expect((caught as DomainError).code).toBe(code);
  return caught as DomainError;
}

async function login(mobileNumber: string) {
  const otp = await run(() => svc.requestOtp({ mobileNumber }));
  return run(() => svc.verifyOtp({ mobileNumber, otp: otp.demoOtp ?? '' }));
}

beforeEach(() => {
  memory.clear();
  vi.useFakeTimers({ now: new Date('2026-09-15T08:00:00.000Z') });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AuthServiceMock — admin-created accounts', () => {
  it('lets an admin-created customer log in and provisions a customer user after OTP verification', async () => {
    seedCustomers([{ id: 'cust_1', name: 'Asha Patil', mobile: '9123456780', status: 'Active', appAccessEnabled: true }]);

    const otp = await run(() => svc.requestOtp({ mobileNumber: '9123456780' }));
    expect(otp.demoOtp).toMatch(/^\d{6}$/);
    expect(otp.maskedMobileNumber).toBe('+91 91XXXXXX80');
    // Nothing is provisioned before the OTP is verified.
    expect(storedUsers().some((u) => u.mobileNumber === '9123456780')).toBe(false);

    const { session } = await run(() => svc.verifyOtp({ mobileNumber: '9123456780', otp: otp.demoOtp ?? '' }));
    expect(session.role).toBe('customer');
    expect(session.mobileNumber).toBe('9123456780');

    const user = storedUsers().find((u) => u.id === session.userId);
    expect(user).toMatchObject({ role: 'customer', name: 'Asha Patil', linkedRecordId: 'cust_1', isActive: true });

    const current = await run(() => svc.getSession());
    expect(current).toMatchObject({ userId: session.userId, role: 'customer' });
  });

  it('lets an admin-created delivery boy log in with the delivery_boy role', async () => {
    seedDeliveryBoys([
      { id: 'db_1', fullName: 'Ravi', mobileNumber: '9000000001', status: 'Active', appAccessEnabled: true },
    ]);
    const { session } = await login('9000000001');
    expect(session.role).toBe('delivery_boy');
    expect(storedUsers().find((u) => u.id === session.userId)?.linkedRecordId).toBe('db_1');
  });

  it('reuses the same user on repeat logins (no duplicate rows)', async () => {
    seedCustomers([{ id: 'cust_1', name: 'Asha', mobile: '9123456780', status: 'Active' }]);
    const first = await login('9123456780');
    vi.setSystemTime(Date.now() + 61_000);
    const second = await login('9123456780');
    expect(second.session.userId).toBe(first.session.userId);
    expect(storedUsers().filter((u) => u.mobileNumber === '9123456780')).toHaveLength(1);
  });

  it('rejects an inactive customer', async () => {
    seedCustomers([{ id: 'cust_1', name: 'Asha', mobile: '9123456780', status: 'Inactive', appAccessEnabled: true }]);
    await expectDomainError(() => svc.requestOtp({ mobileNumber: '9123456780' }), 'USER_INACTIVE');
  });

  it('rejects a customer whose app access is disabled', async () => {
    seedCustomers([{ id: 'cust_1', name: 'Asha', mobile: '9123456780', status: 'Active', appAccessEnabled: false }]);
    await expectDomainError(() => svc.requestOtp({ mobileNumber: '9123456780' }), 'USER_INACTIVE');
  });

  it('rejects a delivery boy whose app access is disabled or who is inactive', async () => {
    seedDeliveryBoys([
      { id: 'db_1', fullName: 'Ravi', mobileNumber: '9000000001', status: 'Active', appAccessEnabled: false },
      { id: 'db_2', fullName: 'Sunil', mobileNumber: '9000000002', status: 'Inactive', appAccessEnabled: true },
    ]);
    await expectDomainError(() => svc.requestOtp({ mobileNumber: '9000000001' }), 'USER_INACTIVE');
    await expectDomainError(() => svc.requestOtp({ mobileNumber: '9000000002' }), 'USER_INACTIVE');
  });

  it('enforces the linked record status for an existing (seeded) user', async () => {
    seedCustomers([{ id: 'cust_demo', name: 'Customer', mobile: '8626046043', status: 'Inactive' }]);
    await expectDomainError(() => svc.requestOtp({ mobileNumber: '8626046043' }), 'USER_INACTIVE');
  });

  it('re-checks account state at verify time (deactivated after the OTP was sent)', async () => {
    seedCustomers([{ id: 'cust_1', name: 'Asha', mobile: '9123456780', status: 'Active' }]);
    const otp = await run(() => svc.requestOtp({ mobileNumber: '9123456780' }));
    seedCustomers([{ id: 'cust_1', name: 'Asha', mobile: '9123456780', status: 'Inactive' }]);
    await expectDomainError(
      () => svc.verifyOtp({ mobileNumber: '9123456780', otp: otp.demoOtp ?? '' }),
      'USER_INACTIVE',
    );
  });

  it('starts with only the admin login: the old demo customer and delivery numbers are not registered', async () => {
    const admin = await login('8208682688');
    expect(admin.session.role).toBe('admin');
    await expectDomainError(() => svc.requestOtp({ mobileNumber: '8626046043' }), 'MOBILE_NOT_REGISTERED');
    await expectDomainError(() => svc.requestOtp({ mobileNumber: '9876543210' }), 'MOBILE_NOT_REGISTERED');
  });

  it('drops demo rows left over from before (a login with no record behind it)', async () => {
    memory.set(USERS_STORE_KEY, JSON.stringify([{ id: 'user_demo', name: 'Customer', mobileNumber: '8626046043', role: 'customer', isActive: true, createdAt: '', updatedAt: '' }]));
    await expectDomainError(() => svc.requestOtp({ mobileNumber: '8626046043' }), 'MOBILE_NOT_REGISTERED');
    // The admin is added even though the users store was not empty.
    expect((await login('8208682688')).session.role).toBe('admin');
  });

  it('rejects unknown numbers', async () => {
    await expectDomainError(() => svc.requestOtp({ mobileNumber: '9555555555' }), 'MOBILE_NOT_REGISTERED');
  });

  it('rejects a provisioned user whose customer record was deleted', async () => {
    seedCustomers([{ id: 'cust_1', name: 'Asha', mobile: '9123456780', status: 'Active' }]);
    await login('9123456780');
    seedCustomers([]);
    vi.setSystemTime(Date.now() + 61_000);
    await expectDomainError(() => svc.requestOtp({ mobileNumber: '9123456780' }), 'MOBILE_NOT_REGISTERED');
  });

  it('follows an admin mobile-number change: old number rejected, new number keeps the same user', async () => {
    seedCustomers([{ id: 'cust_1', name: 'Asha', mobile: '9123456780', status: 'Active' }]);
    const first = await login('9123456780');

    seedCustomers([{ id: 'cust_1', name: 'Asha', mobile: '9123456781', status: 'Active' }]);
    await expectDomainError(() => svc.requestOtp({ mobileNumber: '9123456780' }), 'MOBILE_NOT_REGISTERED');

    const second = await login('9123456781');
    expect(second.session.userId).toBe(first.session.userId);
    expect(storedUsers().find((u) => u.id === first.session.userId)?.mobileNumber).toBe('9123456781');
  });
});

describe('AuthServiceMock — resend cooldown', () => {
  it('returns the existing challenge when login is re-submitted during the cooldown', async () => {
    const first = await run(() => svc.requestOtp({ mobileNumber: '8208682688' }));
    vi.setSystemTime(Date.now() + 10_000);
    const again = await run(() => svc.requestOtp({ mobileNumber: '8208682688' }));
    expect(again).toEqual(first);

    // The resumed challenge is still verifiable.
    const { session } = await run(() => svc.verifyOtp({ mobileNumber: '8208682688', otp: again.demoOtp ?? '' }));
    expect(session.role).toBe('admin');
  });

  it('issues a fresh challenge once the cooldown has passed', async () => {
    const first = await run(() => svc.requestOtp({ mobileNumber: '8208682688' }));
    vi.setSystemTime(Date.now() + 61_000);
    const next = await run(() => svc.requestOtp({ mobileNumber: '8208682688' }));
    expect(next.resendAvailableAt).not.toBe(first.resendAvailableAt);
    expect(new Date(next.otpExpiryAt).getTime()).toBeGreaterThan(new Date(first.otpExpiryAt).getTime());
  });

  it('still throws OTP_RESEND_COOLDOWN when the pending challenge has no attempts left', async () => {
    const first = await run(() => svc.requestOtp({ mobileNumber: '8208682688' }));
    const wrong = first.demoOtp === '000000' ? '111111' : '000000';
    for (let i = 0; i < 3; i += 1) {
      await expectDomainError(() => svc.verifyOtp({ mobileNumber: '8208682688', otp: wrong }), 'OTP_INVALID');
    }
    await expectDomainError(() => svc.requestOtp({ mobileNumber: '8208682688' }), 'OTP_RESEND_COOLDOWN');
  });
});
