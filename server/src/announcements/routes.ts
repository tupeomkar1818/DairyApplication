import {
  announcementFromRow,
  announcementToRow,
  audienceIds,
  forCustomer,
  isFor,
  sentTo,
  type Announcement,
  type AnnouncementReadRow,
  type AnnouncementRow,
} from '@/announcements/mapping';
import { requireRole, requireUser } from '@/auth/service';
import { nowIso } from '@/db';
import { ApiError, json, readJson, type Env, type Router } from '@/http';
import { assertPictureIsAnAddress } from '@/media/routes';
import { isDairy } from '@/auth/roles';

/**
 * Announcements: what the dairy tells its customers — festival and birthday wishes, notices — and the message a
 * delivery raises by itself when the van has been.
 *
 * The apps choose the id (a delivery announcement's is made from the customer and the day, so marking a day twice
 * corrects the message instead of sending a second one), so writing one is `PUT /announcements/:id`.
 */

async function loadAnnouncements(env: Env, where?: { id: string }): Promise<Announcement[]> {
  const rows = where
    ? await env.DB.prepare('select * from announcements where id = ?').bind(where.id).all<AnnouncementRow>()
    : await env.DB.prepare('select * from announcements order by created_at desc').all<AnnouncementRow>();
  if (!rows.results.length) return [];

  const ids = rows.results.map((row) => row.id);
  const reads = await env.DB.prepare(`select * from announcement_reads where announcement_id in (${ids.map(() => '?').join(', ')})`)
    .bind(...ids)
    .all<AnnouncementReadRow>();

  const byAnnouncement = new Map<string, AnnouncementReadRow[]>();
  for (const read of reads.results) {
    const list = byAnnouncement.get(read.announcement_id) ?? [];
    list.push(read);
    byAnnouncement.set(read.announcement_id, list);
  }
  return rows.results.map((row) => announcementFromRow(row, byAnnouncement.get(row.id) ?? []));
}

async function getRow(env: Env, id: string): Promise<AnnouncementRow> {
  const row = await env.DB.prepare('select * from announcements where id = ?').bind(id).first<AnnouncementRow>();
  if (!row) throw ApiError.notFound('ANNOUNCEMENT_NOT_FOUND', 'That message is no longer there.');
  return row;
}

function assertSendable(announcement: Announcement): void {
  if (!String(announcement.title ?? '').trim()) throw ApiError.badRequest('ANNOUNCEMENT_TITLE_REQUIRED', 'Give the message a title.');
  if (!String(announcement.message ?? '').trim()) throw ApiError.badRequest('ANNOUNCEMENT_MESSAGE_REQUIRED', 'Write the message.');
  const media = announcement.media as { uri?: string } | undefined;
  if (media?.uri) assertPictureIsAnAddress(media.uri, 'media');
}

/** The houses on a delivery boy's round: the only ones they may write to, and the only ones they may read about. */
async function myRound(env: Env, deliveryBoyId: string): Promise<Set<string>> {
  const rows = await env.DB.prepare('select id from customers where delivery_boy_id = ?').bind(deliveryBoyId).all<{ id: string }>();
  return new Set(rows.results.map((row) => row.id));
}

