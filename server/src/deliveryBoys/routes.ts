import { forgetLogin } from '@/auth/pin';
import { requireRole, requireUser } from '@/auth/service';
import { newId, nowIso } from '@/db';
import {
  attendanceToRow,
  deliveryBoyFromRow,
  deliveryBoyToRow,
  withoutPrivateDetails,
  type AttendanceRow,
  type DeliveryBoy,
  type DeliveryBoyRow,
  type Row,
} from '@/deliveryBoys/mapping';
import { ApiError, json, readJson, type Env, type Router } from '@/http';

/** The delivery team: who they are, the routes they take, the days they worked, and what they are owed. */

async function loadBoys(env: Env, where?: { id: string }): Promise<DeliveryBoy[]> {
  const rows = where
    ? await env.DB.prepare('select * from delivery_boys where id = ?').bind(where.id).all<DeliveryBoyRow>()
    : await env.DB.prepare('select * from delivery_boys order by full_name').all<DeliveryBoyRow>();
  if (!rows.results.length) return [];

  const ids = rows.results.map((r) => r.id);
  const attendance = await env.DB.prepare(
    `select * from attendance where delivery_boy_id in (${ids.map(() => '?').join(', ')}) order by ymd`,
  )
    .bind(...ids)
    .all<AttendanceRow>();

  const byBoy = new Map<string, AttendanceRow[]>();
  for (const row of attendance.results) {
    const list = byBoy.get(row.delivery_boy_id) ?? [];
    list.push(row);
    byBoy.set(row.delivery_boy_id, list);
  }
  return rows.results.map((row) => deliveryBoyFromRow(row, byBoy.get(row.id) ?? []));
}

async function getBoy(env: Env, id: string): Promise<DeliveryBoy> {
  const [boy] = await loadBoys(env, { id });
  if (!boy) throw ApiError.notFound('DELIVERY_BOY_NOT_FOUND', 'That delivery boy is no longer on the team list.');
  return boy;
}

/** One mobile number, one person: it is how they sign in. */
async function assertMobileFree(env: Env, mobile: string, exceptId?: string): Promise<void> {
  const clash = await env.DB.prepare(
    'select (select count(*) from delivery_boys where mobile = ?1 and id != ?2) + (select count(*) from customers where mobile = ?1) as used',
  )
    .bind(mobile.trim(), exceptId ?? '')
    .first<{ used: number }>();
  if ((clash?.used ?? 0) > 0) throw ApiError.badRequest('MOBILE_IN_USE', 'Another person already uses this mobile number.');
}

function assertRequiredFields(boy: Partial<DeliveryBoy>): void {
  if (!String(boy.fullName ?? '').trim()) throw ApiError.badRequest('DELIVERY_BOY_NAME_REQUIRED', 'Enter the delivery boy’s name.');
  if (!/^\d{10}$/.test(String(boy.mobileNumber ?? '').trim())) {
    throw ApiError.badRequest('DELIVERY_BOY_MOBILE_INVALID', 'Enter a valid 10-digit mobile number.');
  }
}

