import { z } from 'zod';

import { planStartEndMonthRuleIssues } from '@/src/domain/shared/planBoundaryDates';

const DeliveryFrequencySchema = z.union([
  z.literal('Daily'),
  z.literal('Alternate Day'),
  z.literal('Weekly'),
  z.literal('Specific Days'),
  z.literal('Weekend Only'),
  z.literal('Morning Only'),
  z.literal('Evening Only'),
  z.literal('Morning and Evening'),
]);

const SubscriptionStatusSchema = z.union([
  z.literal('Active'),
  z.literal('Paused'),
  z.literal('Expired'),
  z.literal('Cancelled'),
  z.literal('Inactive'),
]);

const SubscriptionProductAdditionTagSchema = z.union([
  z.literal('Regular'),
  z.literal('Temporary'),
  z.literal('Permanent'),
]);

const SubscriptionPaymentStatusSchema = z.union([
  z.literal('Paid'),
  z.literal('Pending'),
  z.literal('Partial'),
  z.literal('Advance Paid'),
]);

const DeliveryStatusSchema = z.union([z.literal('Delivered'), z.literal('Missed'), z.literal('Rescheduled')]);

const ComplaintStatusSchema = z.union([
  z.literal('Open'),
  z.literal('In Progress'),
  z.literal('Resolved'),
  z.literal('Closed'),
]);

const EntityBaseSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const CustomerPaymentSchema = EntityBaseSchema.extend({
  paymentDate: z.string().min(1),
  amountPaid: z.coerce.number().nonnegative(),
  paymentMode: z.union([z.literal('Cash'), z.literal('UPI'), z.literal('Bank'), z.literal('Other')]),
  transactionId: z.string().max(120).optional(),
  collectedBy: z.string().max(120).optional(),
  pendingBalanceAfter: z.coerce.number().optional(),
  notes: z.string().max(300).optional(),
});

export const CustomerComplaintSchema = EntityBaseSchema.extend({
  complaintDate: z.string().min(1),
  type: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  status: ComplaintStatusSchema,
  resolutionDate: z.string().optional(),
  resolvedBy: z.string().max(120).optional(),
});

export const CustomerComplaintActionKindSchema = z.union([z.literal('admin_note'), z.literal('status_change')]);

export const CustomerComplaintActionSchema = EntityBaseSchema.extend({
  complaintId: z.string().min(1),
  kind: CustomerComplaintActionKindSchema,
  message: z.string().min(1).max(500),
  nextStatus: ComplaintStatusSchema.optional(),
  createdBy: z.union([z.literal('Admin'), z.literal('Customer'), z.literal('System')]),
});

export const CustomerAuditEventSchema = EntityBaseSchema.extend({
  date: z.string().min(1),
  action: z.string().min(1).max(500),
  updatedBy: z.string().max(120).optional(),
  oldValue: z.string().max(500).optional(),
  newValue: z.string().max(500).optional(),
});

export const CustomerDeliveryRecordSchema = z.object({
  deliveryDate: z.string().min(1, 'Delivery date is required'),
  productName: z.string().min(1, 'Product is required').max(120),
  quantityLabel: z.string().min(1, 'Quantity is required').max(80),
  deliveryBoyName: z.string().max(120).optional(),
  status: DeliveryStatusSchema,
  missedReason: z.string().max(200).optional(),
  rescheduledDate: z.string().optional(),
  notes: z.string().max(300).optional(),
});

export const CustomerSubscriptionItemSchema = z.object({
  productName: z.string().min(1, 'Product is required').max(80),
  /** Includes combined forms like "2 x 500 ml" from plan rows */
  quantityLabel: z.string().min(1, 'Quantity is required').max(80),
});

export const CustomerSubscriptionPauseDetailsSchema = z.object({
  pauseStartDate: z.string().optional(),
  pauseEndDate: z.string().optional(),
  pauseReason: z.string().max(200).optional(),
  resumeDate: z.string().optional(),
  pauseStatus: z.string().max(80).optional(),
});

