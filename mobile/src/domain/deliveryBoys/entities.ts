import type { EntityBase } from '@/src/domain/shared/types';
import type {
  ApprovalStatus,
  AttendanceStatus,
  LeaveSalaryRule,
  LeaveType,
  ReplacementAssignmentStatus,
  ReplacementReason,
  ReplacementWorkerType,
  SalaryPaymentMode,
  SalaryPaymentStatus,
  SalaryType,
  ShiftTiming,
  Weekday,
} from '@/src/domain/deliveryBoys/enums';

// Depends on: shared (types)
export interface DeliveryBoyBankDetails {
  bankName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
}

export interface DeliveryBoyAttendanceHistoryEntry extends EntityBase {
  /** When the change was made (ISO) */
  date: string;
  updatedBy: 'Admin' | 'System';
  action: 'Created' | 'Status Updated' | 'Deleted';
  fromStatus?: AttendanceStatus;
  toStatus?: AttendanceStatus;
  note?: string;
}

export interface DeliveryBoyAttendanceEntry extends EntityBase {
  /** ISO date for the day (yyyy-mm-dd or full ISO) */
  date: string;
  checkInTime?: string; // ISO
  checkOutTime?: string; // ISO
  totalWorkingHours?: number;
  overtimeHours?: number;
  attendanceStatus: AttendanceStatus;
  leaveStatus?: AttendanceStatus; // if day is leave-related, same enum used
  notes?: string;
  remarks?: string;
  /** Admin changed status away from auto QR-derived value */
  adminManualOverride?: boolean;
  /** When set, this boy performed route work covering an absent colleague; salary credit uses leaver's per-day rate (deduped with routeCoverageCredits). */
  coverForDeliveryBoyId?: string;
  coverForDeliveryBoyName?: string;
  routeName?: string;
  /** Extra routes same calendar day — earnings added in salary (one Present day, multiple routes). */
  extraRouteEarningsForDay?: number;
  /** History of admin/system updates for this attendance day */
  history?: DeliveryBoyAttendanceHistoryEntry[];
}

export interface DeliveryBoyLeaveRequest extends EntityBase {
  leaveStartDate: string; // ISO
  leaveEndDate: string; // ISO
  leaveType: LeaveType;
  reason?: string;
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  replacementDeliveryBoyId?: string;
  replacementDeliveryBoyName?: string;
  /** Auto / admin note: Paid | Unpaid impact copy */
  salaryImpact?: string;
  replacementRequired?: boolean;
  /** When set, this leave row was created or tied to marking attendance Absent for this calendar day (yyyy-mm-dd). */
  linkedAttendanceDate?: string;
}

export interface DeliveryBoyReplacementHistoryEntry extends EntityBase {
  reason: ReplacementReason;
  fromDate: string; // ISO
  toDate?: string; // ISO
  routes: string[];
  replacedByDeliveryBoyId: string;
  replacedByDeliveryBoyName: string;
  notes?: string;
  replacementWorkerType?: ReplacementWorkerType;
  /** Extra payment line (existing boy) or temp worker fee */
  extraPayment?: number;
  salaryDeductedFromOriginal?: number;
  salaryCreditedToReplacement?: number;
  /** Booked under original boy's payroll when Temporary */
  temporaryReplacementExpense?: number;
  assignmentStatus?: ReplacementAssignmentStatus;
  /**
   * When true, the replacer should receive route coverage credits for days in this window (merged on their profile).
   * Days already covered by the leaver's approved Unpaid Leave use the same per-day amount; deduped by date + leaver.
   */
  transferSalaryToReplacer?: boolean;
  /** When set, this replacement was created from attendance Absent for this calendar day (yyyy-mm-dd). */
  linkedAttendanceDate?: string;
}

/** Per-day route work performed for another boy (unpaid leave / replacement); replacer is paid leaver's per-day for that date. */
export interface DeliveryBoyRouteCoverageCredit extends EntityBase {
  date: string; // yyyy-mm-dd
  routeName: string;
  leaverDeliveryBoyId: string;
  leaverDeliveryBoyName?: string;
  sourceLeaveId?: string;
  sourceReplacementId?: string;
  notes?: string;
}

/** Month-wise advance salary ledger (separate from final salary settlement payments). */
export interface DeliveryBoyAdvanceSalaryEntry extends EntityBase {
  /** ISO date (yyyy-mm-dd or full ISO) */
  date: string;
  amount: number;
  paymentMode: SalaryPaymentMode;
  transactionId?: string;
  purpose?: string;
}

export interface DeliveryBoySalaryRecord extends EntityBase {
  /** Salary month in YYYY-MM format */
  salaryMonth: string;
  salaryType: SalaryType;
  baseSalary: number;
  incentiveAmount?: number;
  /** Admin-managed bonus for the month */
  bonusAmount?: number;
  /** Admin-managed manual deduction for the month */
  deductionAmount?: number;
  /** Previous pending salary carried into this month */
  previousPendingSalary?: number;
  /** Previous overpayment carried into this month (reduces payable) */
  previousOverpayment?: number;
  /** Admin override for final salary (optional) */
  finalSalaryOverride?: number;
  attendanceBonus?: number;
  overtimePay?: number;
  deliveryIncentive?: number;
  leaveDeduction?: number;
  penaltyDeduction?: number;
  advanceTaken?: number;
  /** Multiple advance payments for this salary month (not counted as final salary paid). */
  advanceSalaryEntries?: DeliveryBoyAdvanceSalaryEntry[];
  finalSalary: number;
  /** Amount paid toward final salary settlement only (excludes advance salary). */
  paidAmount?: number;
  pendingAmount?: number;
  totalWorkingDays?: number;
  overtimeHours?: number;
  totalDeliveries?: number;
  deductionsTotal?: number;
  paymentDate?: string; // ISO
  paymentMode?: SalaryPaymentMode;
  transactionId?: string;
  paymentStatus: SalaryPaymentStatus;
  /** Auto = derive from settlement math; Manual = use `manualPaymentStatus` for display / profile label. */
  paymentStatusSource?: 'Auto' | 'Manual';
  manualPaymentStatus?: SalaryPaymentStatus;
  /** Final salary settlement payment lines only (not advance salary). */
  payments?: DeliveryBoySalaryPaymentEntry[];
  notes?: string;
}

