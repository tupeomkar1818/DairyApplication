import { z } from 'zod';

const IsoDateYmdSchema = z
  .string()
  .min(10, 'Date is required')
  .regex(/^\d{4}-\d{2}-\d{2}/, 'Use YYYY-MM-DD format');

const MonthYyyyMmSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM month key');

const NonNegLitresSchema = z.number().finite('Quantity must be valid').nonnegative('Quantity cannot be negative');

export const CreateBaseMilkSubscriptionRequestSchema = z
  .object({
    customerId: z.string().min(1, 'Customer is required'),
    productId: z.string().min(1, 'Product is required'),
    defaultQuantityLitres: NonNegLitresSchema,
    startDate: IsoDateYmdSchema,
    deliveryFrequency: z.union([z.literal('Daily'), z.literal('AlternateDay'), z.literal('Custom')]),
    customWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
    autoRenewMonthly: z.boolean().optional(),
  })
  .refine(
    (v) => (v.deliveryFrequency === 'Custom' ? (v.customWeekdays?.length ?? 0) > 0 : true),
    'Pick at least one weekday for custom delivery',
  );

export const CreateSubscriptionModificationRequestSchema = z
  .object({
    subscriptionId: z.string().min(1, 'Subscription is required'),
    productId: z.string().min(1, 'Product is required'),
    oldQuantityLitres: NonNegLitresSchema,
    newQuantityLitres: NonNegLitresSchema,
    effectiveFromDate: IsoDateYmdSchema,
    effectiveToDate: IsoDateYmdSchema,
    changeType: z.union([z.literal('Increase'), z.literal('Decrease'), z.literal('Pause')]),
    createdBy: z.union([z.literal('Customer'), z.literal('Admin')]),
  })
  .refine((v) => v.effectiveToDate >= v.effectiveFromDate, 'Effective end must be on or after start');

export const CreateSubscriptionAdditionalProductOrderRequestSchema = z
  .object({
    customerId: z.string().min(1, 'Customer is required'),
    productId: z.string().min(1, 'Product is required'),
    quantityLitresOrUnits: z.number().finite('Quantity must be valid').positive('Quantity must be greater than zero'),
    startDate: IsoDateYmdSchema,
    endDate: IsoDateYmdSchema.optional(),
    orderType: z.union([z.literal('OneTime'), z.literal('Temporary'), z.literal('Permanent')]),
    createdBy: z.union([z.literal('Customer'), z.literal('Admin')]),
  })
  .refine((v) => (v.endDate ? v.endDate >= v.startDate : true), 'End date must be on or after start date')
  .refine((v) => (v.orderType === 'Temporary' ? Boolean(v.endDate) : true), 'Temporary orders need an end date')
  .refine((v) => (v.orderType === 'OneTime' ? !v.endDate : true), 'One-time orders should omit end date');

export const EnsureDailyDeliveriesRequestSchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription is required'),
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
  customerId: z.string().min(1, 'Customer is required'),
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
  title: z.string().min(1, 'Title is required').max(120),
  body: z.string().min(1, 'Message is required').max(2000),
  relatedSubscriptionId: z.string().min(1).optional(),
  relatedDeliveryId: z.string().min(1).optional(),
});

export type CreateBaseMilkSubscriptionRequestInput = z.infer<typeof CreateBaseMilkSubscriptionRequestSchema>;
export type CreateSubscriptionModificationRequestInput = z.infer<typeof CreateSubscriptionModificationRequestSchema>;
export type CreateSubscriptionAdditionalProductOrderRequestInput = z.infer<typeof CreateSubscriptionAdditionalProductOrderRequestSchema>;
