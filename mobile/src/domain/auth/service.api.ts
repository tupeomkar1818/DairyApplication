import type {
  AuthSessionResponse,
  RequestOtpRequest,
  RequestOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '@/src/domain/auth/dtos';
import type { IAuthService } from '@/src/domain/auth/service.interface';
import { api } from '@/src/infrastructure/api/client';
import { clearStoredSession, readAuthSessionResponse, saveAuthSession } from '@/src/infrastructure/auth/sessionRead';
import { forgetPush, registerForPush } from '@/src/infrastructure/pushRegistration';

/**
 * Signing in against the dairy's server. The code goes to the customer's own mobile number; what comes back is
 * kept exactly where the on-phone sign-in keeps it, so every screen reads the session the same way.
 */
export class AuthServiceApi implements IAuthService {
  async requestOtp(data: RequestOtpRequest): Promise<RequestOtpResponse> {
    return api.post<RequestOtpResponse>('/auth/otp/request', { mobileNumber: data.mobileNumber }, { anonymous: true });
  }

  async verifyOtp(data: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    const result = await api.post<VerifyOtpResponse>(
      '/auth/otp/verify',
      { mobileNumber: data.mobileNumber, otp: data.otp },
      { anonymous: true },
    );
    await saveAuthSession(result.session);
    // The server sends the evening reminder to this phone, so it needs to know which phone it is. A phone that
    // cannot give a token (Expo Go, notifications declined) simply gets its reminders inside the app.
    void registerForPush();
    return result;
  }

  /** The session this phone holds. The server has the last word on it: a rejected call clears it. */
  async getSession(): Promise<AuthSessionResponse | null> {
    return readAuthSessionResponse();
  }

  async logout(): Promise<void> {
    // Forgotten first: notifications for the person signing out must not follow them on a shared phone.
    await forgetPush();
    // Ends it on the server too, so the token cannot be used again from anywhere.
    await api.post<void>('/auth/logout', {}).catch(() => undefined);
    await clearStoredSession();
  }
}
