import { boolToDb, dbToBool, detailsOf, newId, parseJson } from '@/db';

/**
 * Delivery boys as the apps know them (`mobile/src/domain/deliveryBoys/entities.ts`) ↔ the `delivery_boys` and
 * `attendance` rows.
 *
 * Attendance is a row per person per day, so it gets its own table — salary is worked out from it, and the dairy
 * must be able to see exactly which days it counted. Everything else the record carries (bank details, leave
 * rules, salary history, route cover credits, the change log) rides in `details_json`.
 */

export type Row = Record<string, unknown>;

export type DeliveryBoy = Row & { id: string; fullName: string; mobileNumber: string; createdAt: string; updatedAt: string };

export type DeliveryBoyRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  mobile: string;
  alternate_mobile: string | null;
  primary_route_name: string;
  additional_route_name: string | null;
  joining_date: string | null;
  last_working_date: string | null;
  status: string;
  salary_type: string;
  monthly_salary: number;
  per_day_salary: number;
  app_access_enabled: number;
  photo_key: string | null;
  details_json: string;
  created_at: string;
  updated_at: string;
};

export type AttendanceRow = {
  id: string;
  delivery_boy_id: string;
  ymd: string;
  status: string;
  cover_for_id: string | null;
  notes: string | null;
  remarks: string | null;
  marked_by: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMN_KEYS = [
  'id',
  'fullName',
  'mobileNumber',
  'alternateMobileNumber',
  'primaryRouteName',
  'additionalRouteName',
  'joiningDate',
  'lastWorkingDate',
  'status',
  'salaryType',
  'monthlySalary',
  'perDaySalary',
  'appAccessEnabled',
  'photoUri',
  'attendance',
  'createdAt',
  'updatedAt',
] as const;

/** Personal details a colleague has no business reading (the dairy sees everything). */
const PRIVATE_KEYS = [
  'salaryType',
  'monthlySalary',
  'perDaySalary',
  'bankDetails',
  'upiId',
  'aadhaarNumber',
  'panNumber',
  'address',
  'emergencyContactName',
  'emergencyContactNumber',
  'audit',
  'complaints',
] as const;

export function attendanceToRow(boyId: string, record: Row, now: string): AttendanceRow {
  return {
    id: String(record.id ?? '') || newId('att'),
    delivery_boy_id: boyId,
    ymd: String(record.date ?? record.ymd ?? '').slice(0, 10),
    status: String(record.status ?? 'Present'),
    cover_for_id: (record.coverForDeliveryBoyId as string | undefined) ?? null,
    notes: (record.notes as string | undefined) ?? null,
    remarks: (record.remarks as string | undefined) ?? null,
    marked_by: (record.markedBy as string | undefined) ?? null,
    created_at: String(record.createdAt ?? now),
    updated_at: now,
  };
}

export function attendanceFromRow(row: AttendanceRow, extra: Row = {}): Row {
  return {
    ...extra,
    id: row.id,
    date: row.ymd,
    status: row.status,
    ...(row.cover_for_id ? { coverForDeliveryBoyId: row.cover_for_id } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.remarks ? { remarks: row.remarks } : {}),
    ...(row.marked_by ? { markedBy: row.marked_by } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function deliveryBoyFromRow(row: DeliveryBoyRow, attendance: readonly AttendanceRow[] = []): DeliveryBoy {
  const details = parseJson<Row>(row.details_json, {});
  // Anything the attendance table does not have a column for was kept beside it, keyed by the row's id.
  const attendanceExtras = parseJson<Record<string, Row>>(String(details.attendanceExtras ?? ''), {});
  delete details.attendanceExtras;
  return {
    ...details,
    id: row.id,
    fullName: row.full_name,
    mobileNumber: row.mobile,
    ...(row.alternate_mobile ? { alternateMobileNumber: row.alternate_mobile } : {}),
    primaryRouteName: row.primary_route_name,
    ...(row.additional_route_name ? { additionalRouteName: row.additional_route_name } : {}),
    ...(row.joining_date ? { joiningDate: row.joining_date } : {}),
    ...(row.last_working_date ? { lastWorkingDate: row.last_working_date } : {}),
    status: row.status,
    salaryType: row.salary_type,
    monthlySalary: row.monthly_salary,
    perDaySalary: row.per_day_salary,
    appAccessEnabled: dbToBool(row.app_access_enabled),
    ...(row.photo_key ? { photoUri: row.photo_key } : {}),
    attendance: attendance.map((a) => attendanceFromRow(a, attendanceExtras[a.id] ?? {})),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as DeliveryBoy;
}

export function deliveryBoyToRow(boy: DeliveryBoy): Omit<DeliveryBoyRow, 'created_at' | 'updated_at' | 'user_id'> {
  // Attendance fields with no column keep their place beside the record, so nothing a screen sends is lost.
  const attendanceExtras: Record<string, Row> = {};
  for (const entry of (boy.attendance as Row[] | undefined) ?? []) {
    const rest = detailsOf(entry, ['id', 'date', 'ymd', 'status', 'coverForDeliveryBoyId', 'notes', 'remarks', 'markedBy', 'createdAt', 'updatedAt']);
    if (Object.keys(rest).length && entry.id) attendanceExtras[String(entry.id)] = rest;
  }
  const details = detailsOf(boy, COLUMN_KEYS);
  if (Object.keys(attendanceExtras).length) details.attendanceExtras = JSON.stringify(attendanceExtras);

  return {
    id: boy.id,
    full_name: String(boy.fullName ?? '').trim(),
    mobile: String(boy.mobileNumber ?? '').trim(),
    alternate_mobile: (boy.alternateMobileNumber as string | undefined)?.trim() || null,
    primary_route_name: String(boy.primaryRouteName ?? '').trim(),
    additional_route_name: (boy.additionalRouteName as string | undefined)?.trim() || null,
    joining_date: ((boy.joiningDate as string | undefined) ?? null)?.slice(0, 10) ?? null,
    last_working_date: ((boy.lastWorkingDate as string | undefined) ?? null)?.slice(0, 10) ?? null,
    status: String(boy.status ?? 'Active'),
    salary_type: String(boy.salaryType ?? 'Fixed Monthly Salary'),
    monthly_salary: Math.round(Number(boy.monthlySalary ?? 0)) || 0,
    per_day_salary: Math.round(Number(boy.perDaySalary ?? 0)) || 0,
    app_access_enabled: boolToDb(boy.appAccessEnabled as boolean | undefined, true),
    photo_key: (boy.photoUri as string | undefined) ?? null,
    details_json: JSON.stringify(details),
  };
}

/** The record as a colleague may see it: enough to plan a route and price a cover day, nothing personal. */
export function withoutPrivateDetails(boy: DeliveryBoy): DeliveryBoy {
  const shared = { ...boy };
  for (const key of PRIVATE_KEYS) delete shared[key];
  return shared;
}
