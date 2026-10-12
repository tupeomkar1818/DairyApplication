import {
  deliveryFromRow,
  exceptionFromRow,
  extraOrderFromRow,
  paymentFromRow,
  paymentRequestFromRow,
  type DeliveryRow,
  type ExceptionRow,
  type ExtraOrderRow,
  type PaymentRequestRow,
  type PaymentRow,
  type Row,
} from '@/customers/operational';
import { boolToDb, dbToBool, detailsOf, parseJson } from '@/db';
import type { OfferClaim } from '@/offers/claims';

/**
 * Customers as the apps know them (`mobile/src/domain/customers/dtos.ts`) ↔ the `customers` and
 * `subscription_plans` rows. Columns are what the server queries by (mobile, route, status); everything else the
 * app sends rides in `details_json`.
 *
 * What a customer has *done* — the days delivered, the days they changed, one-off orders and the money — lives in
 * its own tables (`operational.ts`) and is read and written with the record, because that is how the apps hold it.
 */

export type Plan = Record<string, unknown> & { id?: string; productName: string; quantityLabel: string };

export type Customer = Record<string, unknown> & {
  id: string;
  name: string;
  mobile: string;
  subscriptionPlans?: Plan[];
  createdAt: string;
  updatedAt: string;
};

export type CustomerRow = {
  id: string;
  user_id: string | null;
  name: string;
  mobile: string;
  alternate_mobile: string | null;
  date_of_birth: string | null;
  flat_no: string;
  society_name: string;
  street: string;
  landmark: string | null;
  city: string;
  pincode: string;
  map_link: string | null;
  full_address: string;
  route_name: string;
  delivery_boy_id: string | null;
  delivery_time: string;
  billing_type: string;
  billing_cycle_date: number | null;
  discount_amount: number;
  app_access_enabled: number;
  status: string;
  subscription_start_date: string | null;
  notes: string | null;
  details_json: string;
  created_at: string;
  updated_at: string;
};

