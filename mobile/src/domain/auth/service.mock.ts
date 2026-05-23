import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { IAuthService } from '@/src/domain/auth/service.interface';
import type { AuthSessionResponse, RequestOtpRequest, RequestOtpResponse, VerifyOtpRequest, VerifyOtpResponse } from '@/src/domain/auth/dtos';
import type { AuthSession, OtpChallenge, User } from '@/src/domain/auth/entities';
import { DomainError } from '@/src/domain/shared/errors';
import {
  OTP_EXPIRY_MS,
  OTP_RESEND_COOLDOWN_MS,
  otpResendCooldownMessage,
} from '@/src/domain/shared/otpPolicy';
import type { UserRole } from '@/src/domain/shared/enums';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';
import { OTP_CHALLENGES_STORE_KEY, USERS_STORE_KEY } from '@/src/infrastructure/storage/keys';

type StoredOtpChallenges = Record<string, OtpChallenge>;

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

async function ensureSeedUsers(): Promise<User[]> {
  const existing = await readJson<User[]>(USERS_STORE_KEY);
  if (existing && existing.length > 0) return existing;

  const now = nowIso();
  const seeded: User[] = [
    {
      id: newId('user'),
      name: 'Admin',
      mobileNumber: '8208682688',
      role: 'admin',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId('user'),
      name: 'Customer',
      mobileNumber: '8626046043',
      role: 'customer',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId('user'),
      name: 'Delivery Boy',
      mobileNumber: '9876543210',
      role: 'delivery_boy',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  await writeJson(USERS_STORE_KEY, seeded);
  return seeded;
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
  async requestOtp(data: RequestOtpRequest): Promise<RequestOtpResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const users = await ensureSeedUsers();

    const user = users.find((u) => u.mobileNumber === data.mobileNumber);
    if (!user) {
      throw new DomainError('MOBILE_NOT_REGISTERED', 'Mobile number not registered');
    }
    if (!user.isActive) {
      throw new DomainError('USER_INACTIVE', 'Your account is inactive, contact admin.');
    }

    const challenges = await readChallenges();
    const existing = challenges[data.mobileNumber];
    const now = nowIso();

    if (existing) {
      const resendAvailableAtMs = new Date(existing.resendAvailableAt).getTime();
      if (Date.now() < resendAvailableAtMs) {
        throw new DomainError('OTP_RESEND_COOLDOWN', otpResendCooldownMessage(existing.resendAvailableAt));
      }
    }

    const otp = randomOtp();
    const otpExpiryAt = addMs(now, OTP_EXPIRY_MS);
    const resendAvailableAt = addMs(now, OTP_RESEND_COOLDOWN_MS);

    challenges[data.mobileNumber] = {
      mobileNumber: data.mobileNumber,
      otp,
      otpExpiryAt,
      attempts: 0,
      resendAvailableAt,
    };
    await writeChallenges(challenges);

    // For local development visibility (do not show in UI):
    // eslint-disable-next-line no-console
    console.log(`[AuthServiceMock] OTP for ${data.mobileNumber}: ${otp}`);

    return {
      maskedMobileNumber: `+91 ${maskMobile(data.mobileNumber)}`,
      resendAvailableAt,
      otpExpiryAt,
      demoOtp: otp,
    };
  }

  async verifyOtp(data: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const users = await ensureSeedUsers();
    const user = users.find((u) => u.mobileNumber === data.mobileNumber);
    if (!user) {
      throw new DomainError('MOBILE_NOT_REGISTERED', 'Mobile number not registered');
    }
    if (!user.isActive) {
      throw new DomainError('USER_INACTIVE', 'Your account is inactive, contact admin.');
    }

    const challenges = await readChallenges();
    const challenge = challenges[data.mobileNumber];
    if (!challenge) {
      throw new DomainError('OTP_EXPIRED', 'OTP expired, resend OTP');
    }

    const expiryMs = new Date(challenge.otpExpiryAt).getTime();
    if (Date.now() > expiryMs) {
      delete challenges[data.mobileNumber];
      await writeChallenges(challenges);
      throw new DomainError('OTP_EXPIRED', 'OTP expired, resend OTP');
    }

    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      throw new DomainError('OTP_TOO_MANY_ATTEMPTS', 'Maximum OTP attempts reached. Please resend OTP.');
    }

    if (challenge.otp !== data.otp) {
      challenges[data.mobileNumber] = { ...challenge, attempts: challenge.attempts + 1 };
      await writeChallenges(challenges);
      throw new DomainError('OTP_INVALID', 'Invalid OTP entered');
    }

    delete challenges[data.mobileNumber];
    await writeChallenges(challenges);

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

