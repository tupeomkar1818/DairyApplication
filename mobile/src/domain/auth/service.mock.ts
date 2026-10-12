import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { IAuthService } from '@/src/domain/auth/service.interface';
import type { LoginRequest, LoginResponse, SetPinRequest } from '@/src/domain/auth/dtos';
import { readAuthSessionResponse } from '@/src/infrastructure/auth/sessionRead';
import type { AuthSessionResponse, RequestOtpRequest, RequestOtpResponse, VerifyOtpRequest, VerifyOtpResponse } from '@/src/domain/auth/dtos';
import type { AuthSession, OtpChallenge, User } from '@/src/domain/auth/entities';
import type { Customer } from '@/src/domain/customers/entities';
import type { DeliveryBoy } from '@/src/domain/deliveryBoys/entities';
import { DomainError } from '@/src/domain/shared/errors';
import {
  OTP_EXPIRY_MS,
  OTP_RESEND_COOLDOWN_MS,
  formatOtpCountdownMmSs,
  msUntilIso,
} from '@/src/domain/shared/otpPolicy';
import type { UserRole } from '@/src/domain/shared/enums';
import { strings } from '@/src/i18n/strings';
import { ADMIN_MOBILE_NUMBER } from '@/src/infrastructure/accountLinks';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';
import {
  CUSTOMERS_STORE_KEY,
  DELIVERY_BOYS_STORE_KEY,
  OTP_CHALLENGES_STORE_KEY,
  USERS_STORE_KEY,
} from '@/src/infrastructure/storage/keys';

type StoredOtpChallenges = Record<string, OtpChallenge>;

/** Admin-managed record (customer / delivery boy) that grants app login for its mobile number. */
type LinkedLoginRecord = {
  id: string;
  role: Extract<UserRole, 'customer' | 'delivery_boy'>;
  name: string;
  mobileNumber: string;
  /** Legacy rows may lack these — treated as Active / access enabled. */
  status?: string;
  appAccessEnabled?: boolean;
};

const SESSION_ID_KEY = 'DAIRY_SESSION_ID_V1';
const DEFAULT_DELAY_MS = 300;
const MAX_OTP_ATTEMPTS = 3;
const SESSION_STORE_PREFIX = 'DAIRY_SESSION_V1:';

function nowIso(): string {
  return new Date().toISOString();
}