const CustomerSubscriptionPlanBaseSchema = z.object({
  productName: z.string().min(1, 'Product is required').max(80),
  numberOfItems: z.number().int().min(1).max(99).optional(),
  quantityLabel: z.string().min(1, 'Quantity is required').max(30),
  unitType: z.string().max(20).optional(),
  subscriptionKind: z.union([z.literal('Monthly'), z.literal('Daily')]).optional(),
  deliveryDate: z.string().optional(),
  deliveryTime: z.union([z.literal('Morning'), z.literal('Evening'), z.literal('Both')]),
  frequency: DeliveryFrequencySchema,
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  pauseStartDate: z.string().optional(),
  pauseEndDate: z.string().optional(),
  resumeDate: z.string().optional(),
  pauseReason: z.string().max(200).optional(),
  pauseStatus: z.string().max(80).optional(),
  productAdditionTag: SubscriptionProductAdditionTagSchema.optional(),
  notes: z.string().max(300).optional(),
  originalPrice: z.number().nonnegative().optional(),
  discountedPrice: z.number().nonnegative().optional(),
  effectiveFinalPrice: z.number().nonnegative().optional(),
  paymentStatus: SubscriptionPaymentStatusSchema.optional(),
  dailyCost: z.number().nonnegative().optional(),
  addedDate: z.string().optional(),
  status: SubscriptionStatusSchema,
});

export const CustomerSubscriptionPlanSchema = CustomerSubscriptionPlanBaseSchema.superRefine((data, ctx) => {
  for (const issue of planStartEndMonthRuleIssues(data.startDate, data.endDate)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue.message, path: [issue.path] });
  }
});

export const CreateCustomerRequestSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(80),
  mobile: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number'),
  dateOfBirth: z
    .string()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, 'DOB must be in DD/MM/YYYY format')
    .optional(),
  alternateMobile: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit alternate mobile number').optional(),
  appAccessEnabled: z.boolean().optional(),
  address: z.string().min(1, 'Address is required').max(160),
  societyName: z.string().min(1, 'Society / Building name is required').max(80),
  houseFlatNumber: z.string().max(40).optional(),
  streetArea: z.string().max(80).optional(),
  city: z.string().max(50).optional(),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode').optional(),
  landmark: z.string().max(80).optional(),
  routeName: z.string().max(60).optional(),
  assignedDeliveryBoyId: z.string().max(120).optional(),
  assignedDeliveryBoyName: z.string().max(80).optional(),
  deliveryTime: z.union([z.literal('Morning'), z.literal('Evening'), z.literal('Both')]),
  subscriptionStartDate: z.string().optional(),
  subscriptionEndDate: z.string().optional(),
  subscriptionStatus: SubscriptionStatusSchema.optional(),
  subscriptionKind: z.union([z.literal('Monthly'), z.literal('Daily')]).optional(),
  subscriptionPaymentStatus: SubscriptionPaymentStatusSchema.optional(),
  subscriptionPause: CustomerSubscriptionPauseDetailsSchema.optional(),
  subscriptionFrequency: DeliveryFrequencySchema.optional(),
  preferredDeliveryNotes: z.string().max(160).optional(),
  paymentType: z.union([z.literal('Cash'), z.literal('UPI'), z.literal('Monthly')]),
  billingType: z.union([z.literal('Monthly'), z.literal('Weekly'), z.literal('Prepaid'), z.literal('Postpaid')]).optional(),
  billingCycleDate: z.number().int().min(1).max(31).optional(),
  advanceBalance: z.number().nonnegative().optional(),
  securityDeposit: z.number().nonnegative().optional(),
  pendingAmount: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  taxPercentage: z.number().min(0).max(100).optional(),
  lastPaymentDate: z.string().optional(),
  nextDueDate: z.string().optional(),
  preferredPaymentMode: z.union([z.literal('Cash'), z.literal('UPI'), z.literal('Bank'), z.literal('Other')]).optional(),
  complaintNotes: z.string().max(200).optional(),
  internalAdminNotes: z.string().max(200).optional(),
  specialDeliveryInstructions: z.string().max(200).optional(),
  status: z.union([z.literal('Active'), z.literal('Inactive')]),
  subscription: z.array(CustomerSubscriptionItemSchema).min(1, 'Add at least one subscription product'),
  subscriptionPlans: z.array(CustomerSubscriptionPlanSchema).min(1, 'Add at least one subscription product').optional(),
});
export type CreateCustomerRequestInput = z.infer<typeof CreateCustomerRequestSchema>;

/**
 * PATCH payload fragment for admin subscription tab (plans + delivery metadata only).
 * Arrays may be empty so admins can clear plans; customer creation still uses CreateCustomerRequestSchema.min(1).
 */
