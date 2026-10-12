import type { AppNotification, OrderReminderResponse } from '@/src/domain/notifications/entities';
import type { INotificationService } from '@/src/domain/notifications/service.interface';
import type { NewNotification, NotificationAddress } from '@/src/infrastructure/notificationsStore';
import { api } from '@/src/infrastructure/api/client';

/**
 * Notifications from the dairy's server, so what happens on one phone is told on the others.
 *
 * The server addresses the rows: it hands back this reader's inbox, and refuses a row written into an inbox this
 * app has no business writing to.
 */
export class NotificationServiceApi implements INotificationService {
  async list(): Promise<AppNotification[]> {
    const answer = await api.get<{ items: AppNotification[] }>('/notifications');
    return answer.items ?? [];
  }

  /** The dairy's reports read every row, including the customers' answers to the evening reminder. */
  async listAll(): Promise<AppNotification[]> {
    const answer = await api.get<{ items: AppNotification[] }>('/notifications?scope=all');
    return answer.items ?? [];
  }

  async add(rows: readonly NewNotification[]): Promise<void> {
    if (!rows.length) return;
    await api.post<unknown>('/notifications', { items: rows });
  }

  async markRead(id: string): Promise<void> {
    await api.post<unknown>('/notifications/read', { id });
  }

  async markAllRead(_address: NotificationAddress): Promise<void> {
    // The server knows whose inbox this is; the address is only needed on a phone keeping its own rows.
    await api.post<unknown>('/notifications/read', { all: true });
  }

  async recordReminderResponse(input: {
    reminder: NewNotification & { customerId: string; dateYmd: string; subjectKey: string };
    response: OrderReminderResponse;
    existing?: AppNotification | null;
  }): Promise<void> {
    let id = input.existing?.id;
    if (!id) {
      // The reminder is not in their inbox (the phone showed it while no app was open): it is raised now.
      const answer = await api.post<{ items: AppNotification[] }>('/notifications', { items: [input.reminder] });
      id = answer.items?.[0]?.id;
    }
    if (!id) return;
    await api.post<unknown>(`/notifications/${encodeURIComponent(id)}/response`, { response: input.response });
  }
}
