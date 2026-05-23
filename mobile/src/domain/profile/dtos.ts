import type { RequestOtpResponse } from '@/src/domain/auth/dtos';
import type { UserProfile } from '@/src/domain/profile/entities';

export interface ProfileResponse {
  profile: UserProfile;
}

export interface UpdateProfileRequest {
  displayName: string;
  email?: string;
  address?: string;
  societyName?: string;
  houseFlatNumber?: string;
  alternateMobile?: string;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
}

export interface VerifyProfileOtpRequest {
  otp: string;
}

export interface UpdateProfileWithOtpRequest extends UpdateProfileRequest {
  otp: string;
}

export interface RequestNewMobileOtpRequest {
  newMobileNumber: string;
}

export interface VerifyNewMobileRequest {
  newMobileNumber: string;
  otp: string;
}

export type ProfileOtpResponse = RequestOtpResponse;

export interface VerifyOldMobileResponse {
  verified: true;
}

export interface UpdateProfileAvatarRequest {
  avatarUri: string;
}
