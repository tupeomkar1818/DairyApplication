import type {
  ApproveSubscriptionMismatchRequest,
  BaseMilkSubscriptionResponse,
  CreateBaseMilkSubscriptionRequest,
  CreateNotificationRequest,
  CreateSubscriptionAdditionalProductOrderRequest,
  CreateSubscriptionModificationRequest,
  EnqueueSubscriptionNotificationsResultDto,
  EnsureDailyDeliveriesRequest,
  MonthlyBillDraftDto,
  PlannedDayQuantityDto,
  ReportSubscriptionMismatchRequest,
  SubscriptionAdditionalProductOrderResponse,
  SubscriptionDailyDeliveryListResponse,
  SubscriptionDailyDeliveryResponse,
  SubscriptionModificationListResponse,
  SubscriptionModificationResponse,
  SubscriptionNotificationListResponse,
  SubscriptionNotificationResponse,
  UpdateDailyDeliveryExecutionRequest,
} from '@/src/domain/subscriptions/dtos';
import type { BaseSubscriptionStatus } from '@/src/domain/subscriptions/enums';

export interface ApproveSubscriptionMismatchResult {
  delivery: SubscriptionDailyDeliveryResponse;
  modification?: SubscriptionModificationResponse;
}

export interface ISubscriptionScheduleService {
  /** POST /api/subscriptions/milk-base */
  createBaseSubscription(data: CreateBaseMilkSubscriptionRequest): Promise<BaseMilkSubscriptionResponse>;

  /** GET /api/subscriptions/milk-base/active?customerId= */
  getActiveBaseByCustomer(customerId: string): Promise<BaseMilkSubscriptionResponse | null>;

  /** GET /api/subscriptions/milk-base/:id */
  getBaseById(id: string): Promise<BaseMilkSubscriptionResponse | null>;

  /** PATCH /api/subscriptions/milk-base/:id/status */
  setBaseStatus(subscriptionId: string, status: BaseSubscriptionStatus): Promise<BaseMilkSubscriptionResponse>;

  /**
   * POST /api/subscriptions/milk-base/:id/modifications
   * @throws DomainError SUBSCRIPTION_NOT_FOUND
   */
  addModification(data: CreateSubscriptionModificationRequest): Promise<SubscriptionModificationResponse>;

  /** GET /api/subscriptions/milk-base/:subscriptionId/modifications */
  listModifications(subscriptionId: string): Promise<SubscriptionModificationListResponse>;

  /** POST /api/subscriptions/additional-orders */
  createAdditionalProductOrder(
    data: CreateSubscriptionAdditionalProductOrderRequest,
  ): Promise<SubscriptionAdditionalProductOrderResponse>;

  /** GET /api/subscriptions/additional-orders?customerId= */
  listAdditionalProductOrders(customerId: string): Promise<SubscriptionAdditionalProductOrderResponse[]>;

  /** GET /api/subscriptions/milk-base/:subscriptionId/planned-schedule?month=YYYY-MM */
  getPlannedSchedule(subscriptionId: string, monthYyyyMm: string): Promise<PlannedDayQuantityDto[]>;

  /**
   * POST /api/subscriptions/daily-deliveries/ensure
   * Creates rows only for days with planned quantity > 0 (paused / off-schedule days are skipped).
   */
  ensureDailyDeliveries(data: EnsureDailyDeliveriesRequest): Promise<SubscriptionDailyDeliveryListResponse>;

  /** GET /api/subscriptions/daily-deliveries?subscriptionId=&month=YYYY-MM */
  listDailyDeliveries(subscriptionId: string, monthYyyyMm: string): Promise<SubscriptionDailyDeliveryListResponse>;

  /**
   * PATCH /api/subscriptions/daily-deliveries/:id/execution
   * @throws DomainError SUBSCRIPTION_DELIVERY_NOT_FOUND
   */
  updateDailyDeliveryExecution(
    deliveryId: string,
    data: UpdateDailyDeliveryExecutionRequest,
  ): Promise<SubscriptionDailyDeliveryResponse>;

  /**
   * POST /api/subscriptions/daily-deliveries/:id/mismatch
   * @throws DomainError SUBSCRIPTION_DELIVERY_NOT_FOUND
   */
  reportSubscriptionMismatch(
    deliveryId: string,
    data: ReportSubscriptionMismatchRequest,
  ): Promise<SubscriptionDailyDeliveryResponse>;

  /**
   * POST /api/subscriptions/daily-deliveries/:id/mismatch/approve
   * Finalises billing quantity; optional forward modification refreshes future planned quantities.
   * @throws DomainError SUBSCRIPTION_DELIVERY_NOT_FOUND | SUBSCRIPTION_MISMATCH_INVALID_STATE
   */
  approveSubscriptionMismatch(
    deliveryId: string,
    data: ApproveSubscriptionMismatchRequest,
  ): Promise<ApproveSubscriptionMismatchResult>;

  /**
   * POST /api/subscriptions/billing/monthly-draft
   * Base milk uses delivery rows only. Additional products use prorated days in-month for the mock (replace with delivery rows on backend if needed).
   */
  generateMonthlyBillDraft(params: {
    customerId: string;
    monthYyyyMm: string;
    unitPriceByProductId: Record<string, number>;
  }): Promise<MonthlyBillDraftDto>;

  /** POST /api/subscriptions/milk-base/:id/renew-next-month */
  renewSubscriptionForNextMonth(subscriptionId: string): Promise<BaseMilkSubscriptionResponse | null>;

  /** POST /api/subscriptions/notifications/enqueue-system */
  enqueueSystemNotifications(): Promise<EnqueueSubscriptionNotificationsResultDto>;

  /** GET /api/subscriptions/notifications?customerId= (customer-facing only; excludes admin queue) */
  listNotifications(customerId: string): Promise<SubscriptionNotificationListResponse>;

  /** GET /api/subscriptions/notifications/admin-queue */
  listAdminSubscriptionNotifications(): Promise<SubscriptionNotificationListResponse>;

  /** PATCH /api/subscriptions/notifications/:id/read */
  markNotificationRead(notificationId: string): Promise<SubscriptionNotificationResponse>;

  /** POST /api/subscriptions/notifications */
  createNotification(data: CreateNotificationRequest): Promise<SubscriptionNotificationResponse>;
}
