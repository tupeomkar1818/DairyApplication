import { forgetLogin, matchLoginToRecord, moveLogin } from '@/auth/pin';
import { requireRole, type Role } from '@/auth/service';
import { newId, nowIso } from '@/db';
import { ApiError, json, readJson, type Env, type Router } from '@/http';

/**
 * The people who work here: the desk, and the managers.
 *
 * A **desk user** is a record the dairy keeps, like a delivery boy — a name, a number, which counter they stand
 * at — and their login is made the first time they sign in. An **admin** is only a login: there is nothing about
 * a manager to keep but the fact that they are one.
 *
 * Both are the owner's to add and remove, which is the whole point of there being an owner.
 */

export type DeskUser = {
  id: string;
  fullName: string;
  mobile: string;
  status: string;
  appAccessEnabled: boolean;
  counterName: string;
  createdAt: string;
  updatedAt: string;
};

type DeskRow = {
  id: string;
  full_name: string;
  mobile: string;
  status: string;
  app_access_enabled: number;
  counter_name: string;
  created_at: string;
  updated_at: string;
};

function deskFromRow(row: DeskRow): DeskUser {
  return {
    id: row.id,
    fullName: row.full_name,
    mobile: row.mobile,
    status: row.status,
    appAccessEnabled: row.app_access_enabled !== 0,
    counterName: row.counter_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Nobody at the dairy may share a number: it is what signs them in, so two people on one number is two people in one app. */
async function assertMobileFree(env: Env, mobile: string, exceptId?: string): Promise<void> {
  const clash = await env.DB.prepare(
    `select (select count(*) from desk_users where mobile = ?1 and id != ?2)
          + (select count(*) from customers where mobile = ?1)
          + (select count(*) from delivery_boys where mobile = ?1)
          + (select count(*) from users where mobile = ?1 and role in ('super_admin', 'admin')) as used`,
  )
    .bind(mobile.trim(), exceptId ?? '')
    .first<{ used: number }>();
  if ((clash?.used ?? 0) > 0) throw ApiError.badRequest('MOBILE_IN_USE', 'Somebody else at the dairy already uses this mobile number.');
}

function assertRequired(body: Partial<DeskUser>): void {
  if (!String(body.fullName ?? '').trim()) throw ApiError.badRequest('DESK_USER_NAME_REQUIRED', 'Enter their name.');
  if (!/^\d{10}$/.test(String(body.mobile ?? '').trim())) {
    throw ApiError.badRequest('DESK_USER_MOBILE_INVALID', 'Enter a valid 10-digit mobile number.');
  }
}

async function getDesk(env: Env, id: string): Promise<DeskUser> {
  const row = await env.DB.prepare('select * from desk_users where id = ?').bind(id).first<DeskRow>();
  if (!row) throw ApiError.notFound('DESK_USER_NOT_FOUND', 'No desk user with that id.');
  return deskFromRow(row);
}

export function mountStaff(router: Router): Router {
  return router
    .get('/desk-users', async (context) => {
      // A desk user may read the list to know who else is on, but only the owner changes it.
      await requireRole(context, 'admin', 'desk');
      const rows = await context.env.DB.prepare('select * from desk_users order by full_name').all<DeskRow>();
      return json({ items: rows.results.map(deskFromRow) });
    })

    .post('/desk-users', async (context) => {
      await requireRole(context, 'super_admin');
      const body = await readJson<Partial<DeskUser>>(context.request);
      assertRequired(body);
      const mobile = String(body.mobile).trim();
      await assertMobileFree(context.env, mobile);

      const at = nowIso();
      const id = newId('desk');
      await context.env.DB.prepare(
        `insert into desk_users (id, full_name, mobile, status, app_access_enabled, counter_name, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          String(body.fullName).trim(),
          mobile,
          String(body.status ?? 'Active'),
          body.appAccessEnabled === false ? 0 : 1,
          String(body.counterName ?? ''),
          at,
          at,
        )
        .run();
      return json(await getDesk(context.env, id), { status: 201 });
    })

    .patch('/desk-users/:id', async (context) => {
      await requireRole(context, 'super_admin');
      const id = context.params.id!;
      const current = await getDesk(context.env, id);
      const patch = await readJson<Partial<DeskUser>>(context.request);
      const merged = { ...current, ...patch };
      assertRequired(merged);

      const mobile = String(merged.mobile).trim();
      if (mobile !== current.mobile) {
        await assertMobileFree(context.env, mobile, id);
        await moveLogin(context.env, current.mobile, mobile);
      }

      const at = nowIso();
      await context.env.DB.prepare(
        `update desk_users set full_name = ?, mobile = ?, status = ?, app_access_enabled = ?, counter_name = ?, updated_at = ?
         where id = ?`,
      )
        .bind(
          String(merged.fullName).trim(),
          mobile,
          String(merged.status ?? 'Active'),
          merged.appAccessEnabled === false ? 0 : 1,
          String(merged.counterName ?? ''),
          at,
          id,
        )
        .run();

      // Switching somebody off has to reach the phone they are already signed in on.
      await matchLoginToRecord(context.env, mobile, merged.status !== 'Inactive' && merged.appAccessEnabled !== false, at).run();
      return json(await getDesk(context.env, id));
    })

    .delete('/desk-users/:id', async (context) => {
      await requireRole(context, 'super_admin');
      const id = context.params.id!;
      const gone = await getDesk(context.env, id);
      // Their sales stay: the day's takings are the dairy's record, not theirs. The lines keep the name that was
      // on the bill (`sold_by_name`), so a removed person's sales still read as theirs.
      await context.env.DB.prepare('delete from desk_users where id = ?').bind(id).run();
      await forgetLogin(context.env, gone.mobile);
      return new Response(null, { status: 204 });
    })

    // --- the managers -------------------------------------------------------------------------------------------

    .get('/admins', async (context) => {
      await requireRole(context, 'super_admin');
      const rows = await context.env.DB.prepare(
        "select id, mobile, display_name, role, status, created_at from users where role in ('super_admin', 'admin') order by role, display_name",
      ).all<{ id: string; mobile: string; display_name: string; role: Role; status: string; created_at: string }>();
      return json({
        items: rows.results.map((r) => ({
          id: r.id,
          mobile: r.mobile,
          name: r.display_name,
          role: r.role,
          status: r.status,
          createdAt: r.created_at,
          /** The owner's own login cannot be removed — there would be nobody left who could add one. */
          removable: r.role !== 'super_admin',
        })),
      });
    })

    .post('/admins', async (context) => {
      await requireRole(context, 'super_admin');
      const body = await readJson<{ name?: string; mobile?: string }>(context.request);
      const mobile = String(body.mobile ?? '').trim();
      if (!String(body.name ?? '').trim()) throw ApiError.badRequest('ADMIN_NAME_REQUIRED', 'Enter their name.');
      if (!/^\d{10}$/.test(mobile)) throw ApiError.badRequest('ADMIN_MOBILE_INVALID', 'Enter a valid 10-digit mobile number.');
      await assertMobileFree(context.env, mobile);

      // A manager is only a login, so it is made now rather than on first sign-in: there is no record to make it
      // from. They sign in with their own number, like everybody else, and choose a PIN.
      const at = nowIso();
      const id = newId('user');
      await context.env.DB.prepare(
        "insert into users (id, mobile, role, display_name, status, created_at, updated_at) values (?, ?, 'admin', ?, 'Active', ?, ?)",
      )
        .bind(id, mobile, String(body.name).trim(), at, at)
        .run();
      return json({ id, mobile, name: String(body.name).trim(), role: 'admin', status: 'Active', createdAt: at, removable: true }, { status: 201 });
    })

    .delete('/admins/:id', async (context) => {
      const principal = await requireRole(context, 'super_admin');
      const id = context.params.id!;
      if (id === principal.userId) throw ApiError.badRequest('CANNOT_REMOVE_SELF', 'You cannot remove your own login.');
      const row = await context.env.DB.prepare("select id, role from users where id = ? and role in ('super_admin', 'admin')")
        .bind(id)
        .first<{ id: string; role: Role }>();
      if (!row) throw ApiError.notFound('ADMIN_NOT_FOUND', 'No manager with that id.');
      if (row.role === 'super_admin') throw ApiError.badRequest('CANNOT_REMOVE_OWNER', "The dairy's own login cannot be removed.");
      await context.env.DB.prepare('delete from users where id = ?').bind(id).run();
      return new Response(null, { status: 204 });
    });
}
