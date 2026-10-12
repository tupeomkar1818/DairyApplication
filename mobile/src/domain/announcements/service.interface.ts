import type { Announcement } from '@/src/domain/announcements/entities';

/**
 * Announcements, wherever they are kept — on this phone, or on the dairy's server.
 *
 * The dairy writes them; a delivery marked raises one by itself. A customer only reads the ones sent to them, and
 * says when they have opened one.
 */
export interface IAnnouncementService {
  /** GET /announcements — the ones the signed-in person may read. */
  list(): Promise<Announcement[]>;

  /**
   * PUT /announcements/:id — sends it, or corrects one already sent. The app chooses the id: a delivery
   * announcement's is made from the customer and the day, so marking a day twice corrects the message.
   */
  save(announcement: Announcement): Promise<Announcement>;

  /** DELETE /announcements/:id. The dairy only. */
  delete(id: string): Promise<void>;

  /** The customer opened it. `customerId` is only needed where the phone keeps its own records. */
  markRead(id: string, customerId: string): Promise<void>;
}
