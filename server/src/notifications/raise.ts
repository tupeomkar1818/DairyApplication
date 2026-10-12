import { newId } from '@/db';
import type { Env } from '@/http';
import { notificationFromRow, notificationToRow, replacedBy, type Notification, type NotificationRow } from '@/notifications/mapping';

/**
 * Putting notifications in people's inboxes — from an app that raised one, and from the server's own evening job.
 *
 * A row about the same subject as a recent one for the same reader replaces it, so one change made in a few taps
 * reads as one notification. The server stamps the id and the time: two apps racing cannot write the same row.
 */
export async function raiseNotifications(env: Env, rows: readonly Notification[], now: Date = new Date()): Promise<Notification[]> {
  if (!rows.length) return [];
  const at = now.toISOString();

  const subjects = [...new Set(rows.map((row) => String(row.subjectKey ?? '')).filter(Boolean))];
  // Only rows on the same subjects can be replaced, so that is all that needs reading.
  const recent = subjects.length
    ? (
        await env.DB.prepare(
          `select * from notifications where subject_key in (${subjects.map(() => '?').join(', ')}) and created_at > ?`,
        )
          .bind(...subjects, new Date(now.getTime() - 60 * 60 * 1000).toISOString())
          .all<NotificationRow>()
      ).results
    : [];

  const statements: unknown[] = [];
  const written: string[] = [];
  const replaced = new Set<string>();

  for (const sent of rows) {
    const row = notificationToRow({ ...sent, id: newId('ntf') });
    for (const id of replacedBy(sent, recent, now)) replaced.add(id);
    written.push(row.id);
    statements.push(
      env.DB.prepare(
        `insert into notifications (id, audience, customer_id, delivery_boy_id, type, title, body, title_mr, body_mr,
           link, subject_key, date_ymd, month, announcement_id, response, responded_at, read_at, details_json,
           created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        row.id,
        row.audience,
        row.customer_id,
        row.delivery_boy_id,
        row.type,
        row.title,
        row.body,
        row.title_mr,
        row.body_mr,
        row.link,
        row.subject_key,
        row.date_ymd,
        row.month,
        row.announcement_id,
        row.response,
        row.responded_at,
        row.read_at,
        row.details_json,
        at,
        at,
      ),
    );
  }

  // The replaced rows go first, so a subject never has two rows in the inbox for a moment.
  for (const id of replaced) statements.unshift(env.DB.prepare('delete from notifications where id = ?').bind(id));
  await env.DB.batch(statements as never[]);

  const saved = await env.DB.prepare(`select * from notifications where id in (${written.map(() => '?').join(', ')})`)
    .bind(...written)
    .all<NotificationRow>();
  return saved.results.map(notificationFromRow);
}
