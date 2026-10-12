import type { EntityBase, IsoDateString } from '@/src/domain/shared/types';
import type { UserRole } from '@/src/domain/shared/enums';

export interface User extends EntityBase {
  name: string;
  mobileNumber: string;
  role: UserRole;
  isActive: boolean;
  /**
   * The four digits they sign in with. Unset until they have chosen one — then their own mobile number is the
   * password, once. Only on a phone keeping its own records; with the dairy's server the PIN never leaves it.
   */
  pin?: string;
  /**
   * FK — `Customer.id` (role=customer) or `DeliveryBoy.id` (role=delivery_boy) this login was provisioned from
   * when an admin created the record. Unset for directly seeded/managed users.
   */
  linkedRecordId?: string;
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

