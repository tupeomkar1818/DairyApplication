import type { RequestOtpResponse } from '@/src/domain/auth/dtos';
import type {
  ProfileResponse,
  RequestNewMobileOtpRequest,
  UpdateProfileAvatarRequest,
  UpdateProfileWithOtpRequest,
  VerifyNewMobileRequest,
  VerifyOldMobileResponse,
  VerifyProfileOtpRequest,
} from '@/src/domain/profile/dtos';

export interface IProfileService {
  /** GET /api/profile/me */
  getMyProfile(): Promise<ProfileResponse>;

  /** POST /api/profile/otp/save — OTP to current mobile before editing details */
  requestSaveOtp(): Promise<RequestOtpResponse>;

  /** PUT /api/profile — update personal details after OTP on current mobile */
  updateProfileWithOtp(data: UpdateProfileWithOtpRequest): Promise<ProfileResponse>;

  /** POST /api/profile/mobile/old/otp */
  requestOldMobileOtp(): Promise<RequestOtpResponse>;

  /** POST /api/profile/mobile/old/verify */
  verifyOldMobileOtp(data: VerifyProfileOtpRequest): Promise<VerifyOldMobileResponse>;

  /** POST /api/profile/mobile/new/otp */
  requestNewMobileOtp(data: RequestNewMobileOtpRequest): Promise<RequestOtpResponse>;

  /** POST /api/profile/mobile/new/verify */
  verifyNewMobileAndUpdate(data: VerifyNewMobileRequest): Promise<ProfileResponse>;

  /** PUT /api/profile/avatar */
  updateProfileAvatar(data: UpdateProfileAvatarRequest): Promise<ProfileResponse>;
}
