import type { CustomerGeoLocation } from '@/src/domain/customers/location';
import type { OfferClaim, OrderOfferSnapshot } from '@/src/domain/offers/entities';
import type { EntityBase } from '@/src/domain/shared/types';
import type {
  ComplaintStatus,
  CustomerStatus,
  DeliveryFrequency,
  DeliveryStatus,
  DeliveryTime,
  PaymentMode,
  PaymentType,
  SubscriptionKind,
  SubscriptionPaymentStatus,
  SubscriptionProductAdditionTag,
  SubscriptionStatus,
} from '@/src/domain/customers/enums';

export interface CustomerSubscriptionItem {
  productName: string;
  quantityLabel: string; // e.g. "500 ml", "1 Litre", "250 gram"
}

/** Full-subscription or policy-level pause metadata (optional). */
export interface CustomerSubscriptionPauseDetails {
  pauseStartDate?: string; // ISO
  pauseEndDate?: string; // ISO
  pauseReason?: string;
  resumeDate?: string; // ISO
  pauseStatus?: string;
}

export interface CustomerSubscriptionPlan extends EntityBase {
  productName: string;
  /** Items count e.g. 2 packets/bottles */
  numberOfItems?: number;
  /** Per-item quantity e.g. "500 ml", "250 gram" */
  quantityLabel: string;
  /** Unit label e.g. ml, Litre, gram */
  unitType?: string;
  /** The catalog pack this line was subscribed as, when it came from the catalog. */
  packId?: string;
  /** Monthly = recurring calendar month model; Daily = selected dates / short window */
  subscriptionKind?: SubscriptionKind;
  /** For Daily lines: primary delivery calendar day (ISO date) */
  deliveryDate?: string; // ISO
  deliveryTime: DeliveryTime;
  frequency: DeliveryFrequency;
  startDate: string; // ISO
  endDate?: string; // ISO
  /**
   * Runs until the customer stops it. Without this, a line saved with no end date is read as ending with its start
   * month (the admin's monthly model), which would quietly stop a customer's "until I stop" subscription.
   */
  openEnded?: boolean;
  pauseStartDate?: string; // ISO
  pauseEndDate?: string; // ISO
  resumeDate?: string; // ISO
  pauseReason?: string;
  pauseStatus?: string;
  /** Regular baseline vs temporary extra vs permanent add-on */
  productAdditionTag?: SubscriptionProductAdditionTag;
  notes?: string;
  originalPrice?: number;
  discountedPrice?: number;
  effectiveFinalPrice?: number;
  /** Per-line payment rollup (mock / future billing) */
  paymentStatus?: SubscriptionPaymentStatus;
  /** Estimated daily charge for Daily-type lines */
  dailyCost?: number;
  /** When a permanent add-on was committed */
  addedDate?: string; // ISO
  status: SubscriptionStatus;
}

export interface CustomerPayment extends EntityBase {
  paymentDate: string; // ISO
  amountPaid: number;
  paymentMode: PaymentMode;
  transactionId?: string;
  collectedBy?: string;
  pendingBalanceAfter?: number;
  notes?: string;
}

/**
 * A one-off order for a single day: an add-on next to the subscription, or the only thing wanted that day.
 * `price` is the line total captured when the order was placed — catalog prices move, a placed order must not.
 */
export interface CustomerExtraOrder extends EntityBase {
  orderDate: string; // ISO
  productName: string;
  quantityLabel: string;
  unit?: string;
  /** Packets / bottles of this pack size (1 when omitted). */
  numberOfItems?: number;
  /** The catalog pack this was ordered as, when it came from the catalog. */
  packId?: string;
  price: number;
  deliveryDate?: string; // ISO
  status: 'Pending' | 'Delivered' | 'Cancelled';
  /** Who placed it — the customer app, or the admin on their behalf. */
  placedBy?: 'customer' | 'admin';
  /** The offer it was ordered under (a price offer on this pack, or a combo); `price` is then the offer price. */
  offer?: OrderOfferSnapshot;
  /** A combo's contents, per combo — what goes on the van. */
  comboItems?: { productName: string; packLabel: string; quantity: number }[];
}

/**
 * A change to the subscription for a day or a stretch of days.
 *
 * - `skip`: nothing is delivered — one day, a holiday, or a long pause. Nothing is billed for those days either,
 *   since billing counts delivered rows only.
 * - `quantity`: a different number of packs of one subscription line ("3 packets on the 15th"; 0 skips just that
 *   line). Always tied to a `planId`.
 *
 * A skip wins over a quantity change; between two quantity changes covering the same day, the newer one counts.
 */
export interface CustomerSubscriptionException extends EntityBase {
  /** Rows saved before quantity changes existed have no kind and are skips. */
  kind?: 'skip' | 'quantity';
  /** YYYY-MM-DD, inclusive. */
  fromYmd: string;
  /** YYYY-MM-DD, inclusive. Same as `fromYmd` for a single day. */
  toYmd: string;
  /** Limits the change to one subscription line; a skip without it covers every line on those days. */
  planId?: string;
  /** Packs per day for a `quantity` change. */
  numberOfItems?: number;
  reason?: string;
  createdBy: 'customer' | 'admin';
}

