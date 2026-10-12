import { detailsOf, parseJson } from '@/db';

/**
 * Announcements as the apps know them (`mobile/src/domain/announcements/entities.ts`) ↔ the `announcements` rows.
 *
 * The wording is kept in both languages: what the admin types is shown as typed (English columns only), and what
 * the app writes itself — a delivery attempt — carries its Marathi too. Who an announcement is for has columns,
 * because the server decides from them which customer may read it; the rest rides in `details_json`.
 *
 * Who has opened it is not part of the row: `announcement_reads` holds one line per customer who did.
 */

export type Announcement = Record<string, unknown> & {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  updatedAt: string;
};

export type AnnouncementRow = {
  id: string;
  category: string;
  title: string;
  message: string;
  title_mr: string | null;
  message_mr: string | null;
  media_json: string | null;
  audience_kind: string;
  audience_customer_ids_json: string | null;
  created_by: string | null;
  details_json: string;
  created_at: string;
  updated_at: string;
};

export type AnnouncementReadRow = { announcement_id: string; customer_id: string; read_at: string };

const COLUMN_KEYS = [
  'id',
  'category',
  'title',
  'message',
  'translations',
  'media',
  'audience',
  'senderName',
  'readBy',
  'createdAt',
  'updatedAt',
] as const;

export function announcementFromRow(row: AnnouncementRow, reads: readonly AnnouncementReadRow[] = []): Announcement {
  const details = parseJson<Record<string, unknown>>(row.details_json, {});
  const ids = parseJson<string[]>(row.audience_customer_ids_json, []);
  const readBy: Record<string, string> = {};
  for (const read of reads) readBy[read.customer_id] = read.read_at;

  return {
    ...details,
    id: row.id,
    category: row.category,
    title: row.title,
    message: row.message,
    ...(row.title_mr ? { translations: { mr: { title: row.title_mr, message: row.message_mr ?? '' } } } : {}),
    ...(row.media_json ? { media: parseJson<unknown>(row.media_json, null) } : {}),
    audience: row.audience_kind === 'customers' ? { kind: 'customers', customerIds: ids } : { kind: 'all' },
    ...(row.created_by ? { senderName: row.created_by } : {}),
    readBy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function announcementToRow(announcement: Announcement): Omit<AnnouncementRow, 'created_at' | 'updated_at'> {
  const audience = (announcement.audience ?? { kind: 'all' }) as { kind?: string; customerIds?: string[] };
  const mr = (announcement.translations as { mr?: { title?: string; message?: string } } | undefined)?.mr;
  const forSome = audience.kind === 'customers';

  return {
    id: announcement.id,
    category: String(announcement.category ?? 'Important'),
    title: String(announcement.title ?? '').trim(),
    message: String(announcement.message ?? '').trim(),
    title_mr: mr?.title?.trim() || null,
    message_mr: mr?.message?.trim() || null,
    media_json: announcement.media ? JSON.stringify(announcement.media) : null,
    audience_kind: forSome ? 'customers' : 'all',
    audience_customer_ids_json: forSome ? JSON.stringify(audience.customerIds ?? []) : null,
    created_by: (announcement.senderName as string | undefined)?.trim() || null,
    details_json: JSON.stringify(detailsOf(announcement, COLUMN_KEYS)),
  };
}

/** True when this announcement was sent to this customer — everybody, or their name on the list. */
export function isFor(row: Pick<AnnouncementRow, 'audience_kind' | 'audience_customer_ids_json'>, customerId: string): boolean {
  if (row.audience_kind !== 'customers') return true;
  return parseJson<string[]>(row.audience_customer_ids_json, []).includes(customerId);
}

/** The customers an announcement was sent to, or null when it went to everybody. */
export function audienceIds(announcement: Announcement): string[] | null {
  const audience = (announcement.audience ?? {}) as { kind?: string; customerIds?: string[] };
  return audience.kind === 'customers' ? (audience.customerIds ?? []) : null;
}

/** The same question as `isFor`, asked of an announcement that has already been read out of its row. */
export function sentTo(announcement: Announcement, customerId: string): boolean {
  const ids = audienceIds(announcement);
  return ids === null || ids.includes(customerId);
}

/** The announcement as one customer may read it: their own read mark, never anybody else's. */
export function forCustomer(announcement: Announcement, customerId: string): Announcement {
  const readBy = (announcement.readBy ?? {}) as Record<string, string>;
  return { ...announcement, readBy: readBy[customerId] ? { [customerId]: readBy[customerId]! } : {} };
}
