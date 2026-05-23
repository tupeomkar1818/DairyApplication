import type {
  BaseMilkSubscription,
  SubscriptionAdditionalProductOrder,
  SubscriptionDailyDelivery,
  SubscriptionModification,
  SubscriptionNotification,
  SubscriptionNotificationAudience,
} from '@/src/domain/subscriptions/entities';
import type {
  BaseSubscriptionDeliveryFrequency,
  SubscriptionAdditionalOrderType,
  SubscriptionDeliveryExecutionStatus,
  SubscriptionModificationActor,
  SubscriptionModificationChangeType,
  SubscriptionNotificationType,
} from '@/src/domain/subscriptions/enums';

export interface CreateBaseMilkSubscriptionRequest {
  customerId: string;
  productId: string;
  defaultQuantityLitres: number;
  /** ISO date (YYYY-MM-DD or full ISO). Defaults to issue-day logic in service. */
  startDate: string;
  deliveryFrequency: BaseSubscriptionDeliveryFrequency;
  customWeekdays?: number[];
  autoRenewMonthly?: boolean;
}

export interface CreateSubscriptionModificationRequest {
  subscriptionId: string;
  productId: string;
  oldQuantityLitres: number;
  newQuantityLitres: number;
  effectiveFromDate: string;
  effectiveToDate: string;
  changeType: SubscriptionModificationChangeType;
  createdBy: SubscriptionModificationActor;
}

export interface CreateSubscriptionAdditionalProductOrderRequest {
  customerId: string;
  productId: string;
  quantityLitresOrUnits: number;
  startDate: string;
  endDate?: string;
  orderType: SubscriptionAdditionalOrderType;
  createdBy: SubscriptionModificationActor;
}

export interface PlannedDayQuantityDto {
  date: string;
  plannedQuantityLitres: number;
  source: 'BaseDefault' | 'Modification';
  winningModificationId?: string;
}

export interface EnsureDailyDeliveriesRequest {
  subscriptionId: string;
  monthYyyyMm: string;
}

export interface UpdateDailyDeliveryExecutionRequest {
  deliveredQuantityLitres: number;
  deliveryStatus: SubscriptionDeliveryExecutionStatus;
  deliveryBoyId?: string;
  remarks?: string;
}

export interface ReportSubscriptionMismatchRequest {
  customerRequestedQuantityLitres: number;
  deliveryBoyId?: string;
  remarks?: string;
}

export interface ApproveSubscriptionMismatchRequest {
  /** When true, inserts an open-ended modification from the day after delivery through subscription `endDate`. */
  applyForwardModification?: boolean;
}

export interface MonthlyBillLineDto {
  kind: 'BaseMilkDelivery' | 'AdditionalProduct';
  deliveryId?: string;
  orderId?: string;
  productId: string;
  deliveryDate: string;
  plannedQuantityLitres: number;
  billedQuantityLitres: number;
  unitPrice: number;
  lineTotal: number;
}

export interface MonthlyBillDraftDto {
  customerId: string;
  monthYyyyMm: string;
  lines: MonthlyBillLineDto[];
  subtotal: number;
}

export type BaseMilkSubscriptionResponse = BaseMilkSubscription;
export type SubscriptionModificationResponse = SubscriptionModification;
export type SubscriptionAdditionalProductOrderResponse = SubscriptionAdditionalProductOrder;
export type SubscriptionDailyDeliveryResponse = SubscriptionDailyDelivery;
export type SubscriptionNotificationResponse = SubscriptionNotification;

export interface SubscriptionModificationListResponse {
  items: SubscriptionModificationResponse[];
  total: number;
}

export interface SubscriptionDailyDeliveryListResponse {
  items: SubscriptionDailyDeliveryResponse[];
  total: number;
}

export interface SubscriptionNotificationListResponse {
  items: SubscriptionNotificationResponse[];
  total: number;
}

export interface EnqueueSubscriptionNotificationsResultDto {
  inserted: number;
}

export interface CreateNotificationRequest {
  customerId: string;
  audience?: SubscriptionNotificationAudience;
  type: SubscriptionNotificationType;
  title: string;
  body: string;
  relatedSubscriptionId?: string;
  relatedDeliveryId?: string;
}
