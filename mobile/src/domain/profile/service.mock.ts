import type { IProfileService } from '@/src/domain/profile/service.interface';
import type {
  ProfileResponse,
  RequestNewMobileOtpRequest,
  UpdateProfileAvatarRequest,
  UpdateProfileWithOtpRequest,
  VerifyNewMobileRequest,
  VerifyOldMobileResponse,
  VerifyProfileOtpRequest,
} from '@/src/domain/profile/dtos';
import { UpdateProfileAvatarRequestSchema } from '@/src/domain/profile/validations';
import type { ProfileMobileChangeState, UserProfile } from '@/src/domain/profile/entities';
import type { OtpChallenge } from '@/src/domain/auth/entities';
import type { RequestOtpResponse } from '@/src/domain/auth/dtos';
import type { User } from '@/src/domain/auth/entities';
import type { Customer } from '@/src/domain/customers/entities';
import type { DeliveryBoy } from '@/src/domain/deliveryBoys/entities';
import { DomainError } from '@/src/domain/shared/errors';
import {
  OTP_EXPIRY_MS,
  OTP_RESEND_COOLDOWN_MS,
  otpResendCooldownMessage,
} from '@/src/domain/shared/otpPolicy';
import type { UserRole } from '@/src/domain/shared/enums';
import { readAuthSessionResponse, updateAuthSessionMobile } from '@/src/infrastructure/auth/sessionRead';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';
import {
  CUSTOMERS_STORE_KEY,
  DELIVERY_BOYS_STORE_KEY,
  OTP_CHALLENGES_STORE_KEY,
  PROFILE_AVATARS_STORE_KEY,
  PROFILE_MOBILE_CHANGE_STORE_KEY,
  USERS_STORE_KEY,
} from '@/src/infrastructure/storage/keys';

const DEFAULT_DELAY_MS = 200;
const MAX_OTP_ATTEMPTS = 3;

type StoredOtpChallenges = Record<string, OtpChallenge>;

type StoredProfileAvatar = {
  avatarUri: string;
  updatedAt: string;
};

type StoredProfileAvatars = Record<string, StoredProfileAvatar>;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

function addMs(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

function maskMobile(mobileNumber: string): string {
  if (mobileNumber.length !== 10) return mobileNumber;
  return `${mobileNumber.slice(0, 2)}XXXXXX${mobileNumber.slice(8)}`;
}

function randomOtp(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, '0');
}

function otpKey(purpose: 'save' | 'old' | 'new', mobile: string): string {
  return `profile_${purpose}_${mobile}`;
}

function roleLabel(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'customer':
      return 'Customer';
    case 'delivery_boy':
      return 'Delivery Partner';
    default:
      return role;
  }
}

function formatMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return mobile;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

async function readChallenges(): Promise<StoredOtpChallenges> {
  return (await readJson<StoredOtpChallenges>(OTP_CHALLENGES_STORE_KEY)) ?? {};
}

async function writeChallenges(challenges: StoredOtpChallenges): Promise<void> {
  await writeJson(OTP_CHALLENGES_STORE_KEY, challenges);
}

async function readMobileChangeState(): Promise<ProfileMobileChangeState | null> {
  return (await readJson<ProfileMobileChangeState>(PROFILE_MOBILE_CHANGE_STORE_KEY)) ?? null;
}

async function writeMobileChangeState(state: ProfileMobileChangeState | null): Promise<void> {
  if (!state) {
    await writeJson(PROFILE_MOBILE_CHANGE_STORE_KEY, null);
    return;
  }
  await writeJson(PROFILE_MOBILE_CHANGE_STORE_KEY, state);
}

async function requireSession() {
  const session = await readAuthSessionResponse();
  if (!session) {
    throw new DomainError('SESSION_NOT_FOUND', 'You are not signed in');
  }
  return session;
}

async function sendOtp(mobileNumber: string, purpose: 'save' | 'old' | 'new'): Promise<RequestOtpResponse> {
  const challenges = await readChallenges();
  const key = otpKey(purpose, mobileNumber);
  const existing = challenges[key];
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

  challenges[key] = {
    mobileNumber,
    otp,
    otpExpiryAt,
    attempts: 0,
    resendAvailableAt,
  };
  await writeChallenges(challenges);

  // eslint-disable-next-line no-console
  console.log(`[ProfileServiceMock] ${purpose} OTP for ${mobileNumber}: ${otp}`);

  return {
    maskedMobileNumber: `+91 ${maskMobile(mobileNumber)}`,
    resendAvailableAt,
    otpExpiryAt,
    demoOtp: otp,
  };
}

