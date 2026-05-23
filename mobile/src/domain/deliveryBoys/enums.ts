// Module enums for Delivery module

export type DeliveryBoyStatus = 'Active' | 'Inactive';
export type AttendanceStatus =
  | 'Present'
  | 'Half Day'
  | 'Absent'
  | 'Weekly Off'
  | 'Paid Leave'
  | 'Unpaid Leave'
  | 'Late Arrival'
  /** Treated as on leave; Leave tab should align */
  | 'On Leave';

/** Admin delivery-boy calendar: only these may be chosen (stored rows may still hold legacy AttendanceStatus values). */
export const DELIVERY_BOY_ADMIN_ATTENDANCE_STATUS_OPTIONS = ['Present', 'Absent'] as const satisfies readonly AttendanceStatus[];
export type DeliveryBoyAdminAttendanceStatus = (typeof DELIVERY_BOY_ADMIN_ATTENDANCE_STATUS_OPTIONS)[number];

/** Maps stored status to the binary admin picker default (new day → Present). */
export function deliveryBoyAdminAttendanceDraftFromStored(
  status: AttendanceStatus | undefined | null,
): DeliveryBoyAdminAttendanceStatus {
  if (status == null) return 'Present';
  if (status === 'Present' || status === 'Late Arrival' || status === 'Half Day') return 'Present';
  if (status === 'Absent') return 'Absent';
  return 'Absent';
}

export type LeaveType = 'Sick Leave' | 'Casual Leave' | 'Paid Leave' | 'Unpaid Leave' | 'Emergency' | 'Emergency Leave' | 'Other';

/** Stored on the auto leave row when admin marks attendance Absent (no leave-type field in that UI). */
export const DELIVERY_BOY_ATTENDANCE_ABSENT_LINKED_LEAVE_TYPE = 'Unpaid Leave' as const satisfies LeaveType;

/** Default policy for sick leave pay (admin-configurable per boy). */
export type LeaveSalaryRule = 'Paid Leave' | 'Unpaid Leave' | 'Sick Leave';

export type ReplacementWorkerType = 'Existing Delivery Boy' | 'Temporary Delivery Boy';
export type ReplacementAssignmentStatus = 'Assigned' | 'Completed' | 'Cancelled';
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export type SalaryType = 'Fixed Monthly Salary' | 'Attendance Based Salary';
export type SalaryPaymentStatus = 'Paid' | 'Unpaid' | 'Partial';
export type SalaryPaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Card';

export type ShiftTiming = 'Morning' | 'Evening' | 'Both';
export type Weekday = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export type ReplacementReason = 'Leave' | 'Absent' | 'Resignation' | 'Other';

