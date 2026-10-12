import type { AppNotification, OrderReminderResponse } from '@/src/domain/notifications/entities';
import type { NewNotification, NotificationAddress } from '@/src/infrastructure/notificationsStore';

/**
 * In-app notifications, wherever they are kept.
 *
 * Rows are addressed: `list` gives the signed-in reader their own inbox. Every app raises rows as things happen —
 * with the dairy's server, only to inboxes it has business writing to (see `server/src/notifications/routes.ts`).
 */
export interface INotificationService {
  /** GET /notifications — this reader's inbox. */
  list(): Promise<AppNotification[]>;

  /**
   * Every row there is, which the dairy's reports are built from (customers' answers to the evening reminder).
   * Only where a server keeps them; on a phone `list` already returns everything.
   */
  listAll?(): Promise<AppNotification[]>;

  /** POST /notifications — raise one or several. */
  add(rows: readonly NewNotification[]): Promise<void>;

  /** POST /notifications/read */
  markRead(id: string): Promise<void>;
  markAllRead(address: NotificationAddress): Promise<void>;

  /**
   * The customer's answer to the evening reminder about tomorrow's order. `existing` is the reminder row when it is
   * already in their inbox; without one the answer is recorded against a new row.
   */
  recordReminderResponse(input: {
    reminder: NewNotification & { customerId: string; dateYmd: string; subjectKey: string };
    response: OrderReminderResponse;
    customerName?: string;
    existing?: AppNotification | null;
  }): Promise<void>;
}
