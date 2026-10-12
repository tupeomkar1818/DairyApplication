import type { AppNotification, NotificationAudience, OrderReminderResponse } from '@/src/domain/notifications/entities';
import { oneInEveryLanguage } from '@/src/domain/notifications/notificationText';
import { strings } from '@/src/i18n/strings';
import { formatDay } from '@/src/utils/format';
import { NOTIFICATIONS_STORE_KEY } from '@/src/infrastructure/storage/keys';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';

/**
 * In-app notifications, newest first, in one list shared by the three apps — each reads the rows addressed to it.
 *
 * Writes are serialized read-modify-write: two events raised in the same tick (a delivery marked for two customers)
 * must not drop each other.
 */

/** Keeps the list from growing without bound on a device that is never cleared. */
const MAX_ROWS = 500;

/** A newer notification on the same subject replaces one raised within this long before it. */
export const NOTIFICATION_MERGE_WINDOW_MS = 60 * 60 * 1000;

function sanitize(raw: unknown): AppNotification[] {
  if (!Array.isArray(raw)) return [];
  const out: AppNotification[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Partial<AppNotification>;
    if (typeof r.id !== 'string' || typeof r.title !== 'string' || typeof r.audience !== 'string') continue;
    // Words in other languages are optional (older rows have none); a malformed entry is dropped rather than shown.
    const { translations, ...rest } = r;
    const mr = translations?.mr;
    out.push({
      ...(rest as AppNotification),
      ...(mr && typeof mr === 'object' && typeof mr.title === 'string'
        ? { translations: { mr: { title: mr.title, body: String(mr.body ?? '') } } }
        : {}),
      body: typeof r.body === 'string' ? r.body : '',
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
      updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString(),
    });
  }
  return out;
}

export async function loadNotifications(): Promise<AppNotification[]> {
  return sanitize(await readJson<unknown>(NOTIFICATIONS_STORE_KEY));
}

let queue: Promise<unknown> = Promise.resolve();

function update(updater: (current: AppNotification[]) => AppNotification[]): Promise<AppNotification[]> {
  const run = queue
    .catch(() => undefined)
    .then(async () => {
      const next = updater(await loadNotifications()).slice(0, MAX_ROWS);
      await writeJson(NOTIFICATIONS_STORE_KEY, next);
      return next;
    });
  queue = run;
  return run;
}

export type NewNotification = Omit<AppNotification, 'id' | 'createdAt' | 'updatedAt'>;

function sameReader(a: Pick<AppNotification, 'audience' | 'customerId' | 'deliveryBoyId'>, b: typeof a): boolean {
  return a.audience === b.audience && (a.customerId ?? '') === (b.customerId ?? '') && (a.deliveryBoyId ?? '') === (b.deliveryBoyId ?? '');
}

/**
 * Puts new rows on top of the list. A new row with a `subjectKey` replaces the same reader's rows on that subject
 * raised within the merge window: one change made in a few taps (quantity 2, then 3), or undone (paused, then
 * back on), reads as one notification showing where it ended up — unread again, since it has news.
 */
export function mergeNotifications(
  current: readonly AppNotification[],
  incoming: readonly AppNotification[],
  now: Date = new Date(),
): AppNotification[] {
  const since = now.getTime() - NOTIFICATION_MERGE_WINDOW_MS;
  const replaced = (row: AppNotification) =>
    incoming.some(
      (n) =>
        !!n.subjectKey &&
        n.subjectKey === row.subjectKey &&
        sameReader(n, row) &&
        new Date(row.createdAt).getTime() >= since,
    );
  return [...incoming, ...current.filter((row) => !replaced(row))];
}

/** Raises one notification. Callers never wait on this: a failed write must not fail the action that caused it. */
export async function addNotification(input: NewNotification): Promise<AppNotification> {
  const now = new Date().toISOString();
  const row: AppNotification = {
    ...input,
    id: `ntf_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`,
    createdAt: now,
    updatedAt: now,
  };
  await update((current) => mergeNotifications(current, [row]));
  return row;
}

