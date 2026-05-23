import { z } from 'zod';

// Depends on: zod
export const CreateDeliveryBoyRequestSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(80),
  mobileNumber: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number'),
  joiningDate: z.string().min(1, 'Joining date is required'),
  primaryRouteName: z.string().min(1, 'Primary route is required').max(60),
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
  alternateMobileNumber: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit alternate mobile number').optional(),
  address: z.string().max(160).optional(),
  aadhaarNumber: z.string().regex(/^\d{12}$/, 'Enter a valid 12-digit Aadhaar number').optional(),
  panNumber: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]{1}$/, 'Enter a valid PAN number').optional(),
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
  emergencyContactNumber: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit emergency contact number').optional(),

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
  date: z.string().min(1, 'Date is required'),
  amount: z.number().positive('Advance amount must be greater than zero'),
  paymentMode: z.enum(['Cash', 'UPI', 'Bank Transfer', 'Card'], { message: 'Select a payment mode' }),
  transactionId: z.string().max(80).optional(),
  purpose: z.string().max(200).optional(),
});

export type CreateDeliveryBoyRequestInput = z.infer<typeof CreateDeliveryBoyRequestSchema>;
export type UpdateDeliveryBoyRequestInput = z.infer<typeof UpdateDeliveryBoyRequestSchema>;
export type DeliveryBoyAdvanceSalaryEntryInput = z.infer<typeof DeliveryBoyAdvanceSalaryEntrySchema>;

