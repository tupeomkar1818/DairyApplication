import type { DeliveryBoy } from '@/src/domain/deliveryBoys/entities';

// Depends on: deliveryBoys (entities)
export interface DeliveryBoyResponse extends DeliveryBoy {}

export interface DeliveryBoyListResponse {
  items: DeliveryBoyResponse[];
  total: number;
}

export interface CreateDeliveryBoyRequest {
  fullName: string;
  mobileNumber: string;
  joiningDate: string; // ISO
  primaryRouteName: string;
  additionalRouteName?: string;
  status?: DeliveryBoy['status'];
  backupDeliveryBoyId?: string;
  backupDeliveryBoyName?: string;
  appAccessEnabled?: boolean;

  salaryType?: DeliveryBoy['salaryType'];
  monthlySalary: number;
  perDaySalary?: number;

  totalPaidLeaves?: number;
  totalUnpaidLeaves?: number;

  replacementDeliveryBoyId?: string;
  replacementPerDaySalary?: number;
  replacementStartDate?: string; // ISO
  replacementEndDate?: string; // ISO (optional, not shown initially)

  // Advanced fields (editable later) remain optional
  alternateMobileNumber?: string;
  address?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  incentiveAmount?: number;
  bankDetails?: DeliveryBoy['bankDetails'];
  upiId?: string;
  assignedRoutes?: string[];
  shiftTiming?: DeliveryBoy['shiftTiming'];
  weeklyOffDay?: DeliveryBoy['weeklyOffDay'];
  emergencyContactName?: string;
  emergencyContactNumber?: string;

  photoUri?: string;
  extraRoutePaymentAmount?: number;
  replacementPaymentAmount?: number;
  paidLeaveAllowedPerMonth?: number;
  leaveSalaryRule?: 'Paid Leave' | 'Unpaid Leave' | 'Sick Leave';
  sickLeavePaid?: boolean;
  temporaryReplacementAllowed?: boolean;
}

export interface UpdateDeliveryBoyRequest {
  fullName?: string;
  mobileNumber?: string;
  joiningDate?: string; // ISO
  lastWorkingDate?: string; // ISO
  reasonForLeaving?: string;
  primaryRouteName?: string;
  additionalRouteName?: string;
  status?: DeliveryBoy['status'];
  backupDeliveryBoyId?: string;
  backupDeliveryBoyName?: string;
  appAccessEnabled?: boolean;

  salaryType?: DeliveryBoy['salaryType'];
  monthlySalary?: number;
  perDaySalary?: number;
  incentiveAmount?: number;
  pendingSalaryAmount?: number;
  salaryPaidStatus?: DeliveryBoy['salaryPaidStatus'];
  salaryPaidDate?: string; // ISO
  bankDetails?: DeliveryBoy['bankDetails'];
  upiId?: string;
  assignedRoutes?: string[];
  shiftTiming?: DeliveryBoy['shiftTiming'];
  weeklyOffDay?: DeliveryBoy['weeklyOffDay'];
  emergencyContactName?: string;
  emergencyContactNumber?: string;

  photoUri?: string;
  extraRoutePaymentAmount?: number;
  replacementPaymentAmount?: number;
  paidLeaveAllowedPerMonth?: number;
  leaveSalaryRule?: 'Paid Leave' | 'Unpaid Leave' | 'Sick Leave';
  sickLeavePaid?: boolean;
  temporaryReplacementAllowed?: boolean;

  totalPaidLeaves?: number;
  totalUnpaidLeaves?: number;

  replacementDeliveryBoyId?: string;
  replacementDeliveryBoyName?: string;
  replacementPerDaySalary?: number;
  replacementStartDate?: string; // ISO
  replacementEndDate?: string; // ISO

  currentAttendanceStatus?: DeliveryBoy['currentAttendanceStatus'];

  // Editable operational data (managed per tab)
  attendance?: DeliveryBoy['attendance'];
  leaves?: DeliveryBoy['leaves'];
  replacements?: DeliveryBoy['replacements'];
  routeCoverageCredits?: DeliveryBoy['routeCoverageCredits'];
  salaryHistory?: DeliveryBoy['salaryHistory'];
  complaints?: DeliveryBoy['complaints'];
  performance?: DeliveryBoy['performance'];
  audit?: DeliveryBoy['audit'];

  // Optional rollups
  totalWorkingDays?: number;
  totalAttendanceDays?: number;
  totalLeaveDays?: number;
  totalReplacementDays?: number;
  totalDeliveriesCompleted?: number;
  performanceRating?: number;

  // Advanced
  alternateMobileNumber?: string;
  address?: string;
  aadhaarNumber?: string;
  panNumber?: string;
}

