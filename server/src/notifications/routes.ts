import { requireRole, requireUser, type Principal } from '@/auth/service';
import { newId, nowIso } from '@/db';
import { ApiError, json, readJson, type Env, type Router } from '@/http';
import { updateAnswersTally } from '@/jobs/reminders';
import { notificationFromRow, notificationToRow, replacedBy, type Notification, type NotificationRow } from '@/notifications/mapping';
import { isDairy } from '@/auth/roles';

/**
 * In-app notifications: one row per thing worth telling somebody about — an order placed, a delivery marked, a bill
 * generated. Rows are addressed, so each app reads its own inbox and nobody else's.
 *
 * The apps raise them as things happen (`mobile/src/domain/notifications/events.ts`), which is why any signed-in
 * app may write here — but only to inboxes it has business writing to: a customer may tell the dairy and themselves,
 * a delivery boy the dairy, themselves and the houses on their round, the dairy anyone.
 */

/** The newest rows are what an inbox shows; older ones are history nobody scrolls to. */
const INBOX_LIMIT = 500;

async function myRound(env: Env, deliveryBoyId: string): Promise<Set<string>> {
  const rows = await env.DB.prepare('select id from customers where delivery_boy_id = ?').bind(deliveryBoyId).all<{ id: string }>();
  return new Set(rows.results.map((row) => row.id));
}

/** The rows this reader may see. The dairy may also ask for every row, which its reports are built from. */
async function inbox(env: Env, principal: Principal, scope: string | null): Promise<Notification[]> {
  if (isDairy(principal.role)) {
    const rows =
      scope === 'all'
        ? await env.DB.prepare('select * from notifications order by created_at desc limit ?').bind(INBOX_LIMIT).all<NotificationRow>()
        : await env.DB.prepare("select * from notifications where audience = 'Admin' order by created_at desc limit ?")
            .bind(INBOX_LIMIT)
            .all<NotificationRow>();
    return rows.results.map(notificationFromRow);
  }

  const column = principal.role === 'customer' ? 'customer_id' : 'delivery_boy_id';
  const audience = principal.role === 'customer' ? 'Customer' : 'DeliveryBoy';
  const rows = await env.DB.prepare(
    `select * from notifications where audience = ? and ${column} = ? order by created_at desc limit ?`,
  )
    .bind(audience, principal.linkedRecordId ?? '', INBOX_LIMIT)
    .all<NotificationRow>();
  return rows.results.map(notificationFromRow);
}

/**
 * Whether this app may put a row in that inbox.
 *
 * The dairy may tell anyone. A customer's app tells the dairy what the customer did, and itself; a delivery boy's
 * app tells the dairy, itself, and the houses on its round. Nobody writes into another household's inbox.
 */
async function mayAddress(env: Env, principal: Principal, row: Notification): Promise<boolean> {
  if (isDairy(principal.role)) return true;
  const audience = String(row.audience);
  const customerId = (row.customerId as string | undefined) ?? '';
  const deliveryBoyId = (row.deliveryBoyId as string | undefined) ?? '';

  if (principal.role === 'customer') {
    if (deliveryBoyId) return false;
    // "Admin" rows carry the customer they are about, which is this customer.
    if (audience === 'Admin') return !customerId || customerId === principal.linkedRecordId;
    return audience === 'Customer' && customerId === principal.linkedRecordId;
  }

  if (audience === 'Admin') return true;
  if (audience === 'DeliveryBoy') return deliveryBoyId === principal.linkedRecordId;
  if (audience === 'Customer') {
    if (!customerId || !principal.linkedRecordId) return false;
    return (await myRound(env, principal.linkedRecordId)).has(customerId);
  }
  return false;
}

