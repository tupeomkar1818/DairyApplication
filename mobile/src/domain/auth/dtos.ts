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
}

