import type { Announcement } from '@/src/domain/announcements/entities';
import type { IAnnouncementService } from '@/src/domain/announcements/service.interface';
import { api } from '@/src/infrastructure/api/client';

/**
 * Announcements from the dairy's server, so a message the dairy sends reaches every phone.
 *
 * The server decides who may read which: a customer is given the ones sent to them, with their own read mark and
 * never another household's.
 */
export class AnnouncementServiceApi implements IAnnouncementService {
  async list(): Promise<Announcement[]> {
    const answer = await api.get<{ items: Announcement[] }>('/announcements');
    return answer.items ?? [];
  }

  async save(announcement: Announcement): Promise<Announcement> {
    return api.put<Announcement>(`/announcements/${encodeURIComponent(announcement.id)}`, announcement);
  }

  async delete(id: string): Promise<void> {
    await api.delete<void>(`/announcements/${encodeURIComponent(id)}`);
  }

  /** The server knows which customer is asking, so it needs only the message. */
  async markRead(id: string): Promise<void> {
    await api.post<unknown>(`/announcements/${encodeURIComponent(id)}/read`, {});
  }
}
