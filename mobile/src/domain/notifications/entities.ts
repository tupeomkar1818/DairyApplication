import type { EntityBase, IsoDateString } from '@/src/domain/shared/types';
import type { Lang } from '@/src/i18n/language';
import type { SubscriptionNotificationType } from '@/src/domain/subscriptions/enums';

/**
 * In-app notifications.
 *
 * One row per thing worth telling somebody about — an order placed, a delivery marked, a bill generated. Rows are
 * addressed, not broadcast: `audience` says which app shows it, and `customerId` / `deliveryBoyId` say whose inbox
 * it lands in. There is no push channel: a row is seen when the person opens the app.
 */

export type NotificationAudience = 'Customer' | 'Admin' | 'DeliveryBoy';

/** Reuses the subscription notification vocabulary, plus the events raised by the customer app. */
export type NotificationType =
  | SubscriptionNotificationType
  | 'OrderPlaced'
  | 'OrderCancelled'
  | 'DaySkipped'
  | 'DeliveryCompleted'
  | 'PaymentReceived'
  | 'Announcement'
  | 'ChatMessage'
  | 'ComplaintRaised'
  | 'ComplaintAnswered'
  /** The 6 pm reminder of tomorrow's order, while it can still be changed. */
  | 'OrderReminder'
  /** A dairy offer the customer can use now (one per customer per offer). */
  | 'Offer';

/** A customer's answer to the evening reminder about tomorrow's order. */
export type OrderReminderResponse = 'keep' | 'change';

/** A notification's words in one language. */
export type NotificationText = { title: string; body: string };

export interface AppNotification extends EntityBase {
  audience: NotificationAudience;
  type: NotificationType;
  /** In English. A reader who chose another language sees `translations` instead (see `notificationText`). */
  title: string;
  body: string;
  /**
   * The same words in the app's other languages, written when the event happened — the row may be read later by
   * someone whose phone is set to another language. Rows saved before this existed have none and show in English.
   */
  translations?: Partial<Record<Exclude<Lang, 'en'>, NotificationText>>;
  /** Whose notification this is: the customer it concerns, and/or the delivery boy it is addressed to. */
  customerId?: string;
  deliveryBoyId?: string;
  /** Marks it read; absent means unread. */
  readAt?: IsoDateString;
  /** Where tapping it should go, e.g. "/(customer)/bills?month=2026-09". */
  link?: string;
  /**
   * What the notification is about, e.g. "quantity:<customer>:Cow Milk · 500 ml:2026-09-21". A newer notification
   * with the same subject for the same reader replaces a recent one, so tapping + three times reads as one change.
   */
  subjectKey?: string;
  /** The announcement this notification tells the customer about; its detail opens it. */
  announcementId?: string;
  /** Day the notification is about, when it concerns one (YYYY-MM-DD). */
  dateYmd?: string;
  monthYyyyMm?: string;
  /** For an order reminder: whether the customer chose to keep tomorrow's order as it is or to change it. */
  response?: OrderReminderResponse;
  respondedAt?: IsoDateString;
}
