import { dbToBool, newId, parseJson } from '@/db';

/**
 * What a customer has *done*: the days delivered or missed, the days they changed, the one-off orders, and the
 * money. These are what every bill is built from, so each lives in its own table rather than inside the customer
 * record — a bill can then be traced back to the exact rows behind it.
 *
 * The apps keep them as arrays on the customer (`mobile/src/domain/customers/entities.ts`), and that is how they
 * travel: the whole array is sent and the whole array comes back, the same way the on-phone version works.
 */

export type Row = Record<string, unknown>;

export type DeliveryRow = {
  id: string;
  customer_id: string;
  delivery_ymd: string;
  product_name: string;
  pack_label: string;
  status: string;
  subscription_items: number | null;
  missed_reason: string | null;
  marked_by: string | null;
  delivery_boy_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ExtraOrderRow = {
  id: string;
  customer_id: string;
  delivery_ymd: string;
  product_name: string;
  pack_label: string;
  pack_id: string | null;
  number_of_items: number;
  price: number;
  status: string;
  offer_id: string | null;
  offer_title_en: string | null;
  offer_title_mr: string | null;
  offer_list_price: number | null;
  combo_items_json: string | null;
  placed_by: string;
  created_at: string;
  updated_at: string;
};

export type ExceptionRow = {
  id: string;
  customer_id: string;
  plan_id: string | null;
  kind: string;
  from_ymd: string;
  to_ymd: string;
  number_of_items: number | null;
  reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type PaymentRow = {
  id: string;
  customer_id: string;
  payment_date: string;
  amount: number;
  mode: string;
  transaction_id: string | null;
  collected_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentRequestRow = {
  id: string;
  customer_id: string;
  amount: number;
  method: string;
  reference: string | null;
  paid_on_ymd: string;
  note: string | null;
  status: string;
  payment_id: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

const ymd = (value: unknown): string => String(value ?? '').slice(0, 10);
const text = (value: unknown): string | null => {
  const s = String(value ?? '').trim();
  return s ? s : null;
};
const money = (value: unknown): number => Math.round(Number(value) || 0);

export function deliveryToRow(customerId: string, record: Row, now: string): DeliveryRow {
  return {
    id: String(record.id ?? '') || newId('del'),
    customer_id: customerId,
    delivery_ymd: ymd(record.deliveryDate),
    product_name: String(record.productName ?? ''),
    pack_label: String(record.quantityLabel ?? ''),
    status: String(record.status ?? 'Delivered'),
    subscription_items: record.subscriptionItems == null ? null : Math.round(Number(record.subscriptionItems)),
    missed_reason: text(record.missedReason),
    marked_by: text(record.markedBy ?? record.signedBy),
    delivery_boy_id: text(record.deliveryBoyId),
    created_at: String(record.createdAt ?? now),
    updated_at: now,
  };
}

export function deliveryFromRow(row: DeliveryRow): Row {
  return {
    id: row.id,
    deliveryDate: row.delivery_ymd,
    productName: row.product_name,
    quantityLabel: row.pack_label,
    status: row.status,
    ...(row.subscription_items == null ? {} : { subscriptionItems: row.subscription_items }),
    ...(row.missed_reason ? { missedReason: row.missed_reason } : {}),
    ...(row.marked_by ? { markedBy: row.marked_by } : {}),
    ...(row.delivery_boy_id ? { deliveryBoyId: row.delivery_boy_id } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function extraOrderToRow(customerId: string, record: Row, now: string): ExtraOrderRow {
  const offer = (record.offer ?? null) as { offerId?: string; title?: { en?: string; mr?: string }; listPrice?: number } | null;
  return {
    id: String(record.id ?? '') || newId('extra'),
    customer_id: customerId,
    delivery_ymd: ymd(record.deliveryDate || record.orderDate),
    product_name: String(record.productName ?? ''),
    pack_label: String(record.quantityLabel ?? ''),
    pack_id: text(record.packId),
    number_of_items: Math.max(1, Math.round(Number(record.numberOfItems ?? 1)) || 1),
    price: money(record.price),
    status: String(record.status ?? 'Pending'),
    offer_id: offer?.offerId ?? null,
    offer_title_en: offer?.title?.en ?? null,
    offer_title_mr: offer?.title?.mr ?? null,
    offer_list_price: offer?.listPrice == null ? null : money(offer.listPrice),
    combo_items_json: Array.isArray(record.comboItems) ? JSON.stringify(record.comboItems) : null,
    placed_by: String(record.placedBy ?? 'customer'),
    created_at: String(record.createdAt ?? now),
    updated_at: now,
  };
}

export function extraOrderFromRow(row: ExtraOrderRow): Row {
  return {
    id: row.id,
    orderDate: row.delivery_ymd,
    deliveryDate: row.delivery_ymd,
    productName: row.product_name,
    quantityLabel: row.pack_label,
    ...(row.pack_id ? { packId: row.pack_id } : {}),
    numberOfItems: row.number_of_items,
    price: row.price,
    status: row.status,
    ...(row.offer_id
      ? {
          offer: {
            offerId: row.offer_id,
            kind: row.combo_items_json ? 'combo' : 'price',
            title: { en: row.offer_title_en ?? '', ...(row.offer_title_mr ? { mr: row.offer_title_mr } : {}) },
            listPrice: row.offer_list_price ?? row.price,
          },
        }
      : {}),
    ...(row.combo_items_json ? { comboItems: parseJson<unknown[]>(row.combo_items_json, []) } : {}),
    placedBy: row.placed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function exceptionToRow(customerId: string, record: Row, now: string): ExceptionRow {
  return {
    id: String(record.id ?? '') || newId('exc'),
    customer_id: customerId,
    plan_id: text(record.planId),
    // Rows written before day-quantity changes existed carry no kind and are skips.
    kind: record.kind === 'quantity' ? 'quantity' : 'skip',
    from_ymd: ymd(record.fromYmd),
    to_ymd: ymd(record.toYmd || record.fromYmd),
    number_of_items: record.numberOfItems == null ? null : Math.round(Number(record.numberOfItems)),
    reason: text(record.reason),
    created_by: String(record.createdBy ?? 'customer'),
    created_at: String(record.createdAt ?? now),
    updated_at: now,
  };
}

export function exceptionFromRow(row: ExceptionRow): Row {
  return {
    id: row.id,
    kind: row.kind,
    fromYmd: row.from_ymd,
    toYmd: row.to_ymd,
    ...(row.plan_id ? { planId: row.plan_id } : {}),
    ...(row.number_of_items == null ? {} : { numberOfItems: row.number_of_items }),
    ...(row.reason ? { reason: row.reason } : {}),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function paymentToRow(customerId: string, record: Row, now: string): PaymentRow {
  return {
    id: String(record.id ?? '') || newId('pay'),
    customer_id: customerId,
    payment_date: String(record.paymentDate ?? now),
    amount: money(record.amountPaid),
    mode: String(record.paymentMode ?? 'Cash'),
    transaction_id: text(record.transactionId),
    collected_by: text(record.collectedBy),
    notes: text(record.notes),
    created_at: String(record.createdAt ?? now),
    updated_at: now,
  };
}

export function paymentFromRow(row: PaymentRow): Row {
  return {
    id: row.id,
    paymentDate: row.payment_date,
    amountPaid: row.amount,
    paymentMode: row.mode,
    ...(row.transaction_id ? { transactionId: row.transaction_id } : {}),
    ...(row.collected_by ? { collectedBy: row.collected_by } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function paymentRequestToRow(customerId: string, record: Row, now: string): PaymentRequestRow {
  return {
    id: String(record.id ?? '') || newId('payreq'),
    customer_id: customerId,
    amount: money(record.amount),
    method: String(record.method ?? 'UPI'),
    reference: text(record.reference),
    paid_on_ymd: ymd(record.paidOnYmd),
    note: text(record.note),
    status: String(record.status ?? 'Pending'),
    payment_id: text(record.paymentId),
    review_note: text(record.reviewNote),
    reviewed_at: text(record.reviewedAt),
    created_at: String(record.createdAt ?? now),
    updated_at: now,
  };
}

export function paymentRequestFromRow(row: PaymentRequestRow): Row {
  return {
    id: row.id,
    amount: row.amount,
    method: row.method,
    ...(row.reference ? { reference: row.reference } : {}),
    paidOnYmd: row.paid_on_ymd,
    ...(row.note ? { note: row.note } : {}),
    status: row.status,
    ...(row.payment_id ? { paymentId: row.payment_id } : {}),
    ...(row.review_note ? { reviewNote: row.review_note } : {}),
    ...(row.reviewed_at ? { reviewedAt: row.reviewed_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** True for a delivery row the app would show as delivered (bills count only these). */
export function isDelivered(row: DeliveryRow): boolean {
  return row.status === 'Delivered';
}

export { dbToBool };