export interface CustomerDeliveryRecord extends EntityBase {
  deliveryDate: string; // ISO
  productName: string;
  quantityLabel: string;
  /** Packs of this product and size handed over that day, subscription and one-off orders together. */
  numberOfItems?: number;
  /**
   * How many of those packs belong to the subscription — what the subscription bill charges for this day.
   * Rows written before per-day quantities existed have none, and bill at the line's usual quantity.
   */
  subscriptionItems?: number;
  deliveryBoyName?: string;
  status: DeliveryStatus;
  missedReason?: string;
  rescheduledDate?: string; // ISO
  notes?: string;
}

/** How a customer says they paid. */
export type PaymentRequestMethod = 'UPI' | 'Cash' | 'Online';

export type PaymentRequestStatus = 'Pending' | 'Confirmed' | 'Rejected' | 'Cancelled';

/**
 * A payment the customer made (or will hand over in cash) from the app, waiting for the dairy to confirm it.
 *
 * The app cannot see a UPI transfer land in the dairy's account, so a customer's payment only counts once the admin
 * confirms it — confirming writes the real `CustomerPayment`, and until then the bill still shows the amount as owed.
 */
export interface CustomerPaymentRequest extends EntityBase {
  amount: number;
  method: PaymentRequestMethod;
  /** UPI transaction reference (UTR) or the gateway's payment id; none for cash. */
  reference?: string;
  /** Day the customer paid, or plans to hand over the cash (YYYY-MM-DD). */
  paidOnYmd: string;
  note?: string;
  status: PaymentRequestStatus;
  reviewedAt?: string; // ISO
  /** Why the dairy did not accept it, shown to the customer. */
  rejectReason?: string;
  /** The payment recorded when the dairy confirmed it. */
  paymentId?: string;
}

export interface CustomerComplaint extends EntityBase {
  complaintDate: string; // ISO
  type: string;
  description?: string;
  status: ComplaintStatus;
  resolutionDate?: string; // ISO
  resolvedBy?: string;
}

export type CustomerComplaintActionKind = 'admin_note' | 'status_change';

/**
 * Action log on a complaint. Stored on the customer so both Admin and Customer apps can display the same history.
 */
export interface CustomerComplaintAction extends EntityBase {
  complaintId: string;
  kind: CustomerComplaintActionKind;
  message: string;
  /** When set, indicates the complaint status after this action */
  nextStatus?: ComplaintStatus;
  createdBy: 'Admin' | 'Customer' | 'System';
}

export interface CustomerAuditEvent extends EntityBase {
  date: string; // ISO
  action: string;
  updatedBy?: string;
  oldValue?: string;
  newValue?: string;
}

export interface Customer extends EntityBase {
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
  /** Link to current delivery boy record (preferred over name for live updates) */
  assignedDeliveryBoyId?: string;
  assignedDeliveryBoyName?: string;
  deliveryTime: DeliveryTime;
  paymentType: PaymentType;
  status: CustomerStatus;

  subscription: CustomerSubscriptionItem[];
  subscriptionPlans?: CustomerSubscriptionPlan[];
  subscriptionStartDate?: string; // ISO
  subscriptionEndDate?: string; // ISO
  subscriptionStatus?: SubscriptionStatus;
  /** Primary subscription mode for the customer (lines may still mix for migrations). */
  subscriptionKind?: SubscriptionKind;
  subscriptionPaymentStatus?: SubscriptionPaymentStatus;
  subscriptionPause?: CustomerSubscriptionPauseDetails;
  /** Default / header cadence for subscription lines (mirrors admin customer form). */
  subscriptionFrequency?: DeliveryFrequency;
  preferredDeliveryNotes?: string;

  monthlyBillAmount: number;
  pendingAmount?: number;
  nextDueDate?: string; // ISO
  lastPaymentDate?: string; // ISO
  nextDeliveryDate: string; // ISO string

  billingType?: string;
  billingCycleDate?: number; // day of month 1-31
  advanceBalance?: number;
  securityDeposit?: number;
  discountAmount?: number;
  taxPercentage?: number;
  preferredPaymentMode?: PaymentMode;

  complaintNotes?: string;
  internalAdminNotes?: string;
  specialDeliveryInstructions?: string;

  payments?: CustomerPayment[];
  /** Payments the customer made from the app, waiting for (or past) the dairy's confirmation. */
  paymentRequests?: CustomerPaymentRequest[];
  extraOrders?: CustomerExtraOrder[];
  /** Offer codes the customer typed in the app. */
  offerClaims?: OfferClaim[];
  /** Catalog products the customer saved from the app. */
  favouriteProductIds?: string[];
  /** Days the customer is skipping (single days, holidays, long pauses). */
  subscriptionExceptions?: CustomerSubscriptionException[];
  deliveries?: CustomerDeliveryRecord[];
  complaints?: CustomerComplaint[];
  complaintActions?: CustomerComplaintAction[];
  audit?: CustomerAuditEvent[];
}