function addMs(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function maskMobile(mobileNumber: string): string {
  if (mobileNumber.length !== 10) return mobileNumber;
  return `${mobileNumber.slice(0, 2)}XXXXXX${mobileNumber.slice(8)}`;
}

function randomOtp(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, '0');
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

/**
 * The login rows, with the admin always present. Customers and delivery partners have no rows until they first
 * sign in; their login comes from the record the admin created (see `resolveLoginUser`).
 */
async function loadUsers(): Promise<User[]> {
  const existing = (await readJson<User[]>(USERS_STORE_KEY)) ?? [];
  if (existing.some((u) => u.role === 'admin' && u.mobileNumber === ADMIN_MOBILE_NUMBER)) return existing;

  const now = nowIso();
  const admin: User = {
    id: newId('user'),
    name: 'Admin',
    mobileNumber: ADMIN_MOBILE_NUMBER,
    role: 'admin',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  const next = [admin, ...existing];
  await writeJson(USERS_STORE_KEY, next);
  return next;
}

/** Read-only lookup of admin-managed customer / delivery boy records by mobile number. */
async function findLinkedRecordsByMobile(mobileNumber: string): Promise<{
  customer: LinkedLoginRecord | undefined;
  deliveryBoy: LinkedLoginRecord | undefined;
}> {
  const customers = (await readJson<Customer[]>(CUSTOMERS_STORE_KEY)) ?? [];
  const deliveryBoys = (await readJson<DeliveryBoy[]>(DELIVERY_BOYS_STORE_KEY)) ?? [];
  const c = customers.find((x) => x.mobile === mobileNumber);
  const d = deliveryBoys.find((x) => x.mobileNumber === mobileNumber);
  return {
    customer: c
      ? {
          id: c.id,
          role: 'customer',
          name: c.name,
          mobileNumber: c.mobile,
          status: c.status,
          appAccessEnabled: c.appAccessEnabled,
        }
      : undefined,
    deliveryBoy: d
      ? {
          id: d.id,
          role: 'delivery_boy',
          name: d.fullName,
          mobileNumber: d.mobileNumber,
          status: d.status ?? ((d as { isActive?: boolean }).isActive === false ? 'Inactive' : 'Active'),
          appAccessEnabled: d.appAccessEnabled,
        }
      : undefined,
  };
}

function assertLinkedRecordAllowsLogin(record: LinkedLoginRecord): void {
  if ((record.status ?? 'Active') !== 'Active') {
    throw new DomainError('USER_INACTIVE', strings('auth').errors.inactive);
  }
  if (record.appAccessEnabled === false) {
    throw new DomainError('USER_INACTIVE', strings('auth').errors.appAccessDisabled);
  }
}

/**
 * Resolves the login user for a mobile number.
 * 1. Existing `User` row → must be active; when a customer / delivery boy record for that role exists,
 *    its admin-managed Active status and app access must also allow login.
 * 2. Otherwise an admin-created customer (then delivery boy) with this mobile → provisions a `User`
 *    (persisted only when `persist` is true, i.e. after the OTP is verified).
 */
async function resolveLoginUser(mobileNumber: string, persist: boolean): Promise<User> {
  const users = await loadUsers();
  const { customer, deliveryBoy } = await findLinkedRecordsByMobile(mobileNumber);

  const user = users.find((u) => u.mobileNumber === mobileNumber);
  if (user) {
    if (!user.isActive) {
      throw new DomainError('USER_INACTIVE', strings('auth').errors.inactive);
    }
    const linked = user.role === 'customer' ? customer : user.role === 'delivery_boy' ? deliveryBoy : undefined;
    if (linked && (!user.linkedRecordId || user.linkedRecordId === linked.id)) {
      assertLinkedRecordAllowsLogin(linked);
      return user;
    }
    // Provisioned from a record that was since deleted or moved to another mobile number.
    if (!user.linkedRecordId && user.role === 'admin') return user;
  }

  const record = customer ?? deliveryBoy;
  if (!record) {
    throw new DomainError('MOBILE_NOT_REGISTERED', strings('auth').errors.notRegistered);
  }
  assertLinkedRecordAllowsLogin(record);

  const now = nowIso();
  // Reuse the row provisioned earlier for this record (e.g. admin changed its mobile) so userId stays stable.
  const idx = users.findIndex((u) => u.linkedRecordId === record.id && u.role === record.role);
  const provisioned: User =
    idx >= 0
      ? { ...users[idx], name: record.name, mobileNumber, isActive: true, updatedAt: now }
      : {
          id: newId('user'),
          name: record.name,
          mobileNumber,
          role: record.role,
          isActive: true,
          linkedRecordId: record.id,
          createdAt: now,
          updatedAt: now,
        };

  if (persist) {
    const next = [...users];
    if (idx >= 0) next[idx] = provisioned;
    else next.push(provisioned);
    // A stale row still holding this mobile (its record moved away) must not shadow the new login.
    const cleaned = next.filter((u) => u === provisioned || u.mobileNumber !== mobileNumber);
    await writeJson(USERS_STORE_KEY, cleaned);
  }
  return provisioned;
}

function challengeResponse(challenge: OtpChallenge): RequestOtpResponse {
  return {
    maskedMobileNumber: `+91 ${maskMobile(challenge.mobileNumber)}`,
    resendAvailableAt: challenge.resendAvailableAt,
    otpExpiryAt: challenge.otpExpiryAt,
    demoOtp: challenge.otp,
  };
}

async function readChallenges(): Promise<StoredOtpChallenges> {
  return (await readJson<StoredOtpChallenges>(OTP_CHALLENGES_STORE_KEY)) ?? {};
}

async function writeChallenges(challenges: StoredOtpChallenges): Promise<void> {
  await writeJson(OTP_CHALLENGES_STORE_KEY, challenges);
}

async function sessionSetItem(key: string, value: string): Promise<void> {
  // SecureStore is not consistently available on web, and can throw.
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(`${SESSION_STORE_PREFIX}${key}`, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function sessionGetItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(`${SESSION_STORE_PREFIX}${key}`);
  }
  return SecureStore.getItemAsync(key);
}

async function sessionDeleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(`${SESSION_STORE_PREFIX}${key}`);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export class AuthServiceMock implements IAuthService {
  /**
   * A number and a password: the PIN, or their own mobile number the first time.
   *
   * On a phone keeping its own records the PIN is kept with the login row. Everything on this phone is already
   * in the open to anyone holding it — the PIN is what stops the wrong person opening the app, not a secret
   * being guarded from the phone itself.
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const user = await resolveLoginUser(data.mobileNumber, true);
    const users = await loadUsers();
    const stored = users.find((u) => u.id === user.id) ?? user;
    const given = String(data.secret ?? '').replace(/\s+/g, '');

    if (stored.pin) {
      if (given !== stored.pin) throw new DomainError('PIN_INVALID', strings('auth').errors.pinWrong);
    } else if (given !== data.mobileNumber) {
      throw new DomainError('PASSWORD_INVALID', strings('auth').errors.firstTimeWrong);
    }

    const session = await this.createSessionForUser(stored.id, stored.mobileNumber, stored.role);
    return { session, mustSetPin: !stored.pin };
  }

  async setPin(data: SetPinRequest): Promise<void> {
    await sleep(DEFAULT_DELAY_MS);
    const pin = String(data.pin ?? '').trim();
    if (!/^\d{4}$/.test(pin)) throw new DomainError('PIN_INVALID', strings('auth').errors.pinFourDigits);

    const session = await readAuthSessionResponse();
    if (!session) throw new DomainError('SESSION_NOT_FOUND', strings('auth').errors.sessionGone);

    const users = await loadUsers();
    const index = users.findIndex((u) => u.id === session.userId);
    if (index < 0) throw new DomainError('SESSION_NOT_FOUND', strings('auth').errors.sessionGone);
    // Changing a PIN needs the one in use; choosing the first does not — the mobile number proved the phone.
    if (users[index]!.pin && users[index]!.pin !== String(data.currentPin ?? '').trim()) {
      throw new DomainError('PIN_INVALID', strings('auth').errors.pinWrong);
    }
    users[index] = { ...users[index]!, pin, updatedAt: nowIso() };
    await writeJson(USERS_STORE_KEY, users);
  }

  /** The dairy forgets somebody’s PIN: they sign in with their own number again and choose a new one. */
  async resetPin(mobileNumber: string): Promise<void> {
    await sleep(DEFAULT_DELAY_MS);
    const users = await loadUsers();
    const index = users.findIndex((u) => u.mobileNumber === mobileNumber);
    if (index < 0) return;
    users[index] = { ...users[index]!, pin: undefined, updatedAt: nowIso() };
    await writeJson(USERS_STORE_KEY, users);
  }

  async requestOtp(data: RequestOtpRequest): Promise<RequestOtpResponse> {
    await sleep(DEFAULT_DELAY_MS);
    await resolveLoginUser(data.mobileNumber, false);

    const challenges = await readChallenges();
    const existing = challenges[data.mobileNumber];
    const now = nowIso();

    if (existing) {
      const resendAvailableAtMs = new Date(existing.resendAvailableAt).getTime();
      if (Date.now() < resendAvailableAtMs) {
        // Re-submitting login during the cooldown resumes the pending challenge instead of failing.
        // (The OTP screen's explicit Resend stays disabled until the cooldown ends.)
        const stillUsable =
          Date.now() <= new Date(existing.otpExpiryAt).getTime() && existing.attempts < MAX_OTP_ATTEMPTS;
        if (stillUsable) return challengeResponse(existing);
        throw new DomainError(
          'OTP_RESEND_COOLDOWN',
          strings('auth').errors.resendOtpIn(formatOtpCountdownMmSs(msUntilIso(existing.resendAvailableAt))),
        );
      }
    }

    const otp = randomOtp();
    const otpExpiryAt = addMs(now, OTP_EXPIRY_MS);
    const resendAvailableAt = addMs(now, OTP_RESEND_COOLDOWN_MS);

    const challenge: OtpChallenge = {
      mobileNumber: data.mobileNumber,
      otp,
      otpExpiryAt,
      attempts: 0,
      resendAvailableAt,
    };
    challenges[data.mobileNumber] = challenge;
    await writeChallenges(challenges);

    // For local development visibility (do not show in UI):
    // eslint-disable-next-line no-console
    console.log(`[AuthServiceMock] OTP for ${data.mobileNumber}: ${otp}`);

    return challengeResponse(challenge);
  }

  async verifyOtp(data: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    await sleep(DEFAULT_DELAY_MS);
    // Re-check account state (admin may have deactivated it since the OTP was sent) before consuming the OTP.
    await resolveLoginUser(data.mobileNumber, false);

    const challenges = await readChallenges();
    const challenge = challenges[data.mobileNumber];
    if (!challenge) {
      throw new DomainError('OTP_EXPIRED', strings('auth').errors.otpExpired);
    }

    const expiryMs = new Date(challenge.otpExpiryAt).getTime();
    if (Date.now() > expiryMs) {
      delete challenges[data.mobileNumber];
      await writeChallenges(challenges);
      throw new DomainError('OTP_EXPIRED', strings('auth').errors.otpExpired);
    }

    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      throw new DomainError('OTP_TOO_MANY_ATTEMPTS', strings('auth').errors.tooManyAttempts);
    }

    if (challenge.otp !== data.otp) {
      challenges[data.mobileNumber] = { ...challenge, attempts: challenge.attempts + 1 };
      await writeChallenges(challenges);
      throw new DomainError('OTP_INVALID', strings('auth').errors.invalidOtpEntered);
    }

    delete challenges[data.mobileNumber];
    await writeChallenges(challenges);

    const user = await resolveLoginUser(data.mobileNumber, true);
    const session = await this.createSessionForUser(user.id, user.mobileNumber, user.role);
    return { session };
  }

  async getSession(): Promise<AuthSessionResponse | null> {
    await sleep(DEFAULT_DELAY_MS);
    const sessionId = await sessionGetItem(SESSION_ID_KEY);
    if (!sessionId) return null;

    const raw = await sessionGetItem(sessionId);
    if (!raw) return null;

    const session = JSON.parse(raw) as AuthSession;
    return {
      sessionId: session.id,
      userId: session.userId,
      mobileNumber: session.mobileNumber,
      role: session.role,
      createdAt: session.createdAt,
    };
  }

  async logout(): Promise<void> {
    await sleep(DEFAULT_DELAY_MS);
    const sessionId = await sessionGetItem(SESSION_ID_KEY);
    if (sessionId) {
      await sessionDeleteItem(sessionId);
    }
    await sessionDeleteItem(SESSION_ID_KEY);
  }

  private async createSessionForUser(userId: string, mobileNumber: string, role: UserRole): Promise<AuthSessionResponse> {
    const now = nowIso();
    const session: AuthSession = {
      id: newId('session'),
      userId,
      mobileNumber,
      role,
      createdAt: now,
      updatedAt: now,
    };

    await sessionSetItem(SESSION_ID_KEY, session.id);
    await sessionSetItem(session.id, JSON.stringify(session));

    return {
      sessionId: session.id,
      userId: session.userId,
      mobileNumber: session.mobileNumber,
      role: session.role,
      createdAt: session.createdAt,
    };
  }
}

