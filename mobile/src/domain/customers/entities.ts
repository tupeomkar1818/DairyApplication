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
  /** Monthly = recurring calendar month model; Daily = selected dates / short window */
  subscriptionKind?: SubscriptionKind;
  /** For Daily lines: primary delivery calendar day (ISO date) */
  deliveryDate?: string; // ISO
  deliveryTime: DeliveryTime;
  frequency: DeliveryFrequency;
  startDate: string; // ISO
  endDate?: string; // ISO
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

export interface CustomerExtraOrder extends EntityBase {
  orderDate: string; // ISO
  productName: string;
  quantityLabel: string;
  unit?: string;
  price: number;
  deliveryDate?: string; // ISO
  status: 'Pending' | 'Delivered' | 'Cancelled';
}

export interface CustomerDeliveryRecord extends EntityBase {
  deliveryDate: string; // ISO
  productName: string;
  quantityLabel: string;
  deliveryBoyName?: string;
  status: DeliveryStatus;
  missedReason?: string;
  rescheduledDate?: string; // ISO
  notes?: string;
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
  extraOrders?: CustomerExtraOrder[];
  deliveries?: CustomerDeliveryRecord[];
  complaints?: CustomerComplaint[];
  complaintActions?: CustomerComplaintAction[];
  audit?: CustomerAuditEvent[];
}

