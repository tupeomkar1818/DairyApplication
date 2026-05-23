export type DeliveryTime = 'Morning' | 'Evening' | 'Both';

export type CustomerStatus = 'Active' | 'Inactive';

export type PaymentType = 'Cash' | 'UPI' | 'Monthly';

export type BillingType = 'Monthly' | 'Weekly' | 'Prepaid' | 'Postpaid';

/** Per-product delivery cadence (subscription lines). */
export type DeliveryFrequency =
  | 'Daily'
  | 'Alternate Day'
  | 'Weekly'
  | 'Specific Days'
  | 'Weekend Only'
  | 'Morning Only'
  | 'Evening Only'
  | 'Morning and Evening';

/** Top-level subscription billing model for the customer. */
export type SubscriptionKind = 'Monthly' | 'Daily';

/** Per-product or header subscription lifecycle. `Inactive` kept for legacy rows. */
export type SubscriptionStatus = 'Active' | 'Paused' | 'Expired' | 'Cancelled' | 'Inactive';

export type SubscriptionProductAdditionTag = 'Regular' | 'Temporary' | 'Permanent';

export type SubscriptionPaymentStatus = 'Paid' | 'Pending' | 'Partial' | 'Advance Paid';

export type DeliveryStatus = 'Delivered' | 'Missed' | 'Rescheduled';

export type PaymentMode = 'Cash' | 'UPI' | 'Bank' | 'Other';

export type ComplaintStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

