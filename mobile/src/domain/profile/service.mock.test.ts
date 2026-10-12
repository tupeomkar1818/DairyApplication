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

import { AuthServiceMock } from '@/src/domain/auth/service.mock';
import { ProfileServiceMock } from '@/src/domain/profile/service.mock';
import { DomainError } from '@/src/domain/shared/errors';
import { CUSTOMERS_STORE_KEY, DELIVERY_BOYS_STORE_KEY } from '@/src/infrastructure/storage/keys';

const auth = new AuthServiceMock();
const profile = new ProfileServiceMock();

async function run<T>(fn: () => Promise<T>): Promise<T> {
  const p = fn();
  p.catch(() => undefined);
  await vi.runAllTimersAsync();
  return p;
}

async function login(mobileNumber: string) {
  const otp = await run(() => auth.requestOtp({ mobileNumber }));
  return run(() => auth.verifyOtp({ mobileNumber, otp: otp.demoOtp ?? '' }));
}

async function saveOtp(): Promise<string> {
  const res = await run(() => profile.requestSaveOtp());
  return res.demoOtp ?? '';
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

describe('ProfileServiceMock.updateProfileWithOtp', () => {
  it('clears optional customer fields sent blank, keeps unsent ones and required ones', async () => {
    memory.set(
      CUSTOMERS_STORE_KEY,
      JSON.stringify([
        {
          id: 'cust_1',
          name: 'Asha',
          mobile: '9123456780',
          status: 'Active',
          address: 'Ward 3',
          societyName: 'Shiv Residency',
          houseFlatNumber: 'B-402',
          alternateMobile: '9000000002',
        },
      ]),
    );
    await login('9123456780');

    const otp = await saveOtp();
    const res = await run(() =>
      profile.updateProfileWithOtp({
        displayName: 'Asha Patil',
        address: '',
        houseFlatNumber: '',
        alternateMobile: '',
        otp,
      }),
    );

    expect(res.profile.displayName).toBe('Asha Patil');
    expect(res.profile.alternateMobile).toBeUndefined();
    expect(res.profile.houseFlatNumber).toBeUndefined();
    // Required on the customer record: blank does not clear; unsent keeps existing.
    expect(res.profile.address).toBe('Ward 3');
    expect(res.profile.societyName).toBe('Shiv Residency');
  });

  it('clears optional delivery boy fields sent blank', async () => {
    memory.set(
      DELIVERY_BOYS_STORE_KEY,
      JSON.stringify([
        {
          id: 'db_1',
          fullName: 'Ravi',
          mobileNumber: '9000000001',
          status: 'Active',
          appAccessEnabled: true,
          address: 'Depot road',
          emergencyContactName: 'Family',
          emergencyContactNumber: '9000000101',
        },
      ]),
    );
    await login('9000000001');

    const otp = await saveOtp();
    const res = await run(() =>
      profile.updateProfileWithOtp({
        displayName: 'Ravi K',
        address: 'Depot road',
        emergencyContactName: '',
        emergencyContactNumber: '',
        otp,
      }),
    );

    expect(res.profile.displayName).toBe('Ravi K');
    expect(res.profile.address).toBe('Depot road');
    expect(res.profile.emergencyContactName).toBeUndefined();
    expect(res.profile.emergencyContactNumber).toBeUndefined();
  });

  it('fails loudly (without consuming the OTP) when details cannot be saved for an unlinked profile', async () => {
    // A customer whose record the admin deleted while they were still signed in.
    memory.set(CUSTOMERS_STORE_KEY, JSON.stringify([{ id: 'cust_gone', name: 'Asha', mobile: '9123456780', status: 'Active', address: 'Ward 3', societyName: 'Shiv Residency' }]));
    await login('9123456780');
    memory.set(CUSTOMERS_STORE_KEY, JSON.stringify([]));
    const otp = await saveOtp();

    let caught: unknown;
    try {
      await run(() => profile.updateProfileWithOtp({ displayName: 'Asha P', address: 'Somewhere', otp }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DomainError);

    // A name-only change is still possible with the same (unconsumed) OTP.
    const res = await run(() =>
      profile.updateProfileWithOtp({ displayName: 'Asha P', address: '', alternateMobile: '', otp }),
    );
    expect(res.profile.displayName).toBe('Asha P');
  });
});
