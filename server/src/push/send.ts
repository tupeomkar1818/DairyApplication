import type { Env } from '@/http';
import type { Lang } from '@/jobs/words';
import type { Notification } from '@/notifications/mapping';

/**
 * Sending a notification to a phone that is not open.
 *
 * The apps are Expo apps, so a phone is reached through Expo's push service: the app registers the token Expo gave
 * it (`POST /push/tokens`), and the server posts to Expo, which hands the message to Apple or Google.
 *
 * Push is for the things nobody is holding a phone for — the evening reminder, an offer starting. Everything an app
 * raises while somebody is using it is already on their screen, so it is not pushed again.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo takes 100 messages in one request. */
const BATCH = 100;

type TokenRow = { token: string; user_id: string; language: string | null };

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: 'default';
  channelId?: string;
};

type ExpoTicket = { status: 'ok' | 'error'; id?: string; details?: { error?: string } };

/** The words in the language this phone is set to, English when it has no Marathi of its own. */
function wordsFor(row: Notification, language: Lang): { title: string; body: string } {
  const mr = (row.translations as { mr?: { title?: string; body?: string } } | undefined)?.mr;
  if (language === 'mr' && mr?.title) return { title: mr.title, body: String(mr.body ?? '') };
  return { title: String(row.title ?? ''), body: String(row.body ?? '') };
}

/** The phones to send to: every token registered by the people these rows are addressed to. */
async function tokensFor(env: Env, rows: readonly Notification[]): Promise<Map<string, TokenRow[]>> {
  const customerIds = [...new Set(rows.map((row) => String(row.customerId ?? '')).filter(Boolean))];
  const boyIds = [...new Set(rows.map((row) => String(row.deliveryBoyId ?? '')).filter(Boolean))];
  const byRecord = new Map<string, TokenRow[]>();
  if (!customerIds.length && !boyIds.length) return byRecord;

  const list = (table: string, ids: string[]) =>
    ids.length
      ? env.DB.prepare(
          `select t.token, t.user_id, t.language, r.id as record_id
             from push_tokens t join ${table} r on r.user_id = t.user_id
            where r.id in (${ids.map(() => '?').join(', ')})`,
        )
          .bind(...ids)
          .all<TokenRow & { record_id: string }>()
      : Promise.resolve({ results: [] as (TokenRow & { record_id: string })[] });

  const [customers, boys] = await Promise.all([list('customers', customerIds), list('delivery_boys', boyIds)]);
  for (const row of [...customers.results, ...boys.results]) {
    const existing = byRecord.get(row.record_id) ?? [];
    existing.push(row);
    byRecord.set(row.record_id, existing);
  }
  return byRecord;
}

/**
 * Pushes these notifications to the phones of the people they are addressed to. Never throws: a notification that
 * is in somebody's inbox has done its job even if the push did not get through.
 */
export async function sendPush(env: Env, rows: readonly Notification[]): Promise<number> {
  try {
    if (!rows.length) return 0;
    const byRecord = await tokensFor(env, rows);
    if (!byRecord.size) return 0;

    const messages: ExpoMessage[] = [];
    for (const row of rows) {
      const recordId = String(row.customerId ?? row.deliveryBoyId ?? '');
      for (const token of byRecord.get(recordId) ?? []) {
        const language: Lang = token.language === 'mr' ? 'mr' : 'en';
        messages.push({
          to: token.token,
          ...wordsFor(row, language),
          // What the app opens when the notification is tapped.
          data: { notificationId: row.id, type: row.type, link: row.link ?? null, dateYmd: row.dateYmd ?? null },
          sound: 'default',
          ...(row.type === 'OrderReminder' ? { channelId: 'order-reminders' } : {}),
        });
      }
    }
    if (!messages.length) return 0;

    let sent = 0;
    for (let i = 0; i < messages.length; i += BATCH) {
      const batch = messages.slice(i, i + BATCH);
      const answer = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(batch),
      });
      if (!answer.ok) {
        console.error('push', answer.status, await answer.text().catch(() => ''));
        continue;
      }
      const payload = (await answer.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
      const tickets = payload?.data ?? [];
      const gone: string[] = [];
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') sent += 1;
        // The app was uninstalled or the token replaced: it will never work again, so it is forgotten.
        else if (ticket.details?.error === 'DeviceNotRegistered') gone.push(batch[index]!.to);
      });
      if (gone.length) {
        await env.DB.batch(gone.map((token) => env.DB.prepare('delete from push_tokens where token = ?').bind(token)));
      }
    }
    return sent;
  } catch (error) {
    console.error('push', error);
    return 0;
  }
}
