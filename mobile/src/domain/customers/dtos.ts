import type { CustomerGeoLocation } from '@/src/domain/customers/location';
import type { Customer } from '@/src/domain/customers/entities';
import type {
  BillingType,
  CustomerStatus,
  DeliveryFrequency,
  DeliveryTime,
  PaymentMode,
  PaymentType,
  SubscriptionKind,
  SubscriptionPaymentStatus,
  SubscriptionProductAdditionTag,
  SubscriptionStatus,
} from '@/src/domain/customers/enums';

export interface CustomerSubscriptionItemDto {
  productName: string;
  quantityLabel: string;
}

export interface CustomerSubscriptionPauseDetailsDto {
  pauseStartDate?: string;
  pauseEndDate?: string;
  pauseReason?: string;
  resumeDate?: string;
  pauseStatus?: string;
}

/**
 * Admin subscription calendar overlay (per-day adds). Persisted locally until customer PATCH supports it.
 * `base_online_catalog` is informational only when rendering the always-on online ordering line.
 */
export type SubscriptionCalendarEntryKind = 'base_online_catalog' | 'subscription_line' | 'add_on_product';

export interface CustomerSubscriptionCalendarEntryDto {
  id: string;
  /** YYYY-MM-DD */
  dateYmd: string;
  kind: SubscriptionCalendarEntryKind;
  title: string;
  subtitle?: string;
}

/** Input for appending a user-created calendar row (not `base_online_catalog`). */
export interface AppendSubscriptionCalendarEntryRequest {
  dateYmd: string;
  kind: 'subscription_line' | 'add_on_product';
  title: string;
  subtitle?: string;
}

/**
 * Admin-editable “product order of the day” for subscription calendar (local mock until customer PATCH).
 * One row per product line on a given calendar date.
 */
export interface CustomerDailyProductOrderLineDto {
  id: string;
  /** When this row was first created (sysdate) */
  createdAtIso?: string;
  /** YYYY-MM-DD */
  dateYmd: string;
  productName: string;
  quantityLabel: string;
  unitType?: string;
  /** Units (bottles/packets) for this line */
  quantity: number;
}

/** Create or replace a line; omit `id` to insert a new row. */
export interface UpsertCustomerDailyProductOrderLineRequest {
  id?: string;
  dateYmd: string;
  productName: string;
  quantityLabel: string;
  unitType?: string;
  quantity: number;
}

/**
 * Billing ledger row (derived from subscription plans + add-ons + deliveries) for a single calendar day.
 * Persisted locally so Billing tab can show a stable month snapshot without manual refresh.
 */
export type CustomerBillingLedgerLineType = 'Subscription' | 'Add-on';

export interface CustomerBillingLedgerRowDto {
  id: string;
  /** YYYY-MM-DD */
  dateYmd: string;
  type: CustomerBillingLedgerLineType;
  productName: string;
  /** Pack / size label (quantityLabel + optional unitType) */
  packSizeLabel: string;
  /** Ordered qty */
  quantity: number;
  /** Amount for this line if delivered once (derived from planLineTotal or unitPrice × qty) */
  pricePerDelivery: number;
  /** Most recent delivered day in this month for the same (type+product+pack) key */
  deliveredLastDateYmd?: string;
  /** Delivered quantity (0 when not delivered/unknown) */
  quantityDelivered: number;
  /** Billed amount for this row (0 when not delivered/unknown) */
  amount: number;
}

/** Row in the admin subscription history table (derived from plans + delivery data). */
export type CustomerSubscriptionHistoryLineKind = 'basic_subscription' | 'add_on_product';

export interface CustomerSubscriptionHistoryRowDto {
  /** Stable key: plan id when present, else synthetic */
  id: string;
  lineKind: CustomerSubscriptionHistoryLineKind;
  productName: string;
  /** Pack / size (plan quantityLabel, e.g. 500 ml) */
  packSizeLabel: string;
  /** Subscription quantity (numberOfItems per delivery) */
  quantity: number;
  /** Line price for one delivery occurrence (plan line total) */
  pricePerDelivery: number;
  /** When the line was issued in the system (plan createdAt / addedDate) */
  subscriptionIssueDate: string;
  subscriptionStartDate: string;
  subscriptionEndDate?: string;
  /** Most recent calendar day (YYYY-MM-DD) with status Delivered for this plan line */
  lastDeliveredDateYmd?: string;
  /** Sum of per-day quantities on those Delivered days (from matching calendar lines, else 1 per day) */
  totalQuantityDelivered: number;
  /** Distinct Delivered days for this plan line */
  deliveryOccurrenceCount: number;
  /** deliveryOccurrenceCount × pricePerDelivery */
  calculatedAmount: number;
}

/** Persisted admin memo when a duplicate milk line forces closing the prior line (local mock store). */
export type CustomerSubscriptionPlanHistoryMemoKind = 'duplicate_milk_line_closed';

export interface CustomerSubscriptionPlanHistoryMemoDto {
  id: string;
  createdAt: string;
  kind: CustomerSubscriptionPlanHistoryMemoKind;
  message: string;
  closedLineProductName: string;
  closedLineEndBeforeDisplay: string;
  closedLineEndAfterDisplay: string;
  addedLineProductName: string;
}

export interface AppendCustomerSubscriptionPlanHistoryMemoRequest {
  kind: CustomerSubscriptionPlanHistoryMemoKind;
  message: string;
  closedLineProductName: string;
  closedLineEndBeforeDisplay: string;
  closedLineEndAfterDisplay: string;
  addedLineProductName: string;
}