async function verifyOtpForMobile(mobileNumber: string, purpose: 'save' | 'old' | 'new', otp: string): Promise<void> {
  const challenges = await readChallenges();
  const key = otpKey(purpose, mobileNumber);
  const challenge = challenges[key];

  if (!challenge) {
    throw new DomainError('OTP_EXPIRED', 'OTP expired, resend OTP');
  }

  const expiryMs = new Date(challenge.otpExpiryAt).getTime();
  if (Date.now() > expiryMs) {
    delete challenges[key];
    await writeChallenges(challenges);
    throw new DomainError('OTP_EXPIRED', 'OTP expired, resend OTP');
  }

  if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
    throw new DomainError('OTP_TOO_MANY_ATTEMPTS', 'Maximum OTP attempts reached. Please resend OTP.');
  }

  if (challenge.otp !== otp) {
    challenges[key] = { ...challenge, attempts: challenge.attempts + 1 };
    await writeChallenges(challenges);
    throw new DomainError('OTP_INVALID', 'Invalid OTP entered');
  }

  delete challenges[key];
  await writeChallenges(challenges);
}

async function readProfileAvatarUri(
  userId: string,
  deliveryBoy: DeliveryBoy | undefined,
): Promise<string | undefined> {
  const store = (await readJson<StoredProfileAvatars>(PROFILE_AVATARS_STORE_KEY)) ?? {};
  return store[userId]?.avatarUri ?? deliveryBoy?.photoUri;
}

function buildProfile(
  session: { userId: string; mobileNumber: string; role: UserRole },
  user: User | undefined,
  customer: Customer | undefined,
  deliveryBoy: DeliveryBoy | undefined,
  avatarUri?: string,
): UserProfile {
  if (session.role === 'admin') {
    return {
      userId: session.userId,
      role: session.role,
      roleLabel: roleLabel(session.role),
      displayName: user?.name ?? 'Admin',
      mobileNumberRaw: session.mobileNumber,
      mobileNumberFormatted: formatMobile(session.mobileNumber),
      email: undefined,
      avatarUri,
      accountStatus: user?.isActive === false ? 'Inactive' : 'Active',
    };
  }

  if (session.role === 'customer') {
    return {
      userId: session.userId,
      role: session.role,
      roleLabel: roleLabel(session.role),
      displayName: customer?.name ?? user?.name ?? 'Customer',
      mobileNumberRaw: customer?.mobile ?? session.mobileNumber,
      mobileNumberFormatted: formatMobile(customer?.mobile ?? session.mobileNumber),
      address: customer?.address,
      societyName: customer?.societyName,
      houseFlatNumber: customer?.houseFlatNumber,
      alternateMobile: customer?.alternateMobile,
      avatarUri,
      accountStatus: customer?.status ?? (user?.isActive === false ? 'Inactive' : 'Active'),
    };
  }

  return {
    userId: session.userId,
    role: session.role,
    roleLabel: roleLabel(session.role),
    displayName: deliveryBoy?.fullName ?? user?.name ?? 'Delivery Partner',
    mobileNumberRaw: deliveryBoy?.mobileNumber ?? session.mobileNumber,
    mobileNumberFormatted: formatMobile(deliveryBoy?.mobileNumber ?? session.mobileNumber),
    address: deliveryBoy?.address,
    alternateMobile: deliveryBoy?.alternateMobileNumber,
    emergencyContactName: deliveryBoy?.emergencyContactName,
    emergencyContactNumber: deliveryBoy?.emergencyContactNumber,
    avatarUri,
    accountStatus: deliveryBoy?.status ?? (user?.isActive === false ? 'Inactive' : 'Active'),
  };
}

async function buildProfileForSession(
  session: { userId: string; mobileNumber: string; role: UserRole },
  user: User | undefined,
  customer: Customer | undefined,
  deliveryBoy: DeliveryBoy | undefined,
): Promise<UserProfile> {
  const avatarUri = await readProfileAvatarUri(session.userId, deliveryBoy);
  return buildProfile(session, user, customer, deliveryBoy, avatarUri);
}