export function mountAnnouncements(router: Router): Router {
  return router
    .get('/announcements', async (context) => {
      const principal = await requireUser(context);
      const all = await loadAnnouncements(context.env);
      if (isDairy(principal.role)) return json({ items: all });

      if (principal.role === 'customer') {
        // Only the messages sent to this customer, and only their own read mark — never another household's.
        const id = principal.linkedRecordId ?? '';
        return json({ items: all.filter((a) => sentTo(a, id)).map((a) => forCustomer(a, id)) });
      }

      // A delivery boy sees the messages their own round raised, and nobody's read marks.
      const round = principal.linkedRecordId ? await myRound(context.env, principal.linkedRecordId) : new Set<string>();
      const theirs = all.filter((a) => {
        const ids = audienceIds(a);
        return a.source === 'delivery' && !!ids?.length && ids.every((id) => round.has(id));
      });
      return json({ items: theirs.map((a) => ({ ...a, readBy: {} })) });
    })

    .get('/announcements/:id', async (context) => {
      const principal = await requireUser(context);
      const [announcement] = await loadAnnouncements(context.env, { id: context.params.id! });
      if (!announcement) throw ApiError.notFound('ANNOUNCEMENT_NOT_FOUND', 'That message is no longer there.');
      if (isDairy(principal.role)) return json(announcement);

      if (principal.role === 'customer') {
        const id = principal.linkedRecordId ?? '';
        if (!sentTo(announcement, id)) throw ApiError.notFound('ANNOUNCEMENT_NOT_FOUND', 'That message is not yours to read.');
        return json(forCustomer(announcement, id));
      }

      const round = principal.linkedRecordId ? await myRound(context.env, principal.linkedRecordId) : new Set<string>();
      const ids = audienceIds(announcement);
      if (!ids?.length || !ids.every((id) => round.has(id))) {
        throw ApiError.notFound('ANNOUNCEMENT_NOT_FOUND', 'That message is not yours to read.');
      }
      return json({ ...announcement, readBy: {} });
    })

    // Send one, or correct one already sent (the same id).
    .put('/announcements/:id', async (context) => {
      const principal = await requireRole(context, 'admin', 'delivery_boy');
      const id = context.params.id!;
      const body = await readJson<Announcement>(context.request);
      const announcement: Announcement = { ...body, id };
      assertSendable(announcement);

      if (principal.role === 'delivery_boy') {
        // The delivery app raises one message, about a day it marked, to the house it marked it for.
        const ids = audienceIds(announcement) ?? [];
        if (announcement.source !== 'delivery' || ids.length !== 1) throw ApiError.forbidden('Only the dairy sends messages.');
        const round = principal.linkedRecordId ? await myRound(context.env, principal.linkedRecordId) : new Set<string>();
        if (!ids.every((customerId) => round.has(customerId))) throw ApiError.forbidden('That house is not on your round.');
      }

      const existing = await context.env.DB.prepare('select created_at from announcements where id = ?')
        .bind(id)
        .first<{ created_at: string }>();
      const now = nowIso();
      const row = announcementToRow(announcement);

      const statements = [
        context.env.DB.prepare(
          `insert into announcements (id, category, title, message, title_mr, message_mr, media_json, audience_kind,
             audience_customer_ids_json, created_by, details_json, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           on conflict(id) do update set
             category = excluded.category, title = excluded.title, message = excluded.message,
             title_mr = excluded.title_mr, message_mr = excluded.message_mr, media_json = excluded.media_json,
             audience_kind = excluded.audience_kind, audience_customer_ids_json = excluded.audience_customer_ids_json,
             created_by = excluded.created_by, details_json = excluded.details_json, updated_at = excluded.updated_at`,
        ).bind(
          row.id,
          row.category,
          row.title,
          row.message,
          row.title_mr,
          row.message_mr,
          row.media_json,
          row.audience_kind,
          row.audience_customer_ids_json,
          row.created_by,
          row.details_json,
          existing?.created_at ?? now,
          now,
        ),
      ];
      // A corrected message has news again, so it is unread for everybody once more.
      if (existing) statements.push(context.env.DB.prepare('delete from announcement_reads where announcement_id = ?').bind(id));
      await context.env.DB.batch(statements);

      const [saved] = await loadAnnouncements(context.env, { id });
      return json(saved, { status: existing ? 200 : 201 });
    })

    .delete('/announcements/:id', async (context) => {
      await requireRole(context, 'admin');
      const id = context.params.id!;
      await getRow(context.env, id);
      await context.env.DB.prepare('delete from announcements where id = ?').bind(id).run();
      return new Response(null, { status: 204 });
    })

    // The customer opened it.
    .post('/announcements/:id/read', async (context) => {
      const principal = await requireRole(context, 'customer');
      if (!principal.linkedRecordId) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'No customer record for this number.');
      const id = context.params.id!;
      const row = await getRow(context.env, id);
      if (!isFor(row, principal.linkedRecordId)) throw ApiError.notFound('ANNOUNCEMENT_NOT_FOUND', 'That message is not yours to read.');

      await context.env.DB.prepare(
        'insert into announcement_reads (announcement_id, customer_id, read_at) values (?, ?, ?) on conflict do nothing',
      )
        .bind(id, principal.linkedRecordId, nowIso())
        .run();

      const [saved] = await loadAnnouncements(context.env, { id });
      return json(forCustomer(saved!, principal.linkedRecordId));
    });
}
