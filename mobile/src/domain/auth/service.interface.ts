import type {
  AuthSessionResponse,
  LoginRequest,
  LoginResponse,
  RequestOtpRequest,
  RequestOtpResponse,
  SetPinRequest,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '@/src/domain/auth/dtos';

export interface IAuthService {
  /**
   * POST /api/auth/login — a mobile number and a password.
   *
   * The first time somebody signs in, the password is their own mobile number and `mustSetPin` comes back true:
   * they choose a four-digit PIN before anything else, and that is the password from then on.
   *
   * @throws MOBILE_NOT_REGISTERED | USER_INACTIVE | PASSWORD_INVALID | PIN_INVALID | PIN_LOCKED
   */
  login(data: LoginRequest): Promise<LoginResponse>;

  /**
   * POST /api/auth/pin — chooses the first PIN, or changes one (`currentPin` is then required).
   * @throws PIN_INVALID | PIN_LOCKED
   */
  setPin(data: SetPinRequest): Promise<void>;

  /** POST /api/auth/pin/reset — the dairy forgets somebody's PIN, so they sign in with their number again. */
  resetPin(mobileNumber: string): Promise<void>;

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

