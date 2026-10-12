import type { EntityBase } from '@/src/domain/shared/types';

export type DashboardCoverSourceType = 'bundled' | 'uri';

/** Shared dashboard hero cover — visible on admin, customer, and delivery home screens */
export interface DashboardCoverImage extends EntityBase {
  sourceType: DashboardCoverSourceType;
  /** Local file URI when sourceType is uri; ignored when bundled */
  uri: string;
  /** width / height — used to reserve layout space before image loads */
  aspectRatio: number;
}

/** Where customers pay their bills from the app. */
export interface DairyPaymentSettings {
  /** The dairy's UPI ID (VPA), e.g. "amraledairy@okhdfcbank". Empty: UPI payment is not offered. */
  upiId: string;
  /** Name the customer's UPI app shows as the payee. */
  payeeName: string;
  /** Customers may tell the dairy they will pay cash (to the delivery partner or at the dairy). */
  acceptCash: boolean;
  /** Optional line shown to customers above the payment options, e.g. bank details or timings. */
  instructions?: string;
  updatedAt: string;
}

export interface AdminDashboardSettings extends EntityBase {
  cover: DashboardCoverImage;
  /** Absent until the admin saves payment details. */
  payment?: DairyPaymentSettings;
}
