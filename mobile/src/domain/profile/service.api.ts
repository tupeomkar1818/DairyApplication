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
import type { UserProfile } from '@/src/domain/profile/entities';
import type { IProfileService } from '@/src/domain/profile/service.interface';
import { strings } from '@/src/i18n/strings';
import { api } from '@/src/infrastructure/api/client';
import { updateAuthSessionMobile } from '@/src/infrastructure/auth/sessionRead';

/**
 * Somebody's own profile, on the dairy's server.
 *
 * Changing a detail needs a code on the number they already use; changing that number needs one on the old number
 * and one on the new. The server holds to all of it — the apps only ask the questions in the right order.
 *
 * What a role is called is the app's wording, not the server's, so it is filled in here.
 */

type ServerProfile = Omit<UserProfile, 'roleLabel'> & { role: UserProfile['role'] };

function withRoleLabel(profile: ServerProfile): UserProfile {
  return { ...profile, roleLabel: strings('profile').roles[profile.role] ?? profile.role };
}

export class ProfileServiceApi implements IProfileService {
  async getMyProfile(): Promise<ProfileResponse> {
    const answer = await api.get<{ profile: ServerProfile }>('/me/profile');
    return { profile: withRoleLabel(answer.profile) };
  }

  async requestSaveOtp(): Promise<RequestOtpResponse> {
    return api.post<RequestOtpResponse>('/me/profile/otp', {});
  }

  async updateProfileWithOtp(data: UpdateProfileWithOtpRequest): Promise<ProfileResponse> {
    const answer = await api.patch<{ profile: ServerProfile }>('/me/profile', data);
    return { profile: withRoleLabel(answer.profile) };
  }

  async updateProfileAvatar(data: UpdateProfileAvatarRequest): Promise<ProfileResponse> {
    const answer = await api.put<{ profile: ServerProfile }>('/me/profile/avatar', data);
    return { profile: withRoleLabel(answer.profile) };
  }

  async requestOldMobileOtp(): Promise<RequestOtpResponse> {
    return api.post<RequestOtpResponse>('/me/profile/mobile/old/otp', {});
  }

  async verifyOldMobileOtp(data: VerifyProfileOtpRequest): Promise<VerifyOldMobileResponse> {
    return api.post<VerifyOldMobileResponse>('/me/profile/mobile/old/verify', data);
  }

  async requestNewMobileOtp(data: RequestNewMobileOtpRequest): Promise<RequestOtpResponse> {
    return api.post<RequestOtpResponse>('/me/profile/mobile/new/otp', data);
  }

  async verifyNewMobileAndUpdate(data: VerifyNewMobileRequest): Promise<ProfileResponse> {
    const answer = await api.post<{ profile: ServerProfile }>('/me/profile/mobile/new/verify', data);
    // The session is the login's, not the number's, so it stays — but the phone should show the new number.
    await updateAuthSessionMobile(answer.profile.mobileNumberRaw);
    return { profile: withRoleLabel(answer.profile) };
  }
}