export type PlanRow = {
  id: string;
  customer_id: string;
  product_id: string | null;
  pack_id: string | null;
  product_name: string;
  pack_label: string;
  unit_type: string | null;
  number_of_items: number;
  frequency: string;
  delivery_time: string;
  start_date: string;
  end_date: string | null;
  open_ended: number;
  status: string;
  addition_tag: string;
  original_price: number;
  discounted_price: number;
  effective_price: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const CUSTOMER_COLUMN_KEYS = [
  'id',
  'name',
  'mobile',
  'alternateMobile',
  'dateOfBirth',
  'houseFlatNumber',
  'societyName',
  'streetArea',
  'landmark',
  'city',
  'pincode',
  'mapLink',
  'address',
  'routeName',
  'assignedDeliveryBoyId',
  'deliveryTime',
  'billingType',
  'billingCycleDate',
  'discountAmount',
  'appAccessEnabled',
  'status',
  'subscriptionStartDate',
  'subscriptionPlans',
  'createdAt',
  'updatedAt',
  // Kept in their own tables, never inside details_json.
  'deliveries',
  'extraOrders',
  'subscriptionExceptions',
  'payments',
  'paymentRequests',
  'offerClaims',
] as const;

export function planFromRow(row: PlanRow): Plan {
  return {
    id: row.id,
    productName: row.product_name,
    quantityLabel: row.pack_label,
    ...(row.product_id ? { productId: row.product_id } : {}),
    ...(row.pack_id ? { packId: row.pack_id } : {}),
    ...(row.unit_type ? { unitType: row.unit_type } : {}),
    numberOfItems: row.number_of_items,
    frequency: row.frequency,
    deliveryTime: row.delivery_time,
    startDate: row.start_date,
    ...(row.end_date ? { endDate: row.end_date } : {}),
    openEnded: dbToBool(row.open_ended),
    status: row.status,
    productAdditionTag: row.addition_tag,
    originalPrice: row.original_price,
    discountedPrice: row.discounted_price,
    effectiveFinalPrice: row.effective_price,
    ...(row.notes ? { notes: row.notes } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The rows behind a customer's days and money. */
export type CustomerHistory = {
  deliveries?: readonly DeliveryRow[];
  extraOrders?: readonly ExtraOrderRow[];
  exceptions?: readonly ExceptionRow[];
  payments?: readonly PaymentRow[];
  paymentRequests?: readonly PaymentRequestRow[];
  offerClaims?: readonly OfferClaim[];
};

export function customerFromRow(
  row: CustomerRow,
  planRows: readonly PlanRow[],
  deliveryBoyName?: string,
  history: CustomerHistory = {},
): Customer {
  const details = parseJson<Record<string, unknown>>(row.details_json, {});
  return {
    ...details,
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    ...(row.alternate_mobile ? { alternateMobile: row.alternate_mobile } : {}),
    ...(row.date_of_birth ? { dateOfBirth: row.date_of_birth } : {}),
    houseFlatNumber: row.flat_no,
    societyName: row.society_name,
    streetArea: row.street,
    ...(row.landmark ? { landmark: row.landmark } : {}),
    city: row.city,
    pincode: row.pincode,
    ...(row.map_link ? { mapLink: row.map_link } : {}),
    address: row.full_address,
    routeName: row.route_name,
    ...(row.delivery_boy_id ? { assignedDeliveryBoyId: row.delivery_boy_id } : {}),
    assignedDeliveryBoyName: deliveryBoyName ?? 'Unassigned',
    deliveryTime: row.delivery_time,
    billingType: row.billing_type,
    ...(row.billing_cycle_date == null ? {} : { billingCycleDate: row.billing_cycle_date }),
    discountAmount: row.discount_amount,
    appAccessEnabled: dbToBool(row.app_access_enabled),
    status: row.status,
    ...(row.subscription_start_date ? { subscriptionStartDate: row.subscription_start_date } : {}),
    subscriptionPlans: planRows.map(planFromRow),
    // Always present, so no screen has to guard against a missing list.
    subscription: (details.subscription as unknown[]) ?? [],
    deliveries: (history.deliveries ?? []).map(deliveryFromRow),
    extraOrders: (history.extraOrders ?? []).map(extraOrderFromRow),
    subscriptionExceptions: (history.exceptions ?? []).map(exceptionFromRow),
    payments: (history.payments ?? []).map(paymentFromRow),
    paymentRequests: (history.paymentRequests ?? []).map(paymentRequestFromRow),
    // The codes this customer has typed; only the server writes them (see offers/claims.ts).
    offerClaims: history.offerClaims ?? [],
    // Still carried inside the record: small, and nothing queries them yet.
    complaints: (details.complaints as Row[]) ?? [],
    complaintActions: (details.complaintActions as Row[]) ?? [],
    audit: (details.audit as Row[]) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function customerToRow(customer: Customer): Omit<CustomerRow, 'created_at' | 'updated_at' | 'user_id'> {
  return {
    id: customer.id,
    name: String(customer.name).trim(),
    mobile: String(customer.mobile).trim(),
    alternate_mobile: (customer.alternateMobile as string | undefined)?.trim() || null,
    date_of_birth: (customer.dateOfBirth as string | undefined) ?? null,
    flat_no: String(customer.houseFlatNumber ?? '').trim(),
    society_name: String(customer.societyName ?? '').trim(),
    street: String(customer.streetArea ?? '').trim(),
    landmark: (customer.landmark as string | undefined)?.trim() || null,
    city: String(customer.city ?? '').trim(),
    pincode: String(customer.pincode ?? '').trim(),
    map_link: (customer.mapLink as string | undefined) ?? null,
    full_address: String(customer.address ?? '').trim(),
    route_name: String(customer.routeName ?? '').trim(),
    delivery_boy_id: (customer.assignedDeliveryBoyId as string | undefined) || null,
    delivery_time: String(customer.deliveryTime ?? 'Morning'),
    billing_type: String(customer.billingType ?? 'Postpaid'),
    billing_cycle_date: customer.billingCycleDate == null ? null : Number(customer.billingCycleDate),
    discount_amount: Math.round(Number(customer.discountAmount ?? 0)) || 0,
    app_access_enabled: boolToDb(customer.appAccessEnabled as boolean | undefined, true),
    status: String(customer.status ?? 'Active'),
    subscription_start_date: (customer.subscriptionStartDate as string | undefined) ?? null,
    notes: (customer.internalAdminNotes as string | undefined) ?? null,
    details_json: JSON.stringify(detailsOf(customer, CUSTOMER_COLUMN_KEYS)),
  };
}

export function planToRow(customerId: string, plan: Plan, now: string): PlanRow {
  return {
    id: String(plan.id ?? ''),
    customer_id: customerId,
    product_id: (plan.productId as string | undefined) ?? null,
    pack_id: (plan.packId as string | undefined) ?? null,
    product_name: String(plan.productName ?? '').trim(),
    pack_label: String(plan.quantityLabel ?? '').trim(),
    unit_type: (plan.unitType as string | undefined) ?? null,
    number_of_items: Math.max(1, Math.round(Number(plan.numberOfItems ?? 1)) || 1),
    frequency: String(plan.frequency ?? 'Daily'),
    delivery_time: String(plan.deliveryTime ?? 'Morning'),
    start_date: String(plan.startDate ?? '').slice(0, 10),
    end_date: (plan.endDate as string | undefined)?.slice(0, 10) || null,
    open_ended: boolToDb(plan.openEnded as boolean | undefined, !plan.endDate),
    status: String(plan.status ?? 'Active'),
    addition_tag: String(plan.productAdditionTag ?? 'Regular'),
    original_price: Math.round(Number(plan.originalPrice ?? 0)) || 0,
    discounted_price: Math.round(Number(plan.discountedPrice ?? 0)) || 0,
    effective_price: Math.round(Number(plan.effectiveFinalPrice ?? plan.originalPrice ?? 0)) || 0,
    notes: (plan.notes as string | undefined) ?? null,
    created_at: String(plan.createdAt ?? now),
    updated_at: now,
  };
}