export interface CustomerSubscriptionPlanDto {
  /** Present on persisted customer plans (mock / API) */
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  productName: string;
  numberOfItems?: number;
  quantityLabel: string;
  unitType?: string;
  packId?: string;
  subscriptionKind?: SubscriptionKind;
  deliveryDate?: string; // ISO
  deliveryTime: DeliveryTime;
  frequency: DeliveryFrequency;
  startDate: string; // ISO
  endDate?: string; // ISO
  openEnded?: boolean;
  pauseStartDate?: string; // ISO
  pauseEndDate?: string; // ISO
  resumeDate?: string; // ISO
  pauseReason?: string;
  pauseStatus?: string;
  productAdditionTag?: SubscriptionProductAdditionTag;
  notes?: string;
  originalPrice?: number;
  discountedPrice?: number;
  effectiveFinalPrice?: number;
  paymentStatus?: SubscriptionPaymentStatus;
  dailyCost?: number;
  addedDate?: string; // ISO
  status: SubscriptionStatus;
}

export interface CreateCustomerRequest {
  name: string;
  mobile: string;
  /** Date string in DD/MM/YYYY format */
  dateOfBirth?: string;
  alternateMobile?: string;
  appAccessEnabled?: boolean;
  address: string;
  societyName: string;
  houseFlatNumber?: string;
  streetArea?: string;
  city?: string;
  pincode?: string;
  landmark?: string;
  /** The customer's door on the map: from a pasted map link (admin) or saved by the delivery boy standing there. */
  geoLocation?: CustomerGeoLocation;
  /** A Google Maps link as pasted by the admin — kept for short share links that carry no coordinates. */
  mapLink?: string;
  routeName?: string;
  assignedDeliveryBoyId?: string;
  assignedDeliveryBoyName?: string;
  deliveryTime: DeliveryTime;
  subscriptionStartDate?: string; // ISO
  subscriptionEndDate?: string; // ISO
  subscriptionStatus?: SubscriptionStatus;
  subscriptionKind?: SubscriptionKind;
  subscriptionPaymentStatus?: SubscriptionPaymentStatus;
  subscriptionPause?: CustomerSubscriptionPauseDetailsDto;
  subscriptionFrequency?: DeliveryFrequency;
  preferredDeliveryNotes?: string;
  paymentType: PaymentType;
  billingType?: BillingType;
  billingCycleDate?: number;
  advanceBalance?: number;
  securityDeposit?: number;
  pendingAmount?: number;
  discountAmount?: number;
  taxPercentage?: number;
  lastPaymentDate?: string; // ISO
  nextDueDate?: string; // ISO
  preferredPaymentMode?: PaymentMode;
  complaintNotes?: string;
  internalAdminNotes?: string;
  specialDeliveryInstructions?: string;
  status: CustomerStatus;
  subscription: CustomerSubscriptionItemDto[];
  subscriptionPlans?: CustomerSubscriptionPlanDto[];
}

export interface UpdateCustomerRequest {
  name?: string;
  mobile?: string;
  /** Date string in DD/MM/YYYY format */
  dateOfBirth?: string;
  alternateMobile?: string;
  appAccessEnabled?: boolean;
  address?: string;
  societyName?: string;
  houseFlatNumber?: string;
  streetArea?: string;
  city?: string;
  pincode?: string;
  landmark?: string;
  /** The customer's door on the map: from a pasted map link (admin) or saved by the delivery boy standing there. */
  geoLocation?: CustomerGeoLocation;
  /** A Google Maps link as pasted by the admin — kept for short share links that carry no coordinates. */
  mapLink?: string;
  routeName?: string;
  assignedDeliveryBoyId?: string;
  assignedDeliveryBoyName?: string;
  deliveryTime?: DeliveryTime;
  subscriptionStartDate?: string; // ISO
  subscriptionEndDate?: string; // ISO
  subscriptionStatus?: SubscriptionStatus;
  subscriptionKind?: SubscriptionKind;
  subscriptionPaymentStatus?: SubscriptionPaymentStatus;
  subscriptionPause?: CustomerSubscriptionPauseDetailsDto;
  subscriptionFrequency?: DeliveryFrequency;
  preferredDeliveryNotes?: string;
  paymentType?: PaymentType;
  billingType?: BillingType;
  billingCycleDate?: number;
  advanceBalance?: number;
  securityDeposit?: number;
  pendingAmount?: number;
  discountAmount?: number;
  taxPercentage?: number;
  lastPaymentDate?: string; // ISO
  nextDueDate?: string; // ISO
  preferredPaymentMode?: PaymentMode;
  complaintNotes?: string;
  internalAdminNotes?: string;
  specialDeliveryInstructions?: string;
  status?: CustomerStatus;
  subscription?: CustomerSubscriptionItemDto[];
  subscriptionPlans?: CustomerSubscriptionPlanDto[];

  // Operational data (delivery app / customer app / admin)
  deliveries?: Customer['deliveries'];
  extraOrders?: Customer['extraOrders'];
  subscriptionExceptions?: Customer['subscriptionExceptions'];
  favouriteProductIds?: Customer['favouriteProductIds'];
  payments?: Customer['payments'];
  paymentRequests?: Customer['paymentRequests'];
  offerClaims?: Customer['offerClaims'];
  complaints?: Customer['complaints'];
  complaintActions?: Customer['complaintActions'];
  audit?: Customer['audit'];
}

export interface CustomerResponse extends Customer {}

export interface CustomerListResponse {
  items: CustomerResponse[];
  total: number;
}

