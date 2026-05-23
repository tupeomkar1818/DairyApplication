import type { EntityBase, IsoDateString } from '@/src/domain/shared/types';
import type {
  BaseSubscriptionDeliveryFrequency,
  BaseSubscriptionStatus,
  SubscriptionAdditionalOrderDeliveryStatus,
  SubscriptionAdditionalOrderType,
  SubscriptionDeliveryExecutionStatus,
  SubscriptionMismatchAdminApprovalStatus,
  SubscriptionModificationActor,
  SubscriptionModificationChangeType,
  SubscriptionModificationRowStatus,
  SubscriptionNotificationType,
} from '@/src/domain/subscriptions/enums';

/**
 * Monthly billing shell for the primary milk product: one **active** row per customer.
 *
 * - `issueDate` (YYYY-MM-DD): system date when the subscription was registered.
 * - `startDate` / `endDate`: current **monthly cycle** window used for billing, delivery sheets, and expiry.
 *   First cycle after signup is typically **partial** (e.g. start 6 Apr → end 30 Apr); renewals are full calendar months.
 * - Default litres per scheduled day live here; **intraday/in-month** changes (0.5 L, 1.5 L, 2 L, pause while away)
 *   are **never** written onto this row — only new `SubscriptionModification` rows for the affected date range.
 */
export interface BaseMilkSubscription extends EntityBase {
  customerId: string;
  productId: string;
  defaultQuantityLitres: number;
  /** System registration date (date part). */
  issueDate: IsoDateString;
  /** First delivery day of this cycle (may be today, tomorrow, or any chosen date). */
  startDate: IsoDateString;
  /** Last day of this monthly cycle (e.g. last calendar day of the month for the first partial cycle). */
  endDate: IsoDateString;
  status: BaseSubscriptionStatus;
  deliveryFrequency: BaseSubscriptionDeliveryFrequency;
  billingType: 'Monthly';
  /** When true, mock renewal creates the next full calendar month cycle after `endDate`. */
  autoRenewMonthly?: boolean;
  /** For `Custom` frequency: weekday indices matching `Date#getDay()` (0 = Sunday … 6 = Saturday). */
  customWeekdays?: number[];
}

/**
 * Append-only row for a **time-bounded** quantity change (customer app or admin).
 * Planned quantity for a calendar day = base default, overridden by the winning active modification for that day.
 */
export interface SubscriptionModification extends EntityBase {
  subscriptionId: string;
  productId: string;
  oldQuantityLitres: number;
  newQuantityLitres: number;
  effectiveFromDate: IsoDateString;
  effectiveToDate: IsoDateString;
  changeType: SubscriptionModificationChangeType;
  createdBy: SubscriptionModificationActor;
  status: SubscriptionModificationRowStatus;
}

/** Extra dairy SKUs billed on their own lines (one-time, temporary window, or permanent add-on). */
export interface SubscriptionAdditionalProductOrder extends EntityBase {
  customerId: string;
  productId: string;
  quantityLitresOrUnits: number;
  startDate: IsoDateString;
  endDate?: IsoDateString;
  orderType: SubscriptionAdditionalOrderType;
  deliveryStatus: SubscriptionAdditionalOrderDeliveryStatus;
  createdBy: SubscriptionModificationActor;
}

/**
 * Per-day execution row for base milk. **Monthly totals and customer charges** come from these rows:
 * only **actual delivered** litres (after the delivery boy marks execution and any admin mismatch is approved) count.
 * `plannedQuantityLitres` is the app schedule; it does not drive billing by itself.
 */
export interface SubscriptionDailyDelivery extends EntityBase {
  customerId: string;
  subscriptionId: string;
  productId: string;
  deliveryDate: IsoDateString;
  plannedQuantityLitres: number;
  deliveredQuantityLitres?: number;
  deliveryStatus: SubscriptionDeliveryExecutionStatus;
  deliveryBoyId?: string;
  customerRequestedQuantityLitres?: number;
  adminApprovalStatus: SubscriptionMismatchAdminApprovalStatus;
  remarks?: string;
  subscriptionMismatchReported?: boolean;
}

export type SubscriptionNotificationAudience = 'Customer' | 'Admin';

/**
 * `customerId` is always the **subject customer** (whose subscription/delivery is affected).
 * `audience` routes the message to the customer app vs admin console (defaults to Customer when omitted).
 */
export interface SubscriptionNotification extends EntityBase {
  customerId: string;
  audience?: SubscriptionNotificationAudience;
  type: SubscriptionNotificationType;
  title: string;
  body: string;
  readAt?: IsoDateString;
  relatedSubscriptionId?: string;
  relatedDeliveryId?: string;
}