async function loadContext(session: { userId: string; mobileNumber: string; role: UserRole }) {
  const users = (await readJson<User[]>(USERS_STORE_KEY)) ?? [];
  const user = users.find((u) => u.id === session.userId) ?? users.find((u) => u.mobileNumber === session.mobileNumber);

  let customer: Customer | undefined;
  let deliveryBoy: DeliveryBoy | undefined;

  if (session.role === 'customer') {
    const customers = (await readJson<Customer[]>(CUSTOMERS_STORE_KEY)) ?? [];
    customer = customers.find((c) => c.mobile === session.mobileNumber);
  } else if (session.role === 'delivery_boy') {
    const deliveryBoys = (await readJson<DeliveryBoy[]>(DELIVERY_BOYS_STORE_KEY)) ?? [];
    deliveryBoy = deliveryBoys.find((d) => d.mobileNumber === session.mobileNumber);
  }

  return { user, customer, deliveryBoy, users };
}

export class ProfileServiceMock implements IProfileService {
  async getMyProfile(): Promise<ProfileResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const session = await requireSession();
    const { user, customer, deliveryBoy } = await loadContext(session);
    return { profile: await buildProfileForSession(session, user, customer, deliveryBoy) };
  }

  async requestSaveOtp(): Promise<RequestOtpResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const session = await requireSession();
    return sendOtp(session.mobileNumber, 'save');
  }

  async updateProfileWithOtp(data: UpdateProfileWithOtpRequest): Promise<ProfileResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const session = await requireSession();
    await verifyOtpForMobile(session.mobileNumber, 'save', data.otp);

    const { user, customer, deliveryBoy, users } = await loadContext(session);
    const now = nowIso();

    if (user) {
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx >= 0) {
        users[idx] = { ...users[idx], name: data.displayName.trim(), updatedAt: now };
        await writeJson(USERS_STORE_KEY, users);
      }
    }

    if (session.role === 'customer') {
      const customers = (await readJson<Customer[]>(CUSTOMERS_STORE_KEY)) ?? [];
      const idx = customers.findIndex((c) => c.mobile === session.mobileNumber);
      if (idx >= 0) {
        customers[idx] = {
          ...customers[idx],
          name: data.displayName.trim(),
          address: data.address?.trim() || customers[idx].address,
          societyName: data.societyName?.trim() || customers[idx].societyName,
          houseFlatNumber: data.houseFlatNumber?.trim() || customers[idx].houseFlatNumber,
          alternateMobile: data.alternateMobile?.trim() || customers[idx].alternateMobile,
          updatedAt: now,
        };
        await writeJson(CUSTOMERS_STORE_KEY, customers);
      }
    }

    if (session.role === 'delivery_boy' && deliveryBoy) {
      const deliveryBoys = (await readJson<DeliveryBoy[]>(DELIVERY_BOYS_STORE_KEY)) ?? [];
      const idx = deliveryBoys.findIndex((d) => d.id === deliveryBoy.id);
      if (idx >= 0) {
        deliveryBoys[idx] = {
          ...deliveryBoys[idx],
          fullName: data.displayName.trim(),
          address: data.address?.trim() || deliveryBoys[idx].address,
          alternateMobileNumber: data.alternateMobile?.trim() || deliveryBoys[idx].alternateMobileNumber,
          emergencyContactName: data.emergencyContactName?.trim() || deliveryBoys[idx].emergencyContactName,
          emergencyContactNumber: data.emergencyContactNumber?.trim() || deliveryBoys[idx].emergencyContactNumber,
          updatedAt: now,
        };
        await writeJson(DELIVERY_BOYS_STORE_KEY, deliveryBoys);
      }
    }

    const refreshed = await loadContext(session);
    return { profile: await buildProfileForSession(session, refreshed.user, refreshed.customer, refreshed.deliveryBoy) };
  }

  async updateProfileAvatar(data: UpdateProfileAvatarRequest): Promise<ProfileResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const parsed = UpdateProfileAvatarRequestSchema.safeParse(data);
    if (!parsed.success) {
      throw new DomainError('PROFILE_INVALID_AVATAR', parsed.error.issues[0]?.message ?? 'Invalid photo');
    }

    const session = await requireSession();
    const now = nowIso();
    const avatars = (await readJson<StoredProfileAvatars>(PROFILE_AVATARS_STORE_KEY)) ?? {};
    avatars[session.userId] = { avatarUri: parsed.data.avatarUri, updatedAt: now };
    await writeJson(PROFILE_AVATARS_STORE_KEY, avatars);

    if (session.role === 'delivery_boy') {
      const deliveryBoys = (await readJson<DeliveryBoy[]>(DELIVERY_BOYS_STORE_KEY)) ?? [];
      const idx = deliveryBoys.findIndex((d) => d.mobileNumber === session.mobileNumber);
      if (idx >= 0) {
        deliveryBoys[idx] = { ...deliveryBoys[idx], photoUri: parsed.data.avatarUri, updatedAt: now };
        await writeJson(DELIVERY_BOYS_STORE_KEY, deliveryBoys);
      }
    }

    const refreshed = await loadContext(session);
    return { profile: await buildProfileForSession(session, refreshed.user, refreshed.customer, refreshed.deliveryBoy) };
  }

  async requestOldMobileOtp(): Promise<RequestOtpResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const session = await requireSession();
    await writeMobileChangeState({
      userId: session.userId,
      oldMobileNumber: session.mobileNumber,
      oldMobileVerified: false,
    });
    return sendOtp(session.mobileNumber, 'old');
  }

  async verifyOldMobileOtp(data: VerifyProfileOtpRequest): Promise<VerifyOldMobileResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const session = await requireSession();
    const state = await readMobileChangeState();
    if (!state || state.userId !== session.userId) {
      throw new DomainError('PROFILE_OLD_MOBILE_NOT_VERIFIED', 'Start mobile change again');
    }

    await verifyOtpForMobile(session.mobileNumber, 'old', data.otp);
    await writeMobileChangeState({ ...state, oldMobileVerified: true });
    return { verified: true };
  }

  async requestNewMobileOtp(data: RequestNewMobileOtpRequest): Promise<RequestOtpResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const session = await requireSession();
    const state = await readMobileChangeState();

    if (!state || state.userId !== session.userId || !state.oldMobileVerified) {
      throw new DomainError('PROFILE_OLD_MOBILE_NOT_VERIFIED', 'Verify your current mobile number first');
    }

    const newMobile = data.newMobileNumber.trim();
    if (newMobile === session.mobileNumber) {
      throw new DomainError('PROFILE_MOBILE_SAME_AS_CURRENT', 'New mobile number must be different');
    }

    const users = (await readJson<User[]>(USERS_STORE_KEY)) ?? [];
    if (users.some((u) => u.mobileNumber === newMobile && u.id !== session.userId)) {
      throw new DomainError('PROFILE_MOBILE_ALREADY_REGISTERED', 'This mobile number is already registered');
    }

    await writeMobileChangeState({ ...state, pendingNewMobileNumber: newMobile });
    return sendOtp(newMobile, 'new');
  }

  async verifyNewMobileAndUpdate(data: VerifyNewMobileRequest): Promise<ProfileResponse> {
    await sleep(DEFAULT_DELAY_MS);
    const session = await requireSession();
    const state = await readMobileChangeState();

    if (!state || state.userId !== session.userId || !state.oldMobileVerified) {
      throw new DomainError('PROFILE_OLD_MOBILE_NOT_VERIFIED', 'Verify your current mobile number first');
    }

    const newMobile = data.newMobileNumber.trim();
    if (newMobile !== state.pendingNewMobileNumber) {
      throw new DomainError('OTP_EXPIRED', 'Request OTP for the new mobile number again');
    }

    await verifyOtpForMobile(newMobile, 'new', data.otp);

    const { users } = await loadContext(session);
    const now = nowIso();
    const oldMobile = session.mobileNumber;

    const userIdx = users.findIndex((u) => u.id === session.userId);
    if (userIdx >= 0) {
      users[userIdx] = { ...users[userIdx], mobileNumber: newMobile, updatedAt: now };
      await writeJson(USERS_STORE_KEY, users);
    }

    if (session.role === 'customer') {
      const customers = (await readJson<Customer[]>(CUSTOMERS_STORE_KEY)) ?? [];
      const idx = customers.findIndex((c) => c.mobile === oldMobile);
      if (idx >= 0) {
        customers[idx] = { ...customers[idx], mobile: newMobile, updatedAt: now };
        await writeJson(CUSTOMERS_STORE_KEY, customers);
      }
    }

    if (session.role === 'delivery_boy') {
      const deliveryBoys = (await readJson<DeliveryBoy[]>(DELIVERY_BOYS_STORE_KEY)) ?? [];
      const idx = deliveryBoys.findIndex((d) => d.mobileNumber === oldMobile);
      if (idx >= 0) {
        deliveryBoys[idx] = { ...deliveryBoys[idx], mobileNumber: newMobile, updatedAt: now };
        await writeJson(DELIVERY_BOYS_STORE_KEY, deliveryBoys);
      }
    }

    await updateAuthSessionMobile(newMobile);
    await writeMobileChangeState(null);

    const newSession = { ...session, mobileNumber: newMobile };
    const refreshed = await loadContext(newSession);
    return { profile: await buildProfileForSession(newSession, refreshed.user, refreshed.customer, refreshed.deliveryBoy) };
  }
}
