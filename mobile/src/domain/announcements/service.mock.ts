import type { Announcement } from '@/src/domain/announcements/entities';
import type { IAnnouncementService } from '@/src/domain/announcements/service.interface';
import {
  deleteAnnouncement,
  loadAnnouncements,
  markAnnouncementRead,
  saveAnnouncement,
} from '@/src/infrastructure/announcementsStore';

/** Announcements kept on this phone, in one list the admin and customer apps share. */
export class AnnouncementServiceMock implements IAnnouncementService {
  async list(): Promise<Announcement[]> {
    return loadAnnouncements();
  }

  async save(announcement: Announcement): Promise<Announcement> {
    return saveAnnouncement(announcement);
  }

  async delete(id: string): Promise<void> {
    await deleteAnnouncement(id);
  }

  async markRead(id: string, customerId: string): Promise<void> {
    await markAnnouncementRead(id, customerId);
  }
}
