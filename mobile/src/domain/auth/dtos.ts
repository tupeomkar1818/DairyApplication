import type { UserRole } from '@/src/domain/shared/enums';
import type { IsoDateString } from '@/src/domain/shared/types';

export interface RequestOtpRequest {
  mobileNumber: string;
}

export interface RequestOtpResponse {
  maskedMobileNumber: string;
  resendAvailableAt: IsoDateString;
  otpExpiryAt: IsoDateString;
  demoOtp?: string;
}

export interface VerifyOtpRequest {
  mobileNumber: string;
  otp: string;
}

export interface AuthSessionResponse {
  sessionId: string;
  userId: string;
  mobileNumber: string;
  role: UserRole;
  createdAt: IsoDateString;
}

export interface VerifyOtpResponse {
  session: AuthSessionResponse;
  /** True when they have not chosen a PIN yet: the app asks for one before anything else. */
  mustSetPin?: boolean;
}

/** Signing in with a number and a password: the PIN, or their own mobile number the first time. */
export interface LoginRequest {
  mobileNumber: string;
  secret: string;
}

export interface LoginResponse {
  session: AuthSessionResponse;
  mustSetPin: boolean;
}

/** Choosing the first PIN, or changing one (which needs the one in use). */
export interface SetPinRequest {
  pin: string;
  currentPin?: string;
}