async function writeBoy(env: Env, boy: DeliveryBoy, createdAt: string, updatedAt: string, attendance: Row[] | undefined): Promise<void> {
  const row = deliveryBoyToRow(boy);
  const statements = [
    env.DB.prepare(
      `insert into delivery_boys (id, full_name, mobile, alternate_mobile, primary_route_name, additional_route_name,
         joining_date, last_working_date, status, salary_type, monthly_salary, per_day_salary, app_access_enabled,
         photo_key, details_json, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do update set
         full_name = excluded.full_name, mobile = excluded.mobile, alternate_mobile = excluded.alternate_mobile,
         primary_route_name = excluded.primary_route_name, additional_route_name = excluded.additional_route_name,
         joining_date = excluded.joining_date, last_working_date = excluded.last_working_date, status = excluded.status,
         salary_type = excluded.salary_type, monthly_salary = excluded.monthly_salary,
         per_day_salary = excluded.per_day_salary, app_access_enabled = excluded.app_access_enabled,
         photo_key = excluded.photo_key, details_json = excluded.details_json, updated_at = excluded.updated_at`,
    ).bind(
      row.id,
      row.full_name,
      row.mobile,
      row.alternate_mobile,
      row.primary_route_name,
      row.additional_route_name,
      row.joining_date,
      row.last_working_date,
      row.status,
      row.salary_type,
      row.monthly_salary,
      row.per_day_salary,
      row.app_access_enabled,
      row.photo_key,
      row.details_json,
      createdAt,
      updatedAt,
    ),
  ];

  // Attendance arrives whole, like the other lists: what is sent is what the month has.
  if (attendance) {
    // A day can be marked as covering for someone — that someone has to be on the team.
    const coverIds = [...new Set(attendance.map((entry) => String(entry.coverForDeliveryBoyId ?? '')).filter(Boolean))];
    if (coverIds.length) {
      const found = await env.DB.prepare(`select id from delivery_boys where id in (${coverIds.map(() => '?').join(', ')})`)
        .bind(...coverIds)
        .all<{ id: string }>();
      const known = new Set(found.results.map((r) => r.id));
      const missing = coverIds.filter((id) => !known.has(id));
      if (missing.length) {
        throw ApiError.badRequest('COVER_PERSON_NOT_FOUND', 'A day is marked as covering for someone who is not on the team.', { missing });
      }
    }
    statements.push(env.DB.prepare('delete from attendance where delivery_boy_id = ?').bind(boy.id));
    for (const entry of attendance) {
      const a = attendanceToRow(boy.id, entry, updatedAt);
      statements.push(
        env.DB.prepare(
          `insert into attendance (id, delivery_boy_id, ymd, status, cover_for_id, notes, remarks, marked_by, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(a.id, a.delivery_boy_id, a.ymd, a.status, a.cover_for_id, a.notes, a.remarks, a.marked_by, a.created_at, a.updated_at),
      );
    }
  }

  await env.DB.batch(statements);
}

export function mountDeliveryBoys(router: Router): Router {
  return router
    // The dairy sees the team in full; a delivery boy sees the names, routes and rates salary needs — not
    // a colleague's bank details, Aadhaar or address.
    .get('/delivery-boys', async (context) => {
      const principal = await requireRole(context, 'admin', 'delivery_boy');
      const items = await loadBoys(context.env);
      return json({ items: principal.role === 'admin' ? items : items.map(withoutPrivateDetails) });
    })

    .get('/me/delivery-boy', async (context) => {
      const principal = await requireRole(context, 'delivery_boy');
      if (!principal.linkedRecordId) throw ApiError.notFound('DELIVERY_BOY_NOT_FOUND', 'No delivery boy record for this number.');
      return json(await getBoy(context.env, principal.linkedRecordId));
    })

    .get('/delivery-boys/:id', async (context) => {
      const principal = await requireUser(context);
      const boy = await getBoy(context.env, context.params.id!);
      if (principal.role === 'admin') return json(boy);
      if (principal.role === 'delivery_boy') return json(boy.id === principal.linkedRecordId ? boy : withoutPrivateDetails(boy));
      throw ApiError.forbidden();
    })

    .post('/delivery-boys', async (context) => {
      await requireRole(context, 'admin');
      const body = await readJson<DeliveryBoy>(context.request);
      assertRequiredFields(body);
      await assertMobileFree(context.env, String(body.mobileNumber));
      const now = nowIso();
      const boy: DeliveryBoy = { ...body, id: newId('db'), createdAt: now, updatedAt: now };
      await writeBoy(context.env, boy, now, now, (body.attendance as Row[]) ?? []);
      return json(await getBoy(context.env, boy.id), { status: 201 });
    })

    .patch('/delivery-boys/:id', async (context) => {
      // A delivery boy may mark their own attendance; everything else about the record is the dairy's.
      const principal = await requireRole(context, 'admin', 'delivery_boy');
      const id = context.params.id!;
      const current = await getBoy(context.env, id);
      const patch = await readJson<Partial<DeliveryBoy>>(context.request);

      if (principal.role === 'delivery_boy') {
        if (id !== principal.linkedRecordId) throw ApiError.forbidden();
        const allowed = ['attendance'];
        const touched = Object.keys(patch).filter((key) => !allowed.includes(key));
        if (touched.length) throw ApiError.forbidden('Only the dairy can change this.');
      }

      const merged: DeliveryBoy = { ...current, ...patch, id, createdAt: current.createdAt, updatedAt: nowIso() };
      assertRequiredFields(merged);
      if (patch.mobileNumber !== undefined) await assertMobileFree(context.env, String(merged.mobileNumber), id);
      await writeBoy(
        context.env,
        merged,
        String(current.createdAt),
        String(merged.updatedAt),
        Array.isArray(patch.attendance) ? (patch.attendance as Row[]) : undefined,
      );
      return json(await getBoy(context.env, id));
    })

    .delete('/delivery-boys/:id', async (context) => {
      await requireRole(context, 'admin');
      const id = context.params.id!;
      const gone = await getBoy(context.env, id);
      const onRoute = await customersOnRoute(context.env, id);
      if (onRoute > 0) {
        throw ApiError.badRequest('DELIVERY_BOY_HAS_CUSTOMERS', 'Move this route’s customers to someone else first.');
      }
      await context.env.DB.prepare('delete from delivery_boys where id = ?').bind(id).run();
      // And their login with them, or they would keep signing in with the PIN they chose.
      if (gone.mobileNumber) await forgetLogin(context.env, String(gone.mobileNumber));
      return new Response(null, { status: 204 });
    });
}

/** Houses still assigned to this delivery boy. */
async function customersOnRoute(env: Env, boyId: string): Promise<number> {
  const row = await env.DB.prepare('select count(*) as assigned from customers where delivery_boy_id = ?').bind(boyId).first<{ assigned: number }>();
  return row?.assigned ?? 0;
}
