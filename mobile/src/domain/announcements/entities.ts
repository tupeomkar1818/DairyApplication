import type { EntityBase, IsoDateString } from '@/src/domain/shared/types';
import type { Lang } from '@/src/i18n/language';

/**
 * Announcements: messages the dairy sends to customers — festival and birthday wishes, important notices, and
 * payment, order and delivery messages — optionally with a picture or a video. Delivery attempts raise one
 * automatically, from the delivery boy who marked the day.
 */

export type AnnouncementCategory = 'Festival' | 'Birthday' | 'Important' | 'Payment' | 'Order' | 'Delivery';

export const ANNOUNCEMENT_CATEGORIES: readonly AnnouncementCategory[] = [
  'Festival',
  'Birthday',
  'Important',
  'Payment',
  'Order',
  'Delivery',
];

export type AnnouncementMedia = {
  kind: 'image' | 'video';
  /** A data: URI of an uploaded file, a device file URI, or an https link (a YouTube link plays embedded). */
  uri: string;
};

/** Who an announcement is for. `all` includes customers who join after it was sent. */
export type AnnouncementAudience = { kind: 'all' } | { kind: 'customers'; customerIds: string[] };

export interface Announcement extends EntityBase {
  category: AnnouncementCategory;
  /** May contain `{name}`, replaced by each customer's first name when they read it. */
  title: string;
  message: string;
  /**
   * The same title and message in the app's other languages, for announcements the app writes itself (a delivery
   * attempt). What the admin types is shown as typed, so those have none. See `announcementText`.
   */
  translations?: Partial<Record<Exclude<Lang, 'en'>, { title: string; message: string }>>;
  media?: AnnouncementMedia;
  audience: AnnouncementAudience;
  /** Who sent it: the dairy from the admin app, or a delivery boy by marking a delivery. */
  source: 'admin' | 'delivery';
  senderName?: string;
  /** The delivery day a delivery announcement is about (YYYY-MM-DD). */
  dateYmd?: string;
  /** When each customer first opened it, by customer id. */
  readBy: Record<string, IsoDateString>;
}
