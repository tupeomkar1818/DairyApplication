export type DomainErrorCode =
  | 'MOBILE_NOT_REGISTERED'
  | 'USER_INACTIVE'
  | 'OTP_RESEND_COOLDOWN'
  | 'OTP_EXPIRED'
  | 'OTP_INVALID'
  | 'OTP_TOO_MANY_ATTEMPTS'
  | 'SESSION_NOT_FOUND'
  | 'SUBSCRIPTION_NOT_FOUND'
  | 'SUBSCRIPTION_ACTIVE_BASE_EXISTS'
  | 'SUBSCRIPTION_DELIVERY_NOT_FOUND'
  | 'SUBSCRIPTION_MISMATCH_INVALID_STATE'
  | 'NOTIFICATION_NOT_FOUND'
  | 'PROFILE_OLD_MOBILE_NOT_VERIFIED'
  | 'PROFILE_MOBILE_ALREADY_REGISTERED'
  | 'PROFILE_MOBILE_SAME_AS_CURRENT'
  | 'PROFILE_INVALID_AVATAR';

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

