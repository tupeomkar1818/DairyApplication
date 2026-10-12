import type { AppNotification, OrderReminderResponse } from '@/src/domain/notifications/entities';
import type { INotificationService } from '@/src/domain/notifications/service.interface';
import {
  addNotifications,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  recordOrderReminderResponse,
  type NewNotification,
  type NotificationAddress,
} from '@/src/infrastructure/notificationsStore';

/**
 * Notifications kept on this phone, in one list the three apps share — each reads the rows addressed to it, so
 * `list` gives everything and the inbox filters.
 */
export class NotificationServiceMock implements INotificationService {
  async list(): Promise<AppNotification[]> {
    return loadNotifications();
  }

  async add(rows: readonly NewNotification[]): Promise<void> {
    await addNotifications(rows);
  }

  async markRead(id: string): Promise<void> {
    await markNotificationRead(id);
  }

  async markAllRead(address: NotificationAddress): Promise<void> {
    await markAllNotificationsRead(address);
  }

  async recordReminderResponse(input: {
    reminder: NewNotification & { customerId: string; dateYmd: string; subjectKey: string };
    response: OrderReminderResponse;
    customerName?: string;
  }): Promise<void> {
    await recordOrderReminderResponse(input);
  }
}
