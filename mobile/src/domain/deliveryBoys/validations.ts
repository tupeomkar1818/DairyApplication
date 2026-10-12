import { z } from 'zod';

import { strings } from '@/src/i18n/strings';

// Depends on: zod
export const CreateDeliveryBoyRequestSchema = z.object({
  fullName: z.string().min(1, { error: () => strings('deliveryBoys').errors.fullNameRequired }).max(80),
  mobileNumber: z.string().regex(/^\d{10}$/, { error: () => strings('deliveryBoys').errors.mobileInvalid }),
  joiningDate: z.string().min(1, { error: () => strings('deliveryBoys').errors.joiningDateRequired }),
  primaryRouteName: z.string().min(1, { error: () => strings('deliveryBoys').errors.primaryRouteRequired }).max(60),
  monthlySalary: z.number().nonnegative(),

  // Optional onboarding / managed later from dashboard
  additionalRouteName: z.string().max(60).optional(),
  status: z.union([z.literal('Active'), z.literal('Inactive')]).optional(),
  backupDeliveryBoyId: z.string().max(80).optional(),
  backupDeliveryBoyName: z.string().max(80).optional(),
  appAccessEnabled: z.boolean().optional(),

  salaryType: z.union([z.literal('Fixed Monthly Salary'), z.literal('Attendance Based Salary')]).optional(),
  perDaySalary: z.number().nonnegative().optional(),
  incentiveAmount: z.number().nonnegative().optional(),
  pendingSalaryAmount: z.number().nonnegative().optional(),
  salaryPaidStatus: z.union([z.literal('Paid'), z.literal('Unpaid'), z.literal('Partial')]).optional(),
  salaryPaidDate: z.string().optional(),

  totalPaidLeaves: z.number().int().min(0).max(365).optional(),
  totalUnpaidLeaves: z.number().int().min(0).max(365).optional(),

  replacementDeliveryBoyId: z.string().max(80).optional(),
  replacementPerDaySalary: z.number().nonnegative().optional(),
  replacementStartDate: z.string().optional(),
  replacementEndDate: z.string().optional(),

  // Advanced fields (editable later)
  alternateMobileNumber: z.string().regex(/^\d{10}$/, { error: () => strings('deliveryBoys').errors.alternateMobileInvalid }).optional(),
  address: z.string().max(160).optional(),
  aadhaarNumber: z.string().regex(/^\d{12}$/, { error: () => strings('deliveryBoys').errors.aadhaarInvalid }).optional(),
  panNumber: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]{1}$/, { error: () => strings('deliveryBoys').errors.panInvalid }).optional(),
  // incentiveAmount moved above (salary section)
  bankDetails: z
    .object({
      bankName: z.string().max(80).optional(),
      accountHolderName: z.string().max(80).optional(),
      accountNumber: z.string().max(30).optional(),
      ifscCode: z.string().max(20).optional(),
    })
    .optional(),
  upiId: z.string().max(80).optional(),
  assignedRoutes: z.array(z.string().min(1).max(60)).optional(),
  shiftTiming: z.union([z.literal('Morning'), z.literal('Evening'), z.literal('Both')]).optional(),
  weeklyOffDay: z
    .union([
      z.literal('Monday'),
      z.literal('Tuesday'),
      z.literal('Wednesday'),
      z.literal('Thursday'),
      z.literal('Friday'),
      z.literal('Saturday'),
      z.literal('Sunday'),
    ])
    .optional(),
  emergencyContactName: z.string().max(80).optional(),
  emergencyContactNumber: z.string().regex(/^\d{10}$/, { error: () => strings('deliveryBoys').errors.emergencyNumberInvalid }).optional(),

  photoUri: z.string().max(500).optional(),
  extraRoutePaymentAmount: z.number().nonnegative().optional(),
  replacementPaymentAmount: z.number().nonnegative().optional(),
  paidLeaveAllowedPerMonth: z.number().int().min(0).max(31).optional(),
  leaveSalaryRule: z.enum(['Paid Leave', 'Unpaid Leave', 'Sick Leave']).optional(),
  sickLeavePaid: z.boolean().optional(),
  temporaryReplacementAllowed: z.boolean().optional(),
});

export const UpdateDeliveryBoyRequestSchema = CreateDeliveryBoyRequestSchema.partial();

/** Advance salary line item (month ledger) — ids/timestamps added by service/UI on save. */
export const DeliveryBoyAdvanceSalaryEntrySchema = z.object({
  date: z.string().min(1, { error: () => strings('deliveryBoys').errors.dateRequired }),
  amount: z.number().positive({ error: () => strings('deliveryBoys').errors.advanceAmountPositive }),
  paymentMode: z.enum(['Cash', 'UPI', 'Bank Transfer', 'Card'], { error: () => strings('deliveryBoys').errors.paymentModeRequired }),
  transactionId: z.string().max(80).optional(),
  purpose: z.string().max(200).optional(),
});

export type CreateDeliveryBoyRequestInput = z.infer<typeof CreateDeliveryBoyRequestSchema>;
export type UpdateDeliveryBoyRequestInput = z.infer<typeof UpdateDeliveryBoyRequestSchema>;
export type DeliveryBoyAdvanceSalaryEntryInput = z.infer<typeof DeliveryBoyAdvanceSalaryEntrySchema>;

