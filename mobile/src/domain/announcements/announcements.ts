import type {
  Announcement,
  AnnouncementAudience,
  AnnouncementCategory,
  AnnouncementMedia,
} from '@/src/domain/announcements/entities';
import { getLanguage, type Lang } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';
import { formatDay } from '@/src/utils/format';

/** The rules behind announcements, shared by the admin composer, the customer's list and the delivery flow. */

/** Newest first, only what this customer should see. */
export function announcementsForCustomer(all: readonly Announcement[], customerId: string): Announcement[] {
  return all
    .filter((a) => a.audience.kind === 'all' || a.audience.customerIds.includes(customerId))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** How far back a customer's Announcements list goes. */
export const ANNOUNCEMENT_HISTORY_DAYS = 90;

/** Only announcements sent in the last 90 days — what the customer's list and dashboard card show. */
export function recentAnnouncements(list: readonly Announcement[], now: Date = new Date()): Announcement[] {
  const since = now.getTime() - ANNOUNCEMENT_HISTORY_DAYS * 24 * 60 * 60 * 1000;
  return list.filter((a) => {
    const sent = new Date(a.createdAt).getTime();
    return Number.isFinite(sent) && sent >= since;
  });
}

export function isUnreadBy(announcement: Announcement, customerId: string): boolean {
  return !announcement.readBy?.[customerId];
}

/**
 * "Happy birthday, {name}!" → "Happy birthday, Rahul!" — the first name, or "there" (in the reader's language) when
 * the name is unknown.
 */
export function personalize(text: string, customerName: string | undefined, lang: Lang = getLanguage()): string {
  const first = String(customerName ?? '').trim().split(/\s+/)[0] || strings('inbox', lang).announcements.nameFallback;
  return String(text ?? '').replace(/\{name\}/gi, first);
}

/**
 * An announcement's title and message in `lang` (the app's language by default), before `personalize`. Announcements
 * the app wrote itself carry every language; what the admin typed is shown as typed.
 */
export function announcementText(
  a: Pick<Announcement, 'title' | 'message' | 'translations'>,
  lang: Lang = getLanguage(),
): { title: string; message: string } {
  const translated = lang === 'en' ? undefined : a.translations?.[lang];
  if (translated && typeof translated.title === 'string' && translated.title) {
    return { title: translated.title, message: typeof translated.message === 'string' ? translated.message : '' };
  }
  return { title: a.title, message: a.message };
}

/** What a kind of announcement is called, e.g. "Festival". */
export function announcementCategoryLabel(category: AnnouncementCategory, lang: Lang = getLanguage()): string {
  return strings('inbox', lang).announcements.categories[category] ?? category;
}

/** How many customers an announcement reaches right now, and how many of them opened it. */
export function reachOf(
  announcement: Announcement,
  customerIds: readonly string[],
): { recipients: number; read: number } {
  const ids = announcement.audience.kind === 'all' ? customerIds : announcement.audience.customerIds;
  const unique = Array.from(new Set(ids));
  return { recipients: unique.length, read: unique.filter((id) => !!announcement.readBy?.[id]).length };
}

/** The customer ids a new announcement goes to, for raising their notifications. */
export function recipientIds(audience: AnnouncementAudience, allCustomerIds: readonly string[]): string[] {
  return Array.from(new Set(audience.kind === 'all' ? allCustomerIds : audience.customerIds));
}

/** Customers whose birthday (day and month of `dateOfBirth`) is on this day. */
export function birthdaysOn<T extends { id: string; dateOfBirth?: string; status?: string }>(
  customers: readonly T[],
  ymd: string,
): T[] {
  const monthDay = ymd.slice(5, 10);
  return customers.filter((c) => {
    if (c.status === 'Inactive') return false;
    const dob = String(c.dateOfBirth ?? '').trim();
    const iso = dob.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const dmy = dob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const md = iso ? `${iso[2]}-${iso[3]}` : dmy ? `${dmy[2]}-${dmy[1]}` : '';
    return md === monthDay;
  });
}

/** A starting point for each kind of message, in `lang` (the app's language by default); the admin edits it before sending. */
export function announcementTemplate(
  category: AnnouncementCategory,
  lang: Lang = getLanguage(),
): { title: string; message: string } {
  const template = strings('inbox', lang).announcements.templates[category];
  return { title: template.title, message: template.message };
}

/**
 * The templates by kind, read in the app's language at the moment they are used (each entry looks its words up when
 * read, so a screen that re-renders after a language change gets the new wording). Prefer `announcementTemplate`.
 */
export const ANNOUNCEMENT_TEMPLATES: Readonly<Record<AnnouncementCategory, { readonly title: string; readonly message: string }>> =
  Object.fromEntries(
    (['Festival', 'Birthday', 'Important', 'Payment', 'Order', 'Delivery'] as const).map((category) => [
      category,
      {
        get title() {
          return announcementTemplate(category).title;
        },
        get message() {
          return announcementTemplate(category).message;
        },
      },
    ]),
  ) as Record<AnnouncementCategory, { readonly title: string; readonly message: string }>;

/** The video id of a YouTube link, for embedding; null for any other link. */
export function youtubeVideoId(url: string): string | null {
  const text = String(url ?? '').trim();
  const m =
    text.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ??
    text.match(/youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1]! : null;
}

/** Reads a pasted link: an image or a video, or null when it is not an http(s) link. */
export function mediaFromLink(link: string): AnnouncementMedia | null {
  const uri = String(link ?? '').trim();
  if (!/^https?:\/\/\S+$/i.test(uri)) return null;
  if (youtubeVideoId(uri)) return { kind: 'video', uri };
  if (/\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(uri)) return { kind: 'image', uri };
  return { kind: 'video', uri };
}

/**
 * The announcement a delivery attempt leaves for the customer. Its id is fixed per customer and day, so marking the
 * day again (a correction) updates it instead of adding a second one. It is written in every language (English in
 * `title` / `message`, the rest in `translations`), since the customer may read it in either.
 */
export function deliveryAttemptAnnouncement(input: {
  customerId: string;
  dateYmd: string;
  delivered: boolean;
  itemsLabel: string;
  deliveryBoyName?: string;
  now?: Date;
}): Announcement {
  const nowIso = (input.now ?? new Date()).toISOString();
  const text = (lang: Lang) => {
    const t = strings('inbox', lang).announcements.delivery;
    const day = formatDay(input.dateYmd, { weekday: true, lang });
    if (!input.delivered) return { title: t.notDeliveredTitle, message: t.notDeliveredMessage(day) };
    const sentence = input.deliveryBoyName ? t.deliveredByMessage(day, input.deliveryBoyName) : t.deliveredMessage(day);
    return {
      title: t.deliveredTitle,
      message: input.itemsLabel ? `${sentence} ${t.deliveredItems(input.itemsLabel)}` : sentence,
    };
  };
  const en = text('en');
  return {
    id: deliveryAnnouncementId(input.customerId, input.dateYmd),
    category: 'Delivery',
    title: en.title,
    message: en.message,
    translations: { mr: text('mr') },
    audience: { kind: 'customers', customerIds: [input.customerId] },
    source: 'delivery',
    senderName: input.deliveryBoyName,
    dateYmd: input.dateYmd,
    readBy: {},
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function deliveryAnnouncementId(customerId: string, dateYmd: string): string {
  return `ann_delivery_${customerId}_${dateYmd}`;
}
