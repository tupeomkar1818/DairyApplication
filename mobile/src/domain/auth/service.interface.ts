import type { RequestOtpRequest, RequestOtpResponse, VerifyOtpRequest, VerifyOtpResponse, AuthSessionResponse } from '@/src/domain/auth/dtos';

export interface IAuthService {
  /**
   * POST /api/auth/otp/request
   * Login is allowed for existing users and for admin-created customers / delivery boys (matched by mobile)
   * whose status is Active and app access is enabled. During the resend cooldown an unexpired pending
   * challenge is returned again instead of issuing a new OTP.
   * @throws MOBILE_NOT_REGISTERED | USER_INACTIVE | OTP_RESEND_COOLDOWN (pending challenge expired / exhausted)
   */
  requestOtp(data: RequestOtpRequest): Promise<RequestOtpResponse>;

  /**
   * POST /api/auth/otp/verify
   * @throws MOBILE_NOT_REGISTERED | USER_INACTIVE | OTP_EXPIRED | OTP_TOO_MANY_ATTEMPTS | OTP_INVALID
   */
  verifyOtp(data: VerifyOtpRequest): Promise<VerifyOtpResponse>;

  /** GET /api/auth/session */
  getSession(): Promise<AuthSessionResponse | null>;

  /** POST /api/auth/logout */
  logout(): Promise<void>;
}

