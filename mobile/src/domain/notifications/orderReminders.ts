import { buildTodayEntries, shiftYmd, todayYmd } from '@/src/components/admin/dashboardMetrics';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { customerCutoffFor, orderCutoffLabel } from '@/src/domain/customers/daySchedule';
import type { OrderReminderResponse } from '@/src/domain/notifications/entities';
import { notificationText, oneInEveryLanguage } from '@/src/domain/notifications/notificationText';
import { dairyInstant, dairyTimeLabel } from '@/src/domain/shared/dairyClock';
import { getLanguage, type Lang } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';
import type { NewNotification } from '@/src/infrastructure/notificationsStore';
import { formatDay, formatMoney } from '@/src/utils/format';

/**
 * The evening order reminder: once a day, at 6 pm IST, each customer with a delivery tomorrow is told what is coming
 * and asked whether to change it or keep it as it is — while there is still time to change it (until the 9 pm cut-off).
 *
 * The phone's time zone is respected, not overridden: "tomorrow" and the cut-off are the phone's own, and 6 pm IST is
 * one fixed moment that each phone shows in its local time (6:00 pm in India, 1:30 pm in London). One reminder per
 * customer per day; the admin gets one line saying how many went out.
 */

export const ORDER_REMINDER_HOUR = 18;


/** "6 pm" — the reminder time (IST) as people read it, in `lang` (the app's language by default). */
export function orderReminderTimeLabel(lang: Lang = getLanguage()): string {
  return dairyTimeLabel(ORDER_REMINDER_HOUR, 0, lang);
}

/** "9 pm" — the cut-off for changing tomorrow, in `lang` (the app's language by default). */
export function orderCutoffTimeLabel(lang: Lang = getLanguage()): string {
  return orderCutoffLabel(lang);
}

/** The one moment the reminder about `ymd` goes out: 6 pm IST on the evening before (an instant, in any time zone). */
export function orderReminderTimeFor(ymd: string): Date {
  return dairyInstant(ymd, ORDER_REMINDER_HOUR, 0, -1);
}

/**
 * The day reminders are due for at this moment — the phone's tomorrow, from 6 pm IST until tonight's cut-off — or
 * null outside that window. After the cut-off a question about changing tomorrow would only mislead, so a missed
 * evening is skipped.
 */
export function orderReminderDay(now: Date = new Date()): string | null {
  const tomorrow = shiftYmd(todayYmd(now), 1);
  const t = now.getTime();
  return t >= orderReminderTimeFor(tomorrow).getTime() && t < customerCutoffFor(tomorrow).getTime() ? tomorrow : null;
}

export function orderReminderKey(customerId: string, ymd: string): string {
  return `reminder:${customerId}:${ymd}`;
}

export function orderReminderAdminKey(ymd: string): string {
  return `reminder:admin:${ymd}`;
}

/** Whether this customer should hear about their orders at all: an active account that uses the app. */
function remindable(c: CustomerResponse): boolean {
  return c.status !== 'Inactive' && c.appAccessEnabled !== false;
}

/**
 * The reminder for one customer and day, or null when nothing is going to them that day. Written in every language
 * (English in `title` / `body`, the rest in `translations`); show it with `notificationText`.
 */
export function buildOrderReminder(customer: CustomerResponse, ymd: string): NewNotification | null {
  if (!remindable(customer)) return null;
  const entry = buildTodayEntries([customer], ymd)[0];
  if (!entry) return null;
  const items = [...entry.planItems, ...entry.addOnItems].join(', ');
  const amount = formatMoney(entry.amount);
  const extras = entry.addOnItems.length;
  return oneInEveryLanguage((lang): NewNotification => {
    const t = strings('inbox', lang).reminders;
    const cutoff = orderCutoffTimeLabel(lang);
    return {
      audience: 'Customer',
      customerId: customer.id,
      type: 'OrderReminder',
      title: t.title(formatDay(ymd, { weekday: true, lang })),
      body: extras ? t.bodyWithExtras(items, extras, amount, cutoff) : t.body(items, amount, cutoff),
      dateYmd: ymd,
      monthYyyyMm: ymd.slice(0, 7),
      subjectKey: orderReminderKey(customer.id, ymd),
    };
  });
}

/** Reminders for every customer with a delivery on `ymd` who has not been reminded yet (`sentKeys`). */
export function buildOrderReminders(
  customers: readonly CustomerResponse[],
  ymd: string,
  sentKeys: ReadonlySet<string> = new Set(),
): NewNotification[] {
  return customers
    .filter((c) => !sentKeys.has(orderReminderKey(c.id, ymd)))
    .map((c) => buildOrderReminder(c, ymd))
    .filter((n): n is NewNotification => !!n)
    .sort((a, b) => (a.customerId ?? '').localeCompare(b.customerId ?? ''));
}

/** The admin's line for the evening: how many customers were reminded about which day. */
export function orderReminderAdminSummary(count: number, ymd: string): NewNotification {
  return oneInEveryLanguage((lang): NewNotification => {
    const t = strings('inbox', lang).reminders;
    return {
      audience: 'Admin',
      type: 'OrderReminder',
      title: t.adminSummaryTitle(formatDay(ymd, { weekday: true, lang })),
      body: t.adminSummaryBody(count, orderReminderTimeLabel(lang), orderCutoffTimeLabel(lang)),
      dateYmd: ymd,
      subjectKey: orderReminderAdminKey(ymd),
    };
  });
}

/** What the customer's answer reads as, e.g. on the dashboard and the notification. */
export function orderReminderResponseLabel(response: OrderReminderResponse, lang: Lang = getLanguage()): string {
  const t = strings('inbox', lang).reminders;
  return response === 'keep' ? t.responseKeep : t.responseChange;
}

/** One reminder as the phone schedules it. */
export type UpcomingOrderReminder = { ymd: string; at: Date; title: string; body: string };

/**
 * The next evenings' reminders for one customer, as the phone schedules them ahead of time: one per upcoming day
 * with a delivery, at 6 pm IST the evening before, skipping evenings already past. Based on the orders as they stand
 * now — the app reschedules whenever they change.
 *
 * `title` and `body` are read in the app's language at the moment they are used (the words for every language are
 * built here), so a reminder scheduled again after a language change shows in the new language.
 */
export function upcomingOrderReminders(
  customer: CustomerResponse,
  now: Date = new Date(),
  days = 14,
): UpcomingOrderReminder[] {
  const today = todayYmd(now);
  const out: UpcomingOrderReminder[] = [];
  for (let i = 1; i <= days; i += 1) {
    const ymd = shiftYmd(today, i);
    const at = orderReminderTimeFor(ymd);
    if (at.getTime() <= now.getTime()) continue;
    const reminder = buildOrderReminder(customer, ymd);
    if (!reminder) continue;
    out.push({
      ymd,
      at,
      get title() {
        return notificationText(reminder).title;
      },
      get body() {
        return notificationText(reminder).body;
      },
    });
  }
  return out;
}
