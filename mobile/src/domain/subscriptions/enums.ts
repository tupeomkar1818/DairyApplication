/** Lifecycle for the single active milk base subscription row. */
export type BaseSubscriptionStatus = 'Active' | 'Expired' | 'Paused';

/** How often the base milk line is scheduled (calendar-aware). */
export type BaseSubscriptionDeliveryFrequency = 'Daily' | 'AlternateDay' | 'Custom';

export type SubscriptionModificationChangeType = 'Increase' | 'Decrease' | 'Pause';

export type SubscriptionModificationActor = 'Customer' | 'Admin';

export type SubscriptionModificationRowStatus = 'Active' | 'Completed';

/** Additional lines separate from base milk (curd, paneer, etc.). */
export type SubscriptionAdditionalOrderType = 'OneTime' | 'Temporary' | 'Permanent';

export type SubscriptionAdditionalOrderDeliveryStatus = 'Delivered' | 'NotDelivered';

/** Execution outcome for a scheduled delivery row. */
export type SubscriptionDeliveryExecutionStatus = 'Delivered' | 'NotDelivered' | 'Partial';

export type SubscriptionMismatchAdminApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'NotRequired';

export type SubscriptionNotificationType =
  | 'SubscriptionStarted'
  | 'SubscriptionExpiringIn3Days'
  | 'SubscriptionExpired'
  | 'SubscriptionMismatchPendingAdmin'
  | 'SubscriptionPaused'
  | 'SubscriptionResumed'
  | 'QuantityChanged'
  | 'AdditionalProductAdded'
  | 'DeliveryNotCompleted'
  | 'MonthlyBillGenerated'
  | 'PaymentPending';
