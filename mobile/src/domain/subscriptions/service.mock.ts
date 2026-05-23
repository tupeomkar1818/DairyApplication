import { DomainError } from '@/src/domain/shared/errors';
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
  MonthlyBillLineDto,
  PlannedDayQuantityDto,
  ReportSubscriptionMismatchRequest,
  SubscriptionDailyDeliveryListResponse,
  SubscriptionDailyDeliveryResponse,
  SubscriptionModificationListResponse,
  SubscriptionNotificationListResponse,
  SubscriptionNotificationResponse,
  UpdateDailyDeliveryExecutionRequest,
} from '@/src/domain/subscriptions/dtos';
import type {
  BaseMilkSubscription,
  SubscriptionAdditionalProductOrder,
  SubscriptionDailyDelivery,
  SubscriptionModification,
  SubscriptionNotification,
} from '@/src/domain/subscriptions/entities';
import type { BaseSubscriptionStatus } from '@/src/domain/subscriptions/enums';
import type { ApproveSubscriptionMismatchResult, ISubscriptionScheduleService } from '@/src/domain/subscriptions/service.interface';
import {
  ApproveSubscriptionMismatchRequestSchema,
  CreateBaseMilkSubscriptionRequestSchema,
  CreateNotificationRequestSchema,
  CreateSubscriptionAdditionalProductOrderRequestSchema,
  CreateSubscriptionModificationRequestSchema,
  EnsureDailyDeliveriesRequestSchema,
  ReportSubscriptionMismatchRequestSchema,
  UpdateDailyDeliveryExecutionRequestSchema,
} from '@/src/domain/subscriptions/validations';
import {
  addDaysYmd,
  billableLitresFromDeliveryRow,
  buildMonthDayYmds,
  daysInMonthYyyyMm,
  diffDaysUtc,
  firstMonthlyCycleEndYmd,
  nextFullCalendarMonthRange,
  plannedQuantityForDate,
  toYmd,
} from '@/src/domain/subscriptions/scheduleEngine';
import { SUBSCRIPTIONS_STORE_KEY } from '@/src/infrastructure/storage/keys';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';

const DEFAULT_DELAY_MS = 250;

