import { detailsOf, parseJson } from '@/db';

/**
 * Notifications as the apps know them (`mobile/src/domain/notifications/entities.ts`) ↔ the `notifications` rows.
 *
 * Rows are addressed, not broadcast: `audience` says which app shows one, and the customer or delivery boy says
 * whose inbox it lands in. Those have columns, and so do the things the server answers by — what the row is about
 * (`subject_key`), the day, the month, the announcement it opens. The words are stored in both languages.
 */

export type Notification = Record<string, unknown> & {
  id: string;
  audience: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type NotificationRow = {
  id: string;
  audience: string;
  customer_id: string | null;
  delivery_boy_id: string | null;
  type: string;
  title: string;
  body: string;
  title_mr: string | null;
  body_mr: string | null;
  link: string | null;
  subject_key: string | null;
  date_ymd: string | null;
  month: string | null;
  announcement_id: string | null;
  response: string | null;
  responded_at: string | null;
  read_at: string | null;
  details_json: string;
  created_at: string;
  updated_at: string | null;
};

const COLUMN_KEYS = [
  'id',
  'audience',
  'customerId',
  'deliveryBoyId',
  'type',
  'title',
  'body',
  'translations',
  'link',
  'subjectKey',
  'dateYmd',
  'monthYyyyMm',
  'announcementId',
  'response',
  'respondedAt',
  'readAt',
  'createdAt',
  'updatedAt',
] as const;

export function notificationFromRow(row: NotificationRow): Notification {
  const details = parseJson<Record<string, unknown>>(row.details_json, {});
  return {
    ...details,
    id: row.id,
    audience: row.audience,
    type: row.type,
    title: row.title,
    body: row.body,
    ...(row.title_mr ? { translations: { mr: { title: row.title_mr, body: row.body_mr ?? '' } } } : {}),
    ...(row.customer_id ? { customerId: row.customer_id } : {}),
    ...(row.delivery_boy_id ? { deliveryBoyId: row.delivery_boy_id } : {}),
    ...(row.link ? { link: row.link } : {}),
    ...(row.subject_key ? { subjectKey: row.subject_key } : {}),
    ...(row.date_ymd ? { dateYmd: row.date_ymd } : {}),
    ...(row.month ? { monthYyyyMm: row.month } : {}),
    ...(row.announcement_id ? { announcementId: row.announcement_id } : {}),
    ...(row.response ? { response: row.response } : {}),
    ...(row.responded_at ? { respondedAt: row.responded_at } : {}),
    ...(row.read_at ? { readAt: row.read_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

export function notificationToRow(notification: Notification): Omit<NotificationRow, 'created_at' | 'updated_at'> {
  const mr = (notification.translations as { mr?: { title?: string; body?: string } } | undefined)?.mr;
  return {
    id: notification.id,
    audience: String(notification.audience),
    customer_id: (notification.customerId as string | undefined) || null,
    delivery_boy_id: (notification.deliveryBoyId as string | undefined) || null,
    type: String(notification.type ?? 'Announcement'),
    title: String(notification.title ?? '').trim(),
    body: String(notification.body ?? '').trim(),
    title_mr: mr?.title?.trim() || null,
    body_mr: mr?.body?.trim() || null,
    link: (notification.link as string | undefined) || null,
    subject_key: (notification.subjectKey as string | undefined) || null,
    date_ymd: (notification.dateYmd as string | undefined)?.slice(0, 10) || null,
    month: (notification.monthYyyyMm as string | undefined) || null,
    announcement_id: (notification.announcementId as string | undefined) || null,
    response: (notification.response as string | undefined) || null,
    responded_at: (notification.respondedAt as string | undefined) || null,
    read_at: (notification.readAt as string | undefined) || null,
    details_json: JSON.stringify(detailsOf(notification, COLUMN_KEYS)),
  };
}

/** Who a row is addressed to, for comparing two rows' readers. */
export type Reader = { audience: string; customerId?: string | null; deliveryBoyId?: string | null };

export function sameReader(a: Reader, b: Reader): boolean {
  return a.audience === b.audience && (a.customerId ?? '') === (b.customerId ?? '') && (a.deliveryBoyId ?? '') === (b.deliveryBoyId ?? '');
}

/** A newer row on the same subject replaces one raised within this long before it (as the apps do). */
export const MERGE_WINDOW_MS = 60 * 60 * 1000;

/**
 * The rows a new one replaces: the same reader's rows about the same subject, raised recently. One change made in
 * a few taps (quantity 2, then 3), or undone again, then reads as one notification showing where it ended up.
 */
export function replacedBy(incoming: Notification, existing: readonly NotificationRow[], now: Date): string[] {
  const subject = incoming.subjectKey as string | undefined;
  if (!subject) return [];
  const since = now.getTime() - MERGE_WINDOW_MS;
  return existing
    .filter(
      (row) =>
        row.subject_key === subject &&
        sameReader({ audience: row.audience, customerId: row.customer_id, deliveryBoyId: row.delivery_boy_id }, {
          audience: String(incoming.audience),
          customerId: incoming.customerId as string | undefined,
          deliveryBoyId: incoming.deliveryBoyId as string | undefined,
        }) &&
        new Date(row.created_at).getTime() >= since,
    )
    .map((row) => row.id);
}
