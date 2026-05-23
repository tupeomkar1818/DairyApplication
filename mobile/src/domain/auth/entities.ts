import type { EntityBase, IsoDateString } from '@/src/domain/shared/types';
import type { UserRole } from '@/src/domain/shared/enums';

export interface User extends EntityBase {
  name: string;
  mobileNumber: string;
  role: UserRole;
  isActive: boolean;
}

export interface OtpChallenge {
  mobileNumber: string;
  otp: string;
  otpExpiryAt: IsoDateString;
  attempts: number;
  resendAvailableAt: IsoDateString;
}

export interface AuthSession extends EntityBase {
  userId: string;
  mobileNumber: string;
  role: UserRole;
}