type SubscriptionsStore = {
  bases: BaseMilkSubscription[];
  modifications: SubscriptionModification[];
  additionalOrders: SubscriptionAdditionalProductOrder[];
  deliveries: SubscriptionDailyDelivery[];
  notifications: SubscriptionNotification[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function todayYmd(): string {
  return toYmd(nowIso());
}

function maxYmd(a: string, b: string): string {
  return a >= b ? a : b;
}

function minYmd(a: string, b: string): string {
  return a <= b ? a : b;
}

function monthBoundsYmd(yyyyMm: string): { start: string; end: string } {
  const dim = daysInMonthYyyyMm(yyyyMm);
  return { start: `${yyyyMm}-01`, end: `${yyyyMm}-${String(dim).padStart(2, '0')}` };
}

function countIntersectDays(orderFrom: string, orderTo: string | undefined, monthStart: string, monthEnd: string): number {
  const from = maxYmd(toYmd(orderFrom), monthStart);
  const to = minYmd(orderTo ? toYmd(orderTo) : '9999-12-31', monthEnd);
  if (from > to) return 0;
  return diffDaysUtc(from, to) + 1;
}

async function readStore(): Promise<SubscriptionsStore> {
  const raw = await readJson<SubscriptionsStore>(SUBSCRIPTIONS_STORE_KEY);
  return {
    bases: raw?.bases ?? [],
    modifications: raw?.modifications ?? [],
    additionalOrders: raw?.additionalOrders ?? [],
    deliveries: raw?.deliveries ?? [],
    notifications: raw?.notifications ?? [],
  };
}

async function writeStore(s: SubscriptionsStore): Promise<void> {
  await writeJson(SUBSCRIPTIONS_STORE_KEY, s);
}

function deliveryKey(subscriptionId: string, deliveryDate: string, productId: string): string {
  return `${subscriptionId}|${toYmd(deliveryDate)}|${productId}`;
}

function indexDeliveries(deliveries: SubscriptionDailyDelivery[]): Map<string, SubscriptionDailyDelivery> {
  const m = new Map<string, SubscriptionDailyDelivery>();
  for (const d of deliveries) m.set(deliveryKey(d.subscriptionId, d.deliveryDate, d.productId), d);
  return m;
}

function normalizeExecution(row: SubscriptionDailyDelivery): SubscriptionDailyDelivery {
  const planned = Number(row.plannedQuantityLitres ?? 0);
  const delivered = Number(row.deliveredQuantityLitres ?? 0);
  const status = row.deliveryStatus;
  if (row.adminApprovalStatus === 'Pending') return { ...row, deliveryStatus: status };

  if (status === 'NotDelivered') {
    return { ...row, deliveredQuantityLitres: 0 };
  }
  if (status === 'Delivered') {
    const q = delivered > 0 ? delivered : planned;
    return { ...row, deliveredQuantityLitres: q };
  }
  return { ...row, deliveredQuantityLitres: Math.max(0, delivered) };
}

export class SubscriptionScheduleServiceMock implements ISubscriptionScheduleService {
  constructor(private readonly delayMs: number = DEFAULT_DELAY_MS) {}

  private async delay(): Promise<void> {
    if (this.delayMs > 0) await sleep(this.delayMs);
  }

  async createBaseSubscription(data: CreateBaseMilkSubscriptionRequest): Promise<BaseMilkSubscriptionResponse> {
    await this.delay();
    const parsed = CreateBaseMilkSubscriptionRequestSchema.parse(data);
    const store = await readStore();
    const dupActive = store.bases.some((b) => b.customerId === parsed.customerId && b.status === 'Active');
    if (dupActive) {
      throw new DomainError('SUBSCRIPTION_ACTIVE_BASE_EXISTS', 'This customer already has an active milk subscription.');
    }

    const ts = nowIso();
    const start = toYmd(parsed.startDate);
    const end = firstMonthlyCycleEndYmd(start);
    const row: BaseMilkSubscription = {
      id: newId('milk_sub'),
      customerId: parsed.customerId,
      productId: parsed.productId,
      defaultQuantityLitres: parsed.defaultQuantityLitres,
      issueDate: toYmd(ts),
      startDate: start,
      endDate: end,
      status: 'Active',
      deliveryFrequency: parsed.deliveryFrequency,
      billingType: 'Monthly',
      autoRenewMonthly: parsed.autoRenewMonthly ?? true,
      customWeekdays: parsed.customWeekdays,
      createdAt: ts,
      updatedAt: ts,
    };

    store.bases.push(row);
    await writeStore(store);
    return row;
  }

  async getActiveBaseByCustomer(customerId: string): Promise<BaseMilkSubscriptionResponse | null> {
    await this.delay();
    const store = await readStore();
    return store.bases.find((b) => b.customerId === customerId && b.status === 'Active') ?? null;
  }

  async getBaseById(id: string): Promise<BaseMilkSubscriptionResponse | null> {
    await this.delay();
    const store = await readStore();
    return store.bases.find((b) => b.id === id) ?? null;
  }

  async setBaseStatus(subscriptionId: string, status: BaseSubscriptionStatus): Promise<BaseMilkSubscriptionResponse> {
    await this.delay();
    const store = await readStore();
    const idx = store.bases.findIndex((b) => b.id === subscriptionId);
    if (idx < 0) throw new DomainError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
    const ts = nowIso();
    store.bases[idx] = { ...store.bases[idx]!, status, updatedAt: ts };
    await writeStore(store);
    return store.bases[idx]!;
  }

  async addModification(data: CreateSubscriptionModificationRequest): Promise<SubscriptionModification> {
    await this.delay();
    const parsed = CreateSubscriptionModificationRequestSchema.parse(data);
    const store = await readStore();
    const base = store.bases.find((b) => b.id === parsed.subscriptionId);
    if (!base) throw new DomainError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');

    const ts = nowIso();
    const row: SubscriptionModification = {
      id: newId('sub_mod'),
      subscriptionId: parsed.subscriptionId,
      productId: parsed.productId,
      oldQuantityLitres: parsed.oldQuantityLitres,
      newQuantityLitres: parsed.newQuantityLitres,
      effectiveFromDate: toYmd(parsed.effectiveFromDate),
      effectiveToDate: toYmd(parsed.effectiveToDate),
      changeType: parsed.changeType,
      createdBy: parsed.createdBy,
      status: 'Active',
      createdAt: ts,
      updatedAt: ts,
    };
    store.modifications.push(row);
    store.notifications.push({
      id: newId('notif'),
      customerId: base.customerId,
      audience: 'Customer',
      type: 'QuantityChanged',
      title: 'Subscription quantity updated',
      body: `Plan changed from ${parsed.oldQuantityLitres} to ${parsed.newQuantityLitres} (${parsed.changeType}) between ${row.effectiveFromDate} and ${row.effectiveToDate}.`,
      relatedSubscriptionId: base.id,
      createdAt: ts,
      updatedAt: ts,
    });
    await writeStore(store);
    return row;
  }

  async listModifications(subscriptionId: string): Promise<SubscriptionModificationListResponse> {
    await this.delay();
    const store = await readStore();
    const items = store.modifications.filter((m) => m.subscriptionId === subscriptionId);
    return { items, total: items.length };
  }

  async createAdditionalProductOrder(
    data: CreateSubscriptionAdditionalProductOrderRequest,
  ): Promise<SubscriptionAdditionalProductOrder> {
    await this.delay();
    const parsed = CreateSubscriptionAdditionalProductOrderRequestSchema.parse(data);
    const ts = nowIso();
    const store = await readStore();
    const row: SubscriptionAdditionalProductOrder = {
      id: newId('add_ord'),
      customerId: parsed.customerId,
      productId: parsed.productId,
      quantityLitresOrUnits: parsed.quantityLitresOrUnits,
      startDate: toYmd(parsed.startDate),
      endDate: parsed.endDate ? toYmd(parsed.endDate) : undefined,
      orderType: parsed.orderType,
      deliveryStatus: 'NotDelivered',
      createdBy: parsed.createdBy,
      createdAt: ts,
      updatedAt: ts,
    };
    store.additionalOrders.push(row);
    store.notifications.push({
      id: newId('notif'),
      customerId: parsed.customerId,
      audience: 'Customer',
      type: 'AdditionalProductAdded',
      title: 'Extra product on your subscription',
      body: `Add-on order (${parsed.orderType}) for product ${parsed.productId}, qty ${parsed.quantityLitresOrUnits}, from ${row.startDate}${row.endDate ? ` to ${row.endDate}` : ''}.`,
      createdAt: ts,
      updatedAt: ts,
    });
    await writeStore(store);
    return row;
  }

  async listAdditionalProductOrders(customerId: string): Promise<SubscriptionAdditionalProductOrder[]> {
    await this.delay();
    const store = await readStore();
    return store.additionalOrders.filter((o) => o.customerId === customerId);
  }

  async getPlannedSchedule(subscriptionId: string, monthYyyyMm: string): Promise<PlannedDayQuantityDto[]> {
    await this.delay();
    const store = await readStore();
    const b = store.bases.find((x) => x.id === subscriptionId);
    if (!b) throw new DomainError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
    const mods = store.modifications;
    return buildMonthDayYmds(monthYyyyMm).map((d) => plannedQuantityForDate(b, mods, d));
  }

  async ensureDailyDeliveries(data: EnsureDailyDeliveriesRequest): Promise<SubscriptionDailyDeliveryListResponse> {
    await this.delay();
    const parsed = EnsureDailyDeliveriesRequestSchema.parse(data);
    const store = await readStore();
    const base = store.bases.find((b) => b.id === parsed.subscriptionId);
    if (!base) throw new DomainError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');

    const byKey = indexDeliveries(store.deliveries);
    const ts = nowIso();
    const mods = store.modifications;

    for (const d of buildMonthDayYmds(parsed.monthYyyyMm)) {
      const plan = plannedQuantityForDate(base, mods, d);
      if (plan.plannedQuantityLitres <= 0) continue;
      const k = deliveryKey(base.id, d, base.productId);
      if (byKey.has(k)) continue;

      const row: SubscriptionDailyDelivery = {
        id: newId('del'),
        customerId: base.customerId,
        subscriptionId: base.id,
        productId: base.productId,
        deliveryDate: d,
        plannedQuantityLitres: plan.plannedQuantityLitres,
        deliveredQuantityLitres: undefined,
        deliveryStatus: 'NotDelivered',
        adminApprovalStatus: 'NotRequired',
        subscriptionMismatchReported: false,
        createdAt: ts,
        updatedAt: ts,
      };
      store.deliveries.push(row);
      byKey.set(k, row);
    }

    await writeStore(store);
    const items = store.deliveries.filter((x) => x.subscriptionId === base.id && x.deliveryDate.startsWith(parsed.monthYyyyMm));
    items.sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
    return { items, total: items.length };
  }

  async listDailyDeliveries(subscriptionId: string, monthYyyyMm: string): Promise<SubscriptionDailyDeliveryListResponse> {
    await this.delay();
    const store = await readStore();
    const items = store.deliveries
      .filter((x) => x.subscriptionId === subscriptionId && x.deliveryDate.startsWith(monthYyyyMm))
      .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
    return { items, total: items.length };
  }

  async updateDailyDeliveryExecution(
    deliveryId: string,
    data: UpdateDailyDeliveryExecutionRequest,
  ): Promise<SubscriptionDailyDeliveryResponse> {
    await this.delay();
    const parsed = UpdateDailyDeliveryExecutionRequestSchema.parse(data);
    const store = await readStore();
    const idx = store.deliveries.findIndex((d) => d.id === deliveryId);
    if (idx < 0) throw new DomainError('SUBSCRIPTION_DELIVERY_NOT_FOUND', 'Delivery row not found');
    if (store.deliveries[idx]!.adminApprovalStatus === 'Pending') {
      throw new DomainError(
        'SUBSCRIPTION_MISMATCH_INVALID_STATE',
        'A subscription mismatch is awaiting admin approval. Approve or reject it before recording a normal delivery.',
      );
    }

    const ts = nowIso();
    let row: SubscriptionDailyDelivery = {
      ...store.deliveries[idx]!,
      deliveredQuantityLitres: parsed.deliveredQuantityLitres,
      deliveryStatus: parsed.deliveryStatus,
      deliveryBoyId: parsed.deliveryBoyId ?? store.deliveries[idx]!.deliveryBoyId,
      remarks: parsed.remarks ?? store.deliveries[idx]!.remarks,
      adminApprovalStatus: 'NotRequired',
      subscriptionMismatchReported: false,
      updatedAt: ts,
    };
    row = normalizeExecution(row);
    store.deliveries[idx] = row;
    await writeStore(store);
    return row;
  }

  async reportSubscriptionMismatch(
    deliveryId: string,
    data: ReportSubscriptionMismatchRequest,
  ): Promise<SubscriptionDailyDeliveryResponse> {
    await this.delay();
    const parsed = ReportSubscriptionMismatchRequestSchema.parse(data);
    const store = await readStore();
    const idx = store.deliveries.findIndex((d) => d.id === deliveryId);
    if (idx < 0) throw new DomainError('SUBSCRIPTION_DELIVERY_NOT_FOUND', 'Delivery row not found');

    const ts = nowIso();
    const row: SubscriptionDailyDelivery = {
      ...store.deliveries[idx]!,
      customerRequestedQuantityLitres: parsed.customerRequestedQuantityLitres,
      deliveryBoyId: parsed.deliveryBoyId ?? store.deliveries[idx]!.deliveryBoyId,
      remarks: parsed.remarks ?? store.deliveries[idx]!.remarks,
      subscriptionMismatchReported: true,
      adminApprovalStatus: 'Pending',
      updatedAt: ts,
    };
    store.deliveries[idx] = row;

    const dupAdmin = store.notifications.some(
      (n) =>
        n.audience === 'Admin' &&
        n.type === 'SubscriptionMismatchPendingAdmin' &&
        n.relatedDeliveryId === deliveryId &&
        toYmd(n.createdAt) === todayYmd(),
    );
    if (!dupAdmin) {
      store.notifications.push({
        id: newId('notif'),
        customerId: row.customerId,
        audience: 'Admin',
        type: 'SubscriptionMismatchPendingAdmin',
        title: 'Subscription mismatch — approval needed',
        body: `Delivery ${deliveryId}: planned ${row.plannedQuantityLitres} L vs customer request ${parsed.customerRequestedQuantityLitres} L. Review and approve.`,
        relatedSubscriptionId: row.subscriptionId,
        relatedDeliveryId: deliveryId,
        createdAt: ts,
        updatedAt: ts,
      });
    }

    await writeStore(store);
    return row;
  }

  async approveSubscriptionMismatch(
    deliveryId: string,
    data: ApproveSubscriptionMismatchRequest,
  ): Promise<ApproveSubscriptionMismatchResult> {
    await this.delay();
    const parsed = ApproveSubscriptionMismatchRequestSchema.parse(data);
    const store = await readStore();
    const idx = store.deliveries.findIndex((d) => d.id === deliveryId);
    if (idx < 0) throw new DomainError('SUBSCRIPTION_DELIVERY_NOT_FOUND', 'Delivery row not found');
    const current = store.deliveries[idx]!;
    if (current.adminApprovalStatus !== 'Pending' || !current.subscriptionMismatchReported) {
      throw new DomainError('SUBSCRIPTION_MISMATCH_INVALID_STATE', 'No pending mismatch to approve on this delivery row.');
    }

    const requested = Number(current.customerRequestedQuantityLitres ?? 0);
    const planned = Number(current.plannedQuantityLitres ?? 0);
    let deliveryStatus: SubscriptionDailyDelivery['deliveryStatus'] = 'Delivered';
    if (requested <= 0) deliveryStatus = 'NotDelivered';
    else if (requested === planned) deliveryStatus = 'Delivered';
    else deliveryStatus = 'Partial';

    const ts = nowIso();
    const updated: SubscriptionDailyDelivery = normalizeExecution({
      ...current,
      deliveredQuantityLitres: requested,
      deliveryStatus,
      adminApprovalStatus: 'Approved',
      updatedAt: ts,
    });
    store.deliveries[idx] = updated;

    let modification: SubscriptionModification | undefined;
    if (parsed.applyForwardModification) {
      const b = store.bases.find((x) => x.id === current.subscriptionId);
      if (b) {
        const from = addDaysYmd(toYmd(current.deliveryDate), 1);
        const modRow: SubscriptionModification = {
          id: newId('sub_mod'),
          subscriptionId: b.id,
          productId: b.productId,
          oldQuantityLitres: planned,
          newQuantityLitres: requested,
          effectiveFromDate: from,
          effectiveToDate: toYmd(b.endDate),
          changeType: requested > planned ? 'Increase' : requested < planned ? 'Decrease' : 'Pause',
          createdBy: 'Admin',
          status: 'Active',
          createdAt: ts,
          updatedAt: ts,
        };
        store.modifications.push(modRow);
        modification = modRow;
        store.notifications.push({
          id: newId('notif'),
          customerId: updated.customerId,
          audience: 'Customer',
          type: 'QuantityChanged',
          title: 'Subscription refreshed after delivery',
          body: `Your regular quantity is updated from ${from} through ${toYmd(b.endDate)} following today's delivery (${requested} L delivered).`,
          relatedSubscriptionId: b.id,
          relatedDeliveryId: deliveryId,
          createdAt: ts,
          updatedAt: ts,
        });
      }
    }

    await writeStore(store);
    return { delivery: updated, modification };
  }

  async generateMonthlyBillDraft(params: {
    customerId: string;
    monthYyyyMm: string;
    unitPriceByProductId: Record<string, number>;
  }): Promise<MonthlyBillDraftDto> {
    await this.delay();
    const { customerId, monthYyyyMm, unitPriceByProductId } = params;
    const { start, end } = monthBoundsYmd(monthYyyyMm);
    const store = await readStore();

    const lines: MonthlyBillLineDto[] = [];

    const deliveries = store.deliveries.filter(
      (d) => d.customerId === customerId && isYmdInRange(d.deliveryDate, start, end),
    );
    for (const d of deliveries) {
      const unit = Number(unitPriceByProductId[d.productId] ?? 0);
      const billed = billableLitresFromDeliveryRow(d);
      lines.push({
        kind: 'BaseMilkDelivery',
        deliveryId: d.id,
        productId: d.productId,
        deliveryDate: toYmd(d.deliveryDate),
        plannedQuantityLitres: Number(d.plannedQuantityLitres ?? 0),
        billedQuantityLitres: billed,
        unitPrice: unit,
        lineTotal: Math.round(billed * unit * 100) / 100,
      });
    }

    const orders = store.additionalOrders.filter((o) => o.customerId === customerId);
    for (const o of orders) {
      const unit = Number(unitPriceByProductId[o.productId] ?? 0);
      let days = 0;
      if (o.orderType === 'OneTime') {
        const sd = toYmd(o.startDate);
        days = sd >= start && sd <= end ? 1 : 0;
      } else {
        days = countIntersectDays(o.startDate, o.endDate, start, end);
      }
      if (days <= 0) continue;
      const billedQty = o.quantityLitresOrUnits * days;
      lines.push({
        kind: 'AdditionalProduct',
        orderId: o.id,
        productId: o.productId,
        deliveryDate: toYmd(o.startDate),
        plannedQuantityLitres: billedQty,
        billedQuantityLitres: billedQty,
        unitPrice: unit,
        lineTotal: Math.round(billedQty * unit * 100) / 100,
      });
    }

    const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
    return { customerId, monthYyyyMm, lines, subtotal };
  }

  async renewSubscriptionForNextMonth(subscriptionId: string): Promise<BaseMilkSubscriptionResponse | null> {
    await this.delay();
    const store = await readStore();
    const idx = store.bases.findIndex((b) => b.id === subscriptionId);
    if (idx < 0) throw new DomainError('SUBSCRIPTION_NOT_FOUND', 'Subscription not found');
    const cur = store.bases[idx]!;
    if (!cur.autoRenewMonthly) return null;

    const ts = nowIso();
    const { start, end } = nextFullCalendarMonthRange(toYmd(cur.endDate));
    const next: BaseMilkSubscription = {
      ...cur,
      id: newId('milk_sub'),
      startDate: start,
      endDate: end,
      status: 'Active',
      issueDate: toYmd(ts),
      createdAt: ts,
      updatedAt: ts,
    };

    store.bases[idx] = { ...cur, status: 'Expired', updatedAt: ts };
    store.bases.push(next);
    await writeStore(store);
    return next;
  }

  async enqueueSystemNotifications(): Promise<EnqueueSubscriptionNotificationsResultDto> {
    await this.delay();
    const store = await readStore();
    let inserted = 0;
    const ts = nowIso();
    const t = todayYmd();

    const hasRecentCustomer = (customerId: string, type: SubscriptionNotification['type'], subId: string, day: string): boolean => {
      return store.notifications.some(
        (n) =>
          n.customerId === customerId &&
          (n.audience ?? 'Customer') === 'Customer' &&
          n.type === type &&
          n.relatedSubscriptionId === subId &&
          toYmd(n.createdAt) === day,
      );
    };

    for (const b of store.bases) {
      if (b.status !== 'Active') continue;
      const start = toYmd(b.startDate);
      const end = toYmd(b.endDate);
      if (t === start && t <= end && !hasRecentCustomer(b.customerId, 'SubscriptionStarted', b.id, t)) {
        store.notifications.push({
          id: newId('notif'),
          customerId: b.customerId,
          audience: 'Customer',
          type: 'SubscriptionStarted',
          title: 'Subscription started',
          body: `Your monthly milk subscription is active from ${start} through ${end}. Daily quantity can still be adjusted for specific dates in the app.`,
          relatedSubscriptionId: b.id,
          createdAt: ts,
          updatedAt: ts,
        });
        inserted += 1;
      }
      const diff = diffDaysUtc(t, end);
      if (diff === 3 && !hasRecentCustomer(b.customerId, 'SubscriptionExpiringIn3Days', b.id, t)) {
        store.notifications.push({
          id: newId('notif'),
          customerId: b.customerId,
          audience: 'Customer',
          type: 'SubscriptionExpiringIn3Days',
          title: 'Subscription ending soon',
          body: `Your milk subscription ends on ${end}. Renew to avoid interruption.`,
          relatedSubscriptionId: b.id,
          createdAt: ts,
          updatedAt: ts,
        });
        inserted += 1;
      }
      if (diff < 0 && !hasRecentCustomer(b.customerId, 'SubscriptionExpired', b.id, t)) {
        store.notifications.push({
          id: newId('notif'),
          customerId: b.customerId,
          audience: 'Customer',
          type: 'SubscriptionExpired',
          title: 'Subscription expired',
          body: `Your milk subscription ended on ${end}.`,
          relatedSubscriptionId: b.id,
          createdAt: ts,
          updatedAt: ts,
        });
        inserted += 1;
      }
    }

    await writeStore(store);
    return { inserted };
  }

  async listNotifications(customerId: string): Promise<SubscriptionNotificationListResponse> {
    await this.delay();
    const store = await readStore();
    const items = store.notifications
      .filter((n) => n.customerId === customerId && (n.audience ?? 'Customer') === 'Customer')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items, total: items.length };
  }

  async listAdminSubscriptionNotifications(): Promise<SubscriptionNotificationListResponse> {
    await this.delay();
    const store = await readStore();
    const items = store.notifications
      .filter((n) => n.audience === 'Admin')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items, total: items.length };
  }

  async markNotificationRead(notificationId: string): Promise<SubscriptionNotificationResponse> {
    await this.delay();
    const store = await readStore();
    const idx = store.notifications.findIndex((n) => n.id === notificationId);
    if (idx < 0) throw new DomainError('NOTIFICATION_NOT_FOUND', 'Notification not found');
    const ts = nowIso();
    store.notifications[idx] = { ...store.notifications[idx]!, readAt: ts, updatedAt: ts };
    await writeStore(store);
    return store.notifications[idx]!;
  }

  async createNotification(data: CreateNotificationRequest): Promise<SubscriptionNotificationResponse> {
    await this.delay();
    const parsed = CreateNotificationRequestSchema.parse(data);
    const ts = nowIso();
    const store = await readStore();
    const row: SubscriptionNotification = {
      id: newId('notif'),
      customerId: parsed.customerId,
      audience: parsed.audience,
      type: parsed.type,
      title: parsed.title,
      body: parsed.body,
      relatedSubscriptionId: parsed.relatedSubscriptionId,
      relatedDeliveryId: parsed.relatedDeliveryId,
      createdAt: ts,
      updatedAt: ts,
    };
    store.notifications.push(row);
    await writeStore(store);
    return row;
  }
}

function isYmdInRange(ymd: string, start: string, end: string): boolean {
  const d = toYmd(ymd);
  return d >= start && d <= end;
}