export const CustomerSubscriptionFieldsUpdateSchema = z.object({
  deliveryTime: z.union([z.literal('Morning'), z.literal('Evening'), z.literal('Both')]),
  subscriptionStartDate: z.string().optional(),
  subscriptionEndDate: z.string().optional(),
  subscriptionStatus: SubscriptionStatusSchema.optional(),
  subscriptionFrequency: DeliveryFrequencySchema.optional(),
  preferredDeliveryNotes: z.string().max(160).optional(),
  subscription: z.array(CustomerSubscriptionItemSchema),
  subscriptionPlans: z.array(CustomerSubscriptionPlanSchema),
});
export type CustomerSubscriptionFieldsUpdateInput = z.infer<typeof CustomerSubscriptionFieldsUpdateSchema>;

export const UpdateCustomerRequestSchema = CreateCustomerRequestSchema.extend({
  deliveries: z.array(CustomerDeliveryRecordSchema).optional(),
  payments: z.array(CustomerPaymentSchema).optional(),
  complaints: z.array(CustomerComplaintSchema).optional(),
  complaintActions: z.array(CustomerComplaintActionSchema).optional(),
  audit: z.array(CustomerAuditEventSchema).optional(),
}).partial();
export type UpdateCustomerRequestInput = z.infer<typeof UpdateCustomerRequestSchema>;

export const SubscriptionCalendarEntryKindSchema = z.union([
  z.literal('base_online_catalog'),
  z.literal('subscription_line'),
  z.literal('add_on_product'),
]);

export const CustomerSubscriptionCalendarEntryDtoSchema = z.object({
  id: z.string().min(1),
  dateYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  kind: SubscriptionCalendarEntryKindSchema,
  title: z.string().min(1).max(120),
  subtitle: z.string().max(200).optional(),
});

export const AppendSubscriptionCalendarEntryRequestSchema = z.object({
  dateYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  kind: z.union([z.literal('subscription_line'), z.literal('add_on_product')]),
  title: z.string().min(1, 'Title is required').max(120),
  subtitle: z.string().max(200).optional(),
});

export type AppendSubscriptionCalendarEntryRequestInput = z.infer<typeof AppendSubscriptionCalendarEntryRequestSchema>;

export const CustomerDailyProductOrderLineDtoSchema = z.object({
  id: z.string().min(1),
  createdAtIso: z.string().optional(),
  dateYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  productName: z.string().min(1).max(120),
  quantityLabel: z.string().min(1).max(80),
  unitType: z.string().max(40).optional(),
  quantity: z.coerce.number().int().min(1).max(999),
});

export const UpsertCustomerDailyProductOrderLineRequestSchema = z.object({
  id: z.string().min(1).optional(),
  dateYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  productName: z.string().min(1).max(120),
  quantityLabel: z.string().min(1).max(80),
  unitType: z.string().max(40).optional(),
  quantity: z.coerce.number().int().min(1).max(999),
});

export type UpsertCustomerDailyProductOrderLineRequestInput = z.infer<typeof UpsertCustomerDailyProductOrderLineRequestSchema>;

export const CustomerBillingLedgerLineTypeSchema = z.union([z.literal('Subscription'), z.literal('Add-on')]);

export const CustomerBillingLedgerRowDtoSchema = z.object({
  id: z.string().min(1),
  dateYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  type: CustomerBillingLedgerLineTypeSchema,
  productName: z.string().min(1).max(120),
  packSizeLabel: z.string().min(1).max(120),
  quantity: z.coerce.number().int().min(1).max(999),
  pricePerDelivery: z.coerce.number().nonnegative(),
  deliveredLastDateYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  quantityDelivered: z.coerce.number().int().min(0).max(999),
  amount: z.coerce.number().nonnegative(),
});

export const CustomerSubscriptionPlanHistoryMemoKindSchema = z.literal('duplicate_milk_line_closed');

export const CustomerSubscriptionPlanHistoryMemoDtoSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  kind: CustomerSubscriptionPlanHistoryMemoKindSchema,
  message: z.string().min(1).max(500),
  closedLineProductName: z.string().min(1).max(120),
  closedLineEndBeforeDisplay: z.string().max(40),
  closedLineEndAfterDisplay: z.string().max(40),
  addedLineProductName: z.string().min(1).max(120),
});

export const AppendCustomerSubscriptionPlanHistoryMemoRequestSchema = z.object({
  kind: CustomerSubscriptionPlanHistoryMemoKindSchema,
  message: z.string().min(1).max(500),
  closedLineProductName: z.string().min(1).max(120),
  closedLineEndBeforeDisplay: z.string().max(40),
  closedLineEndAfterDisplay: z.string().max(40),
  addedLineProductName: z.string().min(1).max(120),
});

export type AppendCustomerSubscriptionPlanHistoryMemoRequestInput = z.infer<
  typeof AppendCustomerSubscriptionPlanHistoryMemoRequestSchema
>;

