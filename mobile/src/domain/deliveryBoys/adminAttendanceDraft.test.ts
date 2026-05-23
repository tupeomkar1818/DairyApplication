import { describe, expect, it } from 'vitest';
import {
  DELIVERY_BOY_ADMIN_ATTENDANCE_STATUS_OPTIONS,
  DELIVERY_BOY_ATTENDANCE_ABSENT_LINKED_LEAVE_TYPE,
  deliveryBoyAdminAttendanceDraftFromStored,
} from '@/src/domain/deliveryBoys/enums';

describe('deliveryBoyAdminAttendanceDraftFromStored', () => {
  it('defaults new day to Present', () => {
    expect(deliveryBoyAdminAttendanceDraftFromStored(undefined)).toBe('Present');
    expect(deliveryBoyAdminAttendanceDraftFromStored(null)).toBe('Present');
  });

  it('maps present-like stored values to Present', () => {
    expect(deliveryBoyAdminAttendanceDraftFromStored('Present')).toBe('Present');
    expect(deliveryBoyAdminAttendanceDraftFromStored('Late Arrival')).toBe('Present');
    expect(deliveryBoyAdminAttendanceDraftFromStored('Half Day')).toBe('Present');
  });

  it('maps Absent and other statuses to Absent', () => {
    expect(deliveryBoyAdminAttendanceDraftFromStored('Absent')).toBe('Absent');
    expect(deliveryBoyAdminAttendanceDraftFromStored('Weekly Off')).toBe('Absent');
    expect(deliveryBoyAdminAttendanceDraftFromStored('On Leave')).toBe('Absent');
    expect(deliveryBoyAdminAttendanceDraftFromStored('Paid Leave')).toBe('Absent');
    expect(deliveryBoyAdminAttendanceDraftFromStored('Unpaid Leave')).toBe('Absent');
  });
});

describe('DELIVERY_BOY_ADMIN_ATTENDANCE_STATUS_OPTIONS', () => {
  it('is exactly Present and Absent', () => {
    expect([...DELIVERY_BOY_ADMIN_ATTENDANCE_STATUS_OPTIONS]).toEqual(['Present', 'Absent']);
  });
});

describe('DELIVERY_BOY_ATTENDANCE_ABSENT_LINKED_LEAVE_TYPE', () => {
  it('is unpaid leave for payroll alignment', () => {
    expect(DELIVERY_BOY_ATTENDANCE_ABSENT_LINKED_LEAVE_TYPE).toBe('Unpaid Leave');
  });
});
