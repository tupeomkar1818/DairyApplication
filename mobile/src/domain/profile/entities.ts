import type { UserRole } from '@/src/domain/shared/enums';

export interface UserProfile {
  userId: string;
  role: UserRole;
  roleLabel: string;
  displayName: string;
  /** 10-digit mobile without country code */
  mobileNumberRaw: string;
  mobileNumberFormatted: string;
  email?: string;
  address?: string;
  societyName?: string;
  houseFlatNumber?: string;
  alternateMobile?: string;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
  avatarUri?: string;
  accountStatus?: string;
}

export interface ProfileMobileChangeState {
  userId: string;
  oldMobileNumber: string;
  oldMobileVerified: boolean;
  pendingNewMobileNumber?: string;
}
