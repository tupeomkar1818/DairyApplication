import type { RequestOtpRequest, RequestOtpResponse, VerifyOtpRequest, VerifyOtpResponse, AuthSessionResponse } from '@/src/domain/auth/dtos';

export interface IAuthService {
  /** POST /api/auth/otp/request */
  requestOtp(data: RequestOtpRequest): Promise<RequestOtpResponse>;

  /** POST /api/auth/otp/verify */
  verifyOtp(data: VerifyOtpRequest): Promise<VerifyOtpResponse>;

  /** GET /api/auth/session */
  getSession(): Promise<AuthSessionResponse | null>;

  /** POST /api/auth/logout */
  logout(): Promise<void>;
}

