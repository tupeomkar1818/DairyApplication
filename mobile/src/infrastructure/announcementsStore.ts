import type { Announcement } from '@/src/domain/announcements/entities';
import { ANNOUNCEMENTS_STORE_KEY } from '@/src/infrastructure/storage/keys';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';

/**
 * Announcements, in one list shared by the admin and customer apps. Writes are serialized read-modify-write, like the
 * notifications store, so two sends in the same moment never drop each other.
 */

/** Keeps the list (and its pictures) from outgrowing on-device storage. */
const MAX_ROWS = 200;

function sanitize(raw: unknown): Announcement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Announcement => !!r && typeof r === 'object' && typeof (r as Announcement).id === 'string')
    .map((r) => ({
      ...r,
      title: String(r.title ?? ''),
      message: String(r.message ?? ''),
      audience: r.audience?.kind === 'customers' ? { kind: 'customers', customerIds: [...(r.audience.customerIds ?? [])] } : { kind: 'all' },
      readBy: r.readBy && typeof r.readBy === 'object' ? r.readBy : {},
    }));
}

export async function loadAnnouncements(): Promise<Announcement[]> {
  return sanitize(await readJson<unknown>(ANNOUNCEMENTS_STORE_KEY));
}

let queue: Promise<unknown> = Promise.resolve();

function update(updater: (current: Announcement[]) => Announcement[]): Promise<Announcement[]> {
  const run = queue
    .catch(() => undefined)
    .then(async () => {
      const next = updater(await loadAnnouncements()).slice(0, MAX_ROWS);
      await writeJson(ANNOUNCEMENTS_STORE_KEY, next);
      return next;
    });
  queue = run;
  return run;
}

/** Adds an announcement, or replaces the one with the same id (a corrected delivery attempt). */
export async function saveAnnouncement(announcement: Announcement): Promise<Announcement> {
  // A replaced announcement has news again, so it goes back on top with the read marks it was given (none, for a
  // corrected delivery attempt).
  await update((current) => [announcement, ...current.filter((a) => a.id !== announcement.id)]);
  return announcement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await update((current) => current.filter((a) => a.id !== id));
}

export async function markAnnouncementRead(id: string, customerId: string): Promise<void> {
  const now = new Date().toISOString();
  await update((current) =>
    current.map((a) => (a.id === id && !a.readBy?.[customerId] ? { ...a, readBy: { ...a.readBy, [customerId]: now } } : a)),
  );
}