/** Raises several at once (e.g. bills generated for every customer) in a single write. */
export async function addNotifications(inputs: readonly NewNotification[]): Promise<void> {
  if (inputs.length === 0) return;
  const now = new Date().toISOString();
  const rows = inputs.map((input, index) => ({
    ...input,
    id: `ntf_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}${index}`,
    createdAt: now,
    updatedAt: now,
  })) as AppNotification[];
  await update((current) => mergeNotifications(current, rows));
}

export type NotificationAddress = {
  audience: NotificationAudience;
  customerId?: string;
  deliveryBoyId?: string;
};

/** Rows for one reader, newest first. */
export function notificationsFor(
  all: readonly AppNotification[],
  address: NotificationAddress,
): AppNotification[] {
  return all
    .filter((n) => {
      if (n.audience !== address.audience) return false;
      if (address.audience === 'Customer') return !!address.customerId && n.customerId === address.customerId;
      if (address.audience === 'DeliveryBoy') return !!address.deliveryBoyId && n.deliveryBoyId === address.deliveryBoyId;
      return true; // Admin sees every row addressed to the admin.
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function unreadCount(rows: readonly AppNotification[]): number {
  return rows.reduce((sum, n) => sum + (n.readAt ? 0 : 1), 0);
}

export async function markNotificationRead(id: string): Promise<void> {
  const now = new Date().toISOString();
  await update((current) => current.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: now, updatedAt: now } : n)));
}

/**
 * Saves a customer's answer to the reminder about tomorrow's order (keep it as it is, or change it), marking the
 * reminder read. When the reminder row is not there yet — the answer came from a notification the phone showed
 * while no app was open — it is added with the answer. The admin's tally for that day is rewritten in the same write.
 */
export async function recordOrderReminderResponse(input: {
  reminder: NewNotification & { customerId: string; dateYmd: string; subjectKey: string };
  response: OrderReminderResponse;
  customerName?: string;
  now?: Date;
}): Promise<void> {
  const { reminder, response } = input;
  const at = (input.now ?? new Date()).toISOString();
  const ymd = reminder.dateYmd;
  await update((current) => {
    let found = false;
    let next = current.map((n) => {
      if (n.audience !== 'Customer' || n.customerId !== reminder.customerId || n.subjectKey !== reminder.subjectKey) return n;
      found = true;
      return { ...n, response, respondedAt: at, readAt: n.readAt ?? at, updatedAt: at };
    });
    if (!found) {
      const row: AppNotification = {
        ...reminder,
        id: `ntf_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`,
        response,
        respondedAt: at,
        readAt: at,
        createdAt: at,
        updatedAt: at,
      };
      next = [row, ...next];
    }

    // One admin line per day with the answers so far, replaced on every answer.
    const answers = next.filter((n) => n.audience === 'Customer' && n.type === 'OrderReminder' && n.dateYmd === ymd && n.response);
    const keep = answers.filter((n) => n.response === 'keep').length;
    const change = answers.length - keep;
    const tallyKey = `reminder-answers:${ymd}`;
    const previous = next.find((n) => n.audience === 'Admin' && n.subjectKey === tallyKey);
    const words = oneInEveryLanguage((lang) => {
      const t = strings('inbox', lang).reminders;
      const name = input.customerName;
      const latest = name ? ` ${response === 'keep' ? t.answersLatestKeep(name) : t.answersLatestChange(name)}` : '';
      return {
        title: t.answersTitle(formatDay(ymd, { weekday: true, lang })),
        body: `${t.answersBody(keep, change)}${latest}`,
      };
    });
    const tally: AppNotification = {
      id: previous?.id ?? `ntf_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}a`,
      audience: 'Admin',
      type: 'OrderReminder',
      ...words,
      customerId: undefined,
      dateYmd: ymd,
      subjectKey: tallyKey,
      createdAt: at,
      updatedAt: at,
    };
    return [tally, ...next.filter((n) => !(n.audience === 'Admin' && n.subjectKey === tallyKey))];
  });
}

/** Marks everything in one inbox read — the "clear all" on a notification screen. */
export async function markAllNotificationsRead(address: NotificationAddress): Promise<void> {
  const now = new Date().toISOString();
  await update((current) => {
    const mine = new Set(notificationsFor(current, address).map((n) => n.id));
    return current.map((n) => (mine.has(n.id) && !n.readAt ? { ...n, readAt: now, updatedAt: now } : n));
  });
}
