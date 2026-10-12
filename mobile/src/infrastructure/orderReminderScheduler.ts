import {
  buildOrderReminders,
  orderReminderAdminKey,
  orderReminderAdminSummary,
  orderReminderDay,
} from '@/src/domain/notifications/orderReminders';
import { loadNotifications } from '@/src/infrastructure/notificationsStore';
import { mayReadEveryCustomer } from '@/src/infrastructure/customerScope';
import { services } from '@/src/infrastructure/service-registry';

let inFlight: Promise<number> | null = null;

/**
 * Sends this evening's order reminders if they are due and not sent yet; returns how many customers were reminded.
 *
 * There is no server to run a 6 pm job, so every open app calls this every minute. It is safe to call from several
 * apps at once: a customer already reminded for the day is skipped, and if two apps race, the notification store
 * merges rows on the same subject for the same reader into one.
 */
export function sendDueOrderReminders(now: Date = new Date()): Promise<number> {
  const ymd = orderReminderDay(now);
  if (!ymd) return Promise.resolve(0);
  if (inFlight) return inFlight;

  inFlight = (async () => {
    // With the dairy’s server, 6 pm is its own job (`server/src/jobs/reminders.ts`) — and it reaches phones that
    // are not even open. Only a phone keeping its own records sends these itself.
    if (services.notifications.listAll) return 0;
    // Only an app that can see every customer can remind them; that is the dairy’s own.
    if (!(await mayReadEveryCustomer())) return 0;
    const [customers, existing] = await Promise.all([services.customers.list(), loadNotifications()]);
    const sentKeys = new Set(existing.map((n) => n.subjectKey).filter((k): k is string => !!k));
    const rows = buildOrderReminders(customers.items, ymd, sentKeys);
    if (!rows.length) return 0;
    // The admin hears once per evening, with the first batch; customers added later are reminded quietly.
    const summary = sentKeys.has(orderReminderAdminKey(ymd)) ? [] : [orderReminderAdminSummary(rows.length, ymd)];
    await services.notifications.add([...rows, ...summary]);
    return rows.length;
  })()
    .catch(() => 0)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
