import { loadEveryCustomer } from '@/customers/read';
import type { Env } from '@/http';
import { orderForDay, remindable } from '@/jobs/schedule';
import { formatDay, inEveryLanguage, money, timeLabel, WORDS, type Lang } from '@/jobs/words';
import type { Notification, NotificationRow } from '@/notifications/mapping';
import { raiseNotifications } from '@/notifications/raise';
import { sendPush } from '@/push/send';

/**
 * The evening reminder: at 6 pm, every customer with a delivery tomorrow is told what is coming and asked whether
 * to change it or keep it as it is — while there is still time, because the day closes at 9 pm.
 *
 * It used to be raised by whichever dairy app happened to be open. Now the server does it, so it goes out whether
 * anybody has their phone in their hand or not, and the push reaches a phone that is not even open.
 */

/** 6 pm, the dairy's time. */
export const REMINDER_HOUR = 18;
/** 9 pm, when tomorrow stops being the customer's to change. */
export const CUTOFF_HOUR = 21;
const INDIA_OFFSET_MS = 5.5 * 60 * 60_000;

export function indiaYmd(now: Date): string {
  return new Date(now.getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 10);
}

export function tomorrowYmd(now: Date): string {
  return new Date(now.getTime() + INDIA_OFFSET_MS + 86_400_000).toISOString().slice(0, 10);
}

export function reminderKey(customerId: string, ymd: string): string {
  return `reminder:${customerId}:${ymd}`;
}

export function adminSummaryKey(ymd: string): string {
  return `reminder:admin:${ymd}`;
}

export function answersKey(ymd: string): string {
  return `reminder-answers:${ymd}`;
}

/** The reminder for one customer, in both languages, or null when nothing is going to them tomorrow. */
export function buildReminder(customer: Parameters<typeof orderForDay>[0], ymd: string): Notification | null {
  if (!remindable(customer)) return null;
  if (!orderForDay(customer, ymd, 'en')) return null;

  const words = inEveryLanguage((lang: Lang) => {
    const order = orderForDay(customer, ymd, lang)!;
    const items = [...order.planItems, ...order.addOnItems].join(', ');
    const amount = money(order.amount);
    const cutoff = timeLabel(CUTOFF_HOUR, lang);
    const extras = order.addOnItems.length;
    return {
      title: WORDS[lang].reminderTitle(formatDay(ymd, lang, { weekday: true })),
      body: extras
        ? WORDS[lang].reminderBodyWithExtras(items, extras, amount, cutoff)
        : WORDS[lang].reminderBody(items, amount, cutoff),
    };
  });

  return {
    id: '',
    audience: 'Customer',
    customerId: customer.id,
    type: 'OrderReminder',
    ...words,
    link: '/(customer)/my-days',
    dateYmd: ymd,
    monthYyyyMm: ymd.slice(0, 7),
    subjectKey: reminderKey(customer.id, ymd),
    createdAt: '',
    updatedAt: '',
  };
}

/** The dairy's one line for the evening: how many customers were asked about which day. */
export function buildAdminSummary(count: number, ymd: string): Notification {
  const words = inEveryLanguage((lang: Lang) => ({
    title: WORDS[lang].adminSummaryTitle(formatDay(ymd, lang, { weekday: true })),
    body: WORDS[lang].adminSummaryBody(count, timeLabel(REMINDER_HOUR, lang), timeLabel(CUTOFF_HOUR, lang)),
  }));
  return {
    id: '',
    audience: 'Admin',
    type: 'OrderReminder',
    ...words,
    dateYmd: ymd,
    subjectKey: adminSummaryKey(ymd),
    createdAt: '',
    updatedAt: '',
  };
}

/**
 * The dairy's running tally of the evening's answers: one line a day, rewritten as each customer answers.
 *
 * Counted here rather than stored by the answering phone, because one customer's app may not read another's answer.
 */
export async function updateAnswersTally(
  env: Env,
  ymd: string,
  latest: { name?: string; response: string } | null,
  now: Date = new Date(),
): Promise<void> {
  const answers = await env.DB.prepare(
    "select response from notifications where audience = 'Customer' and type = 'OrderReminder' and date_ymd = ? and response is not null",
  )
    .bind(ymd)
    .all<{ response: string }>();
  const keep = answers.results.filter((row) => row.response === 'keep').length;
  const change = answers.results.length - keep;

  const words = inEveryLanguage((lang: Lang) => {
    const t = WORDS[lang];
    const name = latest?.name;
    const tail = name ? ` ${latest!.response === 'keep' ? t.answersLatestKeep(name) : t.answersLatestChange(name)}` : '';
    return {
      title: t.answersTitle(formatDay(ymd, lang, { weekday: true })),
      body: `${t.answersBody(keep, change)}${tail}`,
    };
  });

  const tally: Notification = {
    id: '',
    audience: 'Admin',
    type: 'OrderReminder',
    ...words,
    dateYmd: ymd,
    subjectKey: answersKey(ymd),
    createdAt: '',
    updatedAt: '',
  };

  // One line a day: the one from earlier this evening is replaced, however long ago it was written.
  const previous = await env.DB.prepare("select id from notifications where audience = 'Admin' and subject_key = ?")
    .bind(answersKey(ymd))
    .all<Pick<NotificationRow, 'id'>>();
  if (previous.results.length) {
    await env.DB.batch(previous.results.map((row) => env.DB.prepare('delete from notifications where id = ?').bind(row.id)));
  }
  await raiseNotifications(env, [tally], now);
}

/** Sends this evening's reminders. Returns how many customers were told. */
export async function sendOrderReminders(env: Env, now: Date = new Date()): Promise<number> {
  const ymd = tomorrowYmd(now);
  const customers = await loadEveryCustomer(env);

  // One reminder per customer per day: anybody already asked about tomorrow is left alone.
  const already = await env.DB.prepare(
    "select subject_key from notifications where audience = 'Customer' and type = 'OrderReminder' and date_ymd = ?",
  )
    .bind(ymd)
    .all<{ subject_key: string | null }>();
  const asked = new Set(already.results.map((row) => row.subject_key ?? ''));

  const rows = customers
    .filter((customer) => !asked.has(reminderKey(customer.id, ymd)))
    .map((customer) => buildReminder(customer, ymd))
    .filter((row): row is Notification => !!row);
  if (!rows.length) return 0;

  // The dairy hears once an evening, with the first batch; customers added later are reminded quietly.
  const summarySent = await env.DB.prepare("select id from notifications where audience = 'Admin' and subject_key = ?")
    .bind(adminSummaryKey(ymd))
    .first<{ id: string }>();

  const saved = await raiseNotifications(env, summarySent ? rows : [...rows, buildAdminSummary(rows.length, ymd)], now);
  await sendPush(
    env,
    saved.filter((row) => row.audience === 'Customer'),
  );
  return rows.length;
}
