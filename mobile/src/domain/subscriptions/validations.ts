import { z } from 'zod';

import { strings, type Dictionary } from '@/src/i18n/strings';

/** YYYY-MM-DD, optionally followed by an ISO time part (the date component is what the schedule uses). */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

type ValidationWording = Dictionary['customer']['subscriptionService']['validation'];

/** zod's message option, read in the current language when the message is shown. */
function msg(pick: (v: ValidationWording) => string) {
  return { error: () => pick(strings('customer').subscriptionService.validation) };
}

function isRealCalendarYmd(value: string): boolean {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Normalized calendar day for cross-field comparisons (raw strings may carry a time part). */
function ymdPart(value: string): string {
  return value.trim().slice(0, 10);
}

const IsoDateYmdSchema = z
  .string()
  .trim()
  .min(10, msg((v) => v.dateRequired))
  .regex(ISO_DATE_PATTERN, msg((v) => v.dateFormat))
  .refine(isRealCalendarYmd, msg((v) => v.realDate));

const MonthYyyyMmSchema = z.string().regex(/^\d{4}-\d{2}$/, msg((v) => v.monthKey));

const NonNegLitresSchema = z
  .number()
  .finite(msg((v) => v.quantityValid))
  .nonnegative(msg((v) => v.quantityNegative));

export const CreateBaseMilkSubscriptionRequestSchema = z
  .object({
    customerId: z.string().min(1, msg((v) => v.customerRequired)),
    productId: z.string().min(1, msg((v) => v.productRequired)),
    defaultQuantityLitres: NonNegLitresSchema,
    startDate: IsoDateYmdSchema,
    deliveryFrequency: z.union([z.literal('Daily'), z.literal('AlternateDay'), z.literal('Custom')]),
    customWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
    autoRenewMonthly: z.boolean().optional(),
  })
  .refine(
    (v) => (v.deliveryFrequency === 'Custom' ? (v.customWeekdays?.length ?? 0) > 0 : true),
    msg((v) => v.weekdayRequired),
  );

export const CreateSubscriptionModificationRequestSchema = z
  .object({
    subscriptionId: z.string().min(1, msg((v) => v.subscriptionRequired)),
    productId: z.string().min(1, msg((v) => v.productRequired)),
    oldQuantityLitres: NonNegLitresSchema,
    newQuantityLitres: NonNegLitresSchema,
    effectiveFromDate: IsoDateYmdSchema,
    effectiveToDate: IsoDateYmdSchema,
    changeType: z.union([z.literal('Increase'), z.literal('Decrease'), z.literal('Pause')]),
    createdBy: z.union([z.literal('Customer'), z.literal('Admin')]),
  })
  .refine((v) => ymdPart(v.effectiveToDate) >= ymdPart(v.effectiveFromDate), msg((v) => v.effectiveEnd));

export const CreateSubscriptionAdditionalProductOrderRequestSchema = z
  .object({
    customerId: z.string().min(1, msg((v) => v.customerRequired)),
    productId: z.string().min(1, msg((v) => v.productRequired)),
    quantityLitresOrUnits: z
      .number()
      .finite(msg((v) => v.quantityValid))
      .positive(msg((v) => v.quantityPositive)),
    startDate: IsoDateYmdSchema,
    endDate: IsoDateYmdSchema.optional(),
    orderType: z.union([z.literal('OneTime'), z.literal('Temporary'), z.literal('Permanent')]),
    createdBy: z.union([z.literal('Customer'), z.literal('Admin')]),
  })
  .refine((v) => (v.endDate ? ymdPart(v.endDate) >= ymdPart(v.startDate) : true), msg((v) => v.endAfterStart))
  .refine((v) => (v.orderType === 'Temporary' ? Boolean(v.endDate) : true), msg((v) => v.temporaryNeedsEnd))
  .refine((v) => (v.orderType === 'OneTime' ? !v.endDate : true), msg((v) => v.oneTimeNoEnd));

export const EnsureDailyDeliveriesRequestSchema = z.object({
  subscriptionId: z.string().min(1, msg((v) => v.subscriptionRequired)),
  monthYyyyMm: MonthYyyyMmSchema,
});

export const UpdateDailyDeliveryExecutionRequestSchema = z.object({
  deliveredQuantityLitres: NonNegLitresSchema,
  deliveryStatus: z.union([z.literal('Delivered'), z.literal('NotDelivered'), z.literal('Partial')]),
  deliveryBoyId: z.string().min(1).optional(),
  remarks: z.string().max(500).optional(),
});

export const ReportSubscriptionMismatchRequestSchema = z.object({
  customerRequestedQuantityLitres: NonNegLitresSchema,
  deliveryBoyId: z.string().min(1).optional(),
  remarks: z.string().max(500).optional(),
});

export const ApproveSubscriptionMismatchRequestSchema = z.object({
  applyForwardModification: z.boolean().optional(),
});

export const CreateNotificationRequestSchema = z.object({
  customerId: z.string().min(1, msg((v) => v.customerRequired)),
  audience: z.union([z.literal('Customer'), z.literal('Admin')]).optional(),
  type: z.enum([
    'SubscriptionStarted',
    'SubscriptionExpiringIn3Days',
    'SubscriptionExpired',
    'SubscriptionMismatchPendingAdmin',
    'SubscriptionPaused',
    'SubscriptionResumed',
    'QuantityChanged',
    'AdditionalProductAdded',
    'DeliveryNotCompleted',
    'MonthlyBillGenerated',
    'PaymentPending',
  ]),
  title: z.string().min(1, msg((v) => v.titleRequired)).max(120),
  body: z.string().min(1, msg((v) => v.messageRequired)).max(2000),
  relatedSubscriptionId: z.string().min(1).optional(),
  relatedDeliveryId: z.string().min(1).optional(),
});

export type CreateBaseMilkSubscriptionRequestInput = z.infer<typeof CreateBaseMilkSubscriptionRequestSchema>;
export type CreateSubscriptionModificationRequestInput = z.infer<typeof CreateSubscriptionModificationRequestSchema>;
export type CreateSubscriptionAdditionalProductOrderRequestInput = z.infer<typeof CreateSubscriptionAdditionalProductOrderRequestSchema>;