export function mountNotifications(router: Router): Router {
  return router
    .get('/notifications', async (context) => {
      const principal = await requireUser(context);
      return json({ items: await inbox(context.env, principal, context.url.searchParams.get('scope')) });
    })

    // Raise one or several. The server stamps the id and the time, so two apps racing cannot write the same row.
    .post('/notifications', async (context) => {
      const principal = await requireUser(context);
      const body = await readJson<{ items?: Notification[] } | Notification>(context.request);
      const incoming = Array.isArray((body as { items?: Notification[] }).items)
        ? (body as { items: Notification[] }).items
        : [body as Notification];
      if (!incoming.length) return json({ items: [] }, { status: 201 });
      if (incoming.length > 200) throw ApiError.badRequest('TOO_MANY_NOTIFICATIONS', 'Too many notifications in one go.');

      const now = new Date();
      const nowAt = now.toISOString();
      const subjects = [...new Set(incoming.map((row) => String(row.subjectKey ?? '')).filter(Boolean))];
      // Only rows on the same subjects can be replaced, so that is all that needs reading.
      const recent = subjects.length
        ? await context.env.DB.prepare(
            `select * from notifications where subject_key in (${subjects.map(() => '?').join(', ')}) and created_at > ?`,
          )
            .bind(...subjects, new Date(now.getTime() - 60 * 60 * 1000).toISOString())
            .all<NotificationRow>()
        : { results: [] as NotificationRow[] };

      const statements = [];
      const written: string[] = [];
      const replaced = new Set<string>();
      for (const sent of incoming) {
        if (!String(sent.title ?? '').trim()) throw ApiError.badRequest('NOTIFICATION_TITLE_REQUIRED', 'A notification needs a title.');
        if (!(await mayAddress(context.env, principal, sent))) throw ApiError.forbidden('That is not your notification to send.');

        const row = notificationToRow({ ...sent, id: newId('ntf'), readAt: undefined });
        for (const id of replacedBy(sent, recent.results, now)) replaced.add(id);
        written.push(row.id);
        statements.push(
          context.env.DB.prepare(
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
            nowAt,
            nowAt,
          ),
        );
      }

      for (const id of replaced) {
        statements.unshift(context.env.DB.prepare('delete from notifications where id = ?').bind(id));
      }
      await context.env.DB.batch(statements);

      const saved = await context.env.DB.prepare(
        `select * from notifications where id in (${written.map(() => '?').join(', ')})`,
      )
        .bind(...written)
        .all<NotificationRow>();
      return json({ items: saved.results.map(notificationFromRow) }, { status: 201 });
    })

    // Read: one row, or the whole inbox.
    .post('/notifications/read', async (context) => {
      const principal = await requireUser(context);
      const { id, all } = await readJson<{ id?: string; all?: boolean }>(context.request);
      const at = nowIso();

      if (id) {
        const row = await context.env.DB.prepare('select * from notifications where id = ?').bind(id).first<NotificationRow>();
        if (!row) throw ApiError.notFound('NOTIFICATION_NOT_FOUND', 'That notification is no longer there.');
        if (!readable(principal, row)) throw ApiError.forbidden();
        await context.env.DB.prepare('update notifications set read_at = ?1, updated_at = ?1 where id = ?2 and read_at is null')
          .bind(at, id)
          .run();
      } else if (all) {
        const where = whereForReader(principal);
        await context.env.DB.prepare(`update notifications set read_at = ?1, updated_at = ?1 where read_at is null and ${where.sql}`)
          .bind(at, ...where.values)
          .run();
      }

      return json({ items: await inbox(context.env, principal, null) });
    })

    // The customer's answer to the evening reminder: keep tomorrow's order as it is, or change it.
    .post('/notifications/:id/response', async (context) => {
      const principal = await requireRole(context, 'customer');
      const id = context.params.id!;
      const { response } = await readJson<{ response?: string }>(context.request);
      if (response !== 'keep' && response !== 'change') throw ApiError.badRequest('RESPONSE_INVALID', 'Answer keep or change.');

      const row = await context.env.DB.prepare('select * from notifications where id = ?').bind(id).first<NotificationRow>();
      if (!row) throw ApiError.notFound('NOTIFICATION_NOT_FOUND', 'That notification is no longer there.');
      if (!readable(principal, row)) throw ApiError.forbidden();

      const at = nowIso();
      await context.env.DB.prepare(
        'update notifications set response = ?1, responded_at = ?2, read_at = coalesce(read_at, ?2), updated_at = ?2 where id = ?3',
      )
        .bind(response, at, id)
        .run();

      // The dairy reads one line a day with the answers so far, which this one changes.
      if (row.date_ymd) {
        const customer = row.customer_id
          ? await context.env.DB.prepare('select name from customers where id = ?').bind(row.customer_id).first<{ name: string }>()
          : null;
        await updateAnswersTally(context.env, row.date_ymd, { name: customer?.name, response });
      }

      const saved = await context.env.DB.prepare('select * from notifications where id = ?').bind(id).first<NotificationRow>();
      return json(notificationFromRow(saved!));
    });
}

/** True when this row is addressed to this reader. */
function readable(principal: Principal, row: NotificationRow): boolean {
  if (isDairy(principal.role)) return row.audience === 'Admin';
  if (principal.role === 'customer') return row.audience === 'Customer' && row.customer_id === principal.linkedRecordId;
  return row.audience === 'DeliveryBoy' && row.delivery_boy_id === principal.linkedRecordId;
}

/** The same question as SQL, for marking a whole inbox read. */
function whereForReader(principal: Principal): { sql: string; values: unknown[] } {
  if (isDairy(principal.role)) return { sql: "audience = 'Admin'", values: [] };
  const column = principal.role === 'customer' ? 'customer_id' : 'delivery_boy_id';
  const audience = principal.role === 'customer' ? 'Customer' : 'DeliveryBoy';
  return { sql: `audience = ? and ${column} = ?`, values: [audience, principal.linkedRecordId ?? ''] };
}