export interface DeliveryBoySalaryPaymentEntry extends EntityBase {
  /** ISO date for payment (yyyy-mm-dd or full ISO) */
  date: string;
  amountPaid: number;
  /** Legacy rows only; new advances use `advanceSalaryEntries` on the month record. */
  kind?: 'Salary' | 'Advance';
  paymentMode: SalaryPaymentMode;
  transactionId?: string;
  /** Optional note/purpose (commonly used for advance salary reason). */
  purpose?: string;
  remainingPendingAmount: number;
  status: SalaryPaymentStatus;
}

export interface DeliveryBoyComplaintRecord extends EntityBase {
  complaintType: string;
  date: string; // ISO
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  resolution?: string;
  raisedBy?: string;
}

export interface DeliveryBoyAuditEntry extends EntityBase {
  date: string; // ISO
  action: string;
  updatedBy: 'Admin' | 'Delivery' | 'System';
  oldValue?: string;
  newValue?: string;
}

export interface DeliveryBoyPerformanceSnapshot extends EntityBase {
  /** Month in YYYY-MM */
  month: string;
  totalDeliveriesCompleted: number;
  missedDeliveries: number;
  lateDeliveries: number;
  extraDeliveries: number;
  customerRatingAvg?: number;
  routeEfficiencyPct?: number;
  deliveryCompletionPct?: number;
}

export interface DeliveryBoy extends EntityBase {
  fullName: string;
  mobileNumber: string;
  alternateMobileNumber?: string;

  /** Profile photo (local URI mock or future CDN URL) */
  photoUri?: string;

  address?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  joiningDate: string; // ISO
  /** End date / last working date (optional) */
  lastWorkingDate?: string; // ISO
  reasonForLeaving?: string;

  salaryType: SalaryType;
  /** Monthly base salary (used when salaryType=Monthly) */
  monthlySalary: number;
  /** Optional explicit per-day salary; can be derived from monthlySalary */
  perDaySalary?: number;
  /** Default extra route payment per assignment (attendance can override per day). */
  extraRoutePaymentAmount?: number;
  /** Default payment for temporary replacement context */
  replacementPaymentAmount?: number;
  paidLeaveAllowedPerMonth?: number;
  leaveSalaryRule?: LeaveSalaryRule;
  /** Sick leave pays as paid if true; else unpaid (when leaveSalaryRule is Sick-focused). */
  sickLeavePaid?: boolean;
  temporaryReplacementAllowed?: boolean;
  incentiveAmount?: number;
  pendingSalaryAmount?: number;
  salaryPaidStatus?: 'Paid' | 'Unpaid' | 'Partial';
  salaryPaidDate?: string; // ISO
  bankDetails?: DeliveryBoyBankDetails;
  upiId?: string;

  assignedRoutes: string[];
  primaryRouteName: string;
  additionalRouteName?: string;
  shiftTiming: ShiftTiming;
  weeklyOffDay: Weekday;
  emergencyContactName?: string;
  emergencyContactNumber?: string;

  status: 'Active' | 'Inactive';
  appAccessEnabled: boolean;
  backupDeliveryBoyId?: string;
  backupDeliveryBoyName?: string;

  /** Derived/quick status shown in list cards */
  currentAttendanceStatus?: AttendanceStatus;

  /** Simple onboarding counters (advanced tracking can compute later) */
  totalPaidLeaves?: number;
  totalUnpaidLeaves?: number;

  /** Current replacement assignment (optional) */
  replacementDeliveryBoyId?: string;
  replacementDeliveryBoyName?: string;
  replacementPerDaySalary?: number;
  replacementStartDate?: string; // ISO
  replacementEndDate?: string; // ISO (optional, not shown initially)

  /** Optional rollups (can be computed, but stored for quick UI) */
  totalWorkingDays?: number;
  totalAttendanceDays?: number;
  totalLeaveDays?: number;
  totalReplacementDays?: number;
  totalDeliveriesCompleted?: number;
  performanceRating?: number;

  attendance: DeliveryBoyAttendanceEntry[];
  leaves: DeliveryBoyLeaveRequest[];
  replacements: DeliveryBoyReplacementHistoryEntry[];
  /** Salary credits when this boy covered another's route (unpaid leave / replacement / attendance cover). */
  routeCoverageCredits?: DeliveryBoyRouteCoverageCredit[];
  salaryHistory: DeliveryBoySalaryRecord[];
  performance: DeliveryBoyPerformanceSnapshot[];
  complaints: DeliveryBoyComplaintRecord[];
  audit: DeliveryBoyAuditEntry[];
}

