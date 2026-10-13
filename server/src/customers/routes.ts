import { forgetLogin, matchLoginToRecord, moveLogin } from '@/auth/pin';
import {
  customerFromRow,
  customerToRow,
  planToRow,
  type Customer,
  type CustomerRow,
  type Plan,
  type PlanRow,
} from '@/customers/mapping';
import {
  deliveryToRow,
  exceptionToRow,
  extraOrderToRow,
  paymentRequestToRow,
  paymentToRow,
  type DeliveryRow,
  type ExceptionRow,
  type ExtraOrderRow,
  type PaymentRequestRow,
  type PaymentRow,
  type Row,
} from '@/customers/operational';
import { requireRole, requireUser, type Principal } from '@/auth/service';
import { newId, nowIso, pick } from '@/db';
import { ApiError, json, readJson, type Env, type Router } from '@/http';
import { claimsByCustomer } from '@/offers/claims';
import { offerFromRow, type OfferRow } from '@/offers/mapping';
import { getCustomer, loadCustomers } from '@/customers/read';
import { customerSelfPatch, type CatalogPack, type SelfServiceContext } from '@/customers/selfService';

/** Customers: their profile, address, billing settings and subscription lines. */

/** One mobile number, one customer: it is how they sign in. */
async function assertMobileFree(env: Env, mobile: string, exceptId?: string): Promise<void> {
  const clash = await env.DB.prepare(
    'select (select count(*) from customers where mobile = ?1 and id != ?2)' +
      ' + (select count(*) from delivery_boys where mobile = ?1) as used',
  )
    .bind(mobile.trim(), exceptId ?? '')
    .first<{ used: number }>();
  if ((clash?.used ?? 0) > 0) {
    throw ApiError.badRequest('CUSTOMER_MOBILE_EXISTS', 'Somebody else at the dairy already uses this mobile number.');
  }
}

function assertRequiredFields(customer: Partial<Customer>): void {
  if (!String(customer.name ?? '').trim()) throw ApiError.badRequest('CUSTOMER_NAME_REQUIRED', 'Enter the customer’s name.');
  if (!/^\d{10}$/.test(String(customer.mobile ?? '').trim())) {
    throw ApiError.badRequest('CUSTOMER_MOBILE_INVALID', 'Enter a valid 10-digit mobile number.');
  }
}

/**
 * The lists the apps keep on a customer, and where each one is stored. A list that is sent replaces what was
 * there (the way the on-phone version has always worked); a list left out is untouched.
 */
const HISTORY = [
  {
    key: 'deliveries',
    table: 'deliveries',
    toRow: deliveryToRow,
    columns:
      'id, customer_id, delivery_ymd, product_name, pack_label, status, subscription_items, missed_reason, marked_by, delivery_boy_id, created_at, updated_at',
  },
  {
    key: 'extraOrders',
    table: 'extra_orders',
    toRow: extraOrderToRow,
    columns:
      'id, customer_id, delivery_ymd, product_name, pack_label, pack_id, number_of_items, price, status, offer_id, offer_title_en, offer_title_mr, offer_list_price, combo_items_json, placed_by, created_at, updated_at',
  },
  {
    key: 'subscriptionExceptions',
    table: 'subscription_exceptions',
    toRow: exceptionToRow,
    columns: 'id, customer_id, plan_id, kind, from_ymd, to_ymd, number_of_items, reason, created_by, created_at, updated_at',
  },
  {
    key: 'payments',
    table: 'payments',
    toRow: paymentToRow,
    columns: 'id, customer_id, payment_date, amount, mode, transaction_id, collected_by, notes, created_at, updated_at',
  },
  {
    key: 'paymentRequests',
    table: 'payment_requests',
    toRow: paymentRequestToRow,
    columns:
      'id, customer_id, amount, method, reference, paid_on_ymd, note, status, payment_id, review_note, reviewed_at, created_at, updated_at',
  },
] as const satisfies readonly { key: keyof Customer & string; table: string; toRow: (id: string, row: Row, now: string) => object; columns: string }[];

async function writeCustomer(env: Env, customer: Customer, createdAt: string, updatedAt: string, plans: Plan[] | undefined): Promise<void> {
  const row = customerToRow(customer);
  const statements = [
    env.DB.prepare(
      `insert into customers (id, name, mobile, alternate_mobile, date_of_birth, flat_no, society_name, street, landmark,
         city, pincode, map_link, full_address, route_name, delivery_boy_id, delivery_time, billing_type,
         billing_cycle_date, discount_amount, app_access_enabled, status, subscription_start_date, notes, details_json,
         created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do update set
         name = excluded.name, mobile = excluded.mobile, alternate_mobile = excluded.alternate_mobile,
         date_of_birth = excluded.date_of_birth, flat_no = excluded.flat_no, society_name = excluded.society_name,
         street = excluded.street, landmark = excluded.landmark, city = excluded.city, pincode = excluded.pincode,
         map_link = excluded.map_link, full_address = excluded.full_address, route_name = excluded.route_name,
         delivery_boy_id = excluded.delivery_boy_id, delivery_time = excluded.delivery_time,
         billing_type = excluded.billing_type, billing_cycle_date = excluded.billing_cycle_date,
         discount_amount = excluded.discount_amount, app_access_enabled = excluded.app_access_enabled,
         status = excluded.status, subscription_start_date = excluded.subscription_start_date, notes = excluded.notes,
         details_json = excluded.details_json, updated_at = excluded.updated_at`,
    ).bind(
      row.id,
      row.name,
      row.mobile,
      row.alternate_mobile,
      row.date_of_birth,
      row.flat_no,
      row.society_name,
      row.street,
      row.landmark,
      row.city,
      row.pincode,
      row.map_link,
      row.full_address,
      row.route_name,
      row.delivery_boy_id,
      row.delivery_time,
      row.billing_type,
      row.billing_cycle_date,
      row.discount_amount,
      row.app_access_enabled,
      row.status,
      row.subscription_start_date,
      row.notes,
      row.details_json,
      createdAt,
      updatedAt,
    ),
  ];

  // Switching a customer off — by status or by the app-access switch — reaches a phone already signed in.
  if (customer.mobile) {
    statements.push(
      matchLoginToRecord(env, String(customer.mobile), row.status !== 'Inactive' && row.app_access_enabled !== 0, updatedAt),
    );
  }

  // Plans are sent whole or not at all: a profile edit leaves them alone, the subscription tab replaces them.
  if (plans) {
    const planRows = plans.map((plan) => planToRow(customer.id, { ...plan, id: plan.id || newId('sub') }, updatedAt));
    statements.push(env.DB.prepare('delete from subscription_plans where customer_id = ?').bind(customer.id));
    for (const plan of planRows) {
      statements.push(
        env.DB.prepare(
          `insert into subscription_plans (id, customer_id, product_id, pack_id, product_name, pack_label, unit_type,
             number_of_items, frequency, delivery_time, start_date, end_date, open_ended, status, addition_tag,
             original_price, discounted_price, effective_price, notes, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          plan.id,
          plan.customer_id,
          plan.product_id,
          plan.pack_id,
          plan.product_name,
          plan.pack_label,
          plan.unit_type,
          plan.number_of_items,
          plan.frequency,
          plan.delivery_time,
          plan.start_date,
          plan.end_date,
          plan.open_ended,
          plan.status,
          plan.addition_tag,
          plan.original_price,
          plan.discounted_price,
          plan.effective_price,
          plan.notes,
          plan.created_at,
          plan.updated_at,
        ),
      );
    }
  }

  // Each list the request carried replaces that table's rows for this customer.
  for (const area of HISTORY) {
    const sent = customer[area.key];
    if (!Array.isArray(sent)) continue;
    statements.push(env.DB.prepare(`delete from ${area.table} where customer_id = ?`).bind(customer.id));
    for (const record of sent as Row[]) {
      const row = area.toRow(customer.id, record, updatedAt) as Record<string, unknown>;
      const names = area.columns.split(',').map((c) => c.trim());
      const values = names.map((name) => row[name] ?? null);
      statements.push(
        env.DB.prepare(`insert into ${area.table} (${area.columns}) values (${names.map(() => '?').join(', ')})`).bind(...values),
      );
    }
  }

  try {
    await env.DB.batch(statements);
  } catch (error) {
    // Ids come from the apps. One that another customer already holds would otherwise be an opaque 500.
    if (String(error).includes('UNIQUE constraint failed')) {
      throw ApiError.badRequest('RECORD_ID_IN_USE', 'Something in this record has an id that is already in use elsewhere.');
    }
    throw error;
  }
}

/**
 * What a customer’s own changes are checked against: the catalog’s prices, and the offers they may order on.
 * Read once per request, because every order in the patch is priced against them.
 */
async function selfServiceContext(env: Env, customerId: string): Promise<SelfServiceContext> {
  const [packs, offers, claims] = await Promise.all([
    env.DB.prepare(
      `select p.id as pack_id, p.label, p.price, p.discount_price, pr.name as product_name
         from product_packs p join products pr on pr.id = p.product_id`,
    ).all<{ pack_id: string; label: string; price: number; discount_price: number | null; product_name: string }>(),
    env.DB.prepare('select * from offers').all<OfferRow>(),
    env.DB.prepare('select offer_id from offer_claims where customer_id = ?').bind(customerId).all<{ offer_id: string }>(),
  ]);

  const catalog = new Map<string, CatalogPack>();
  for (const row of packs.results) {
    catalog.set(row.pack_id, {
      productName: row.product_name,
      packLabel: row.label,
      price: row.price,
      discountPrice: row.discount_price,
    });
  }

  return {
    now: new Date(),
    packs: catalog,
    offers: new Map(offers.results.map((row) => [row.id, offerFromRow(row)])),
    claimedOfferIds: new Set(claims.results.map((row) => row.offer_id)),
  };
}

/** A customer may open their own record; a delivery boy, the houses on their route; the dairy, everyone. */
async function assertMayRead(env: Env, principal: Principal, customer: Customer): Promise<void> {
  if (principal.role === 'admin') return;
  if (principal.role === 'customer' && customer.id === principal.linkedRecordId) return;
  if (principal.role === 'delivery_boy' && customer.assignedDeliveryBoyId === principal.linkedRecordId) return;
  throw ApiError.forbidden();
}

export function mountCustomers(router: Router): Router {
  return router
    // The dairy sees the whole list; a delivery boy only their own route.
    .get('/customers', async (context) => {
      const principal = await requireRole(context, 'admin', 'delivery_boy');
      const all = await loadCustomers(context.env);
      const items = principal.role === 'admin' ? all : all.filter((c) => c.assignedDeliveryBoyId === principal.linkedRecordId);
      return json({ items });
    })

    // The customer app's own record, without it having to know its id.
    .get('/me/customer', async (context) => {
      const principal = await requireRole(context, 'customer');
      if (!principal.linkedRecordId) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'No customer record for this number.');
      return json(await getCustomer(context.env, principal.linkedRecordId));
    })

    .get('/customers/:id', async (context) => {
      const principal = await requireUser(context);
      const customer = await getCustomer(context.env, context.params.id!);
      await assertMayRead(context.env, principal, customer);
      return json(customer);
    })

    .post('/customers', async (context) => {
      await requireRole(context, 'admin');
      const { env, request } = context;
      const body = await readJson<Customer>(request);
      assertRequiredFields(body);
      await assertMobileFree(env, String(body.mobile));
      const now = nowIso();
      const customer: Customer = { ...body, id: newId('cust'), createdAt: now, updatedAt: now };
      await writeCustomer(env, customer, now, now, body.subscriptionPlans ?? []);
      return json(await getCustomer(env, customer.id), { status: 201 });
    })

    .patch('/customers/:id', async (context) => {
      const principal = await requireRole(context, 'admin', 'customer');
      const { env, params, request } = context;
      const id = params.id!;
      // Checked before the record is even read, so another household’s id answers the same whether it exists or not.
      const self = principal.role === 'customer';
      if (self && id !== principal.linkedRecordId) throw ApiError.forbidden();
      const current = await getCustomer(env, id);
      const sent = await readJson<Partial<Customer>>(request);

      // A customer sends the lists back whole, like every app does — but only their own record, and only the
      // changes a customer may make (`selfService.ts`), rebuilt here from what is stored.
      const patch = self
        ? (customerSelfPatch(current, sent as Record<string, unknown>, await selfServiceContext(env, id)) as Partial<Customer>)
        : sent;
      const merged: Customer = { ...current, ...patch, id, createdAt: current.createdAt, updatedAt: nowIso() };
      assertRequiredFields(merged);
      if (patch.mobile !== undefined) await assertMobileFree(env, String(merged.mobile), id);
      // Their login goes with the number, so they stay signed in and keep the PIN they chose.
      if (current.mobile && merged.mobile) await moveLogin(env, String(current.mobile), String(merged.mobile));
      // Only the lists the patch actually carried are written; the merged record keeps the rest for the answer.
      const toWrite: Customer = { ...merged };
      for (const area of HISTORY) if (!Array.isArray(patch[area.key])) delete toWrite[area.key];
      await writeCustomer(env, toWrite, String(current.createdAt), String(merged.updatedAt), pick(patch.subscriptionPlans, undefined));
      return json(await getCustomer(env, id));
    })

    .delete('/customers/:id', async (context) => {
      await requireRole(context, 'admin');
      const { env, params } = context;
      const id = params.id!;
      const gone = await getCustomer(env, id);
      // Their plans, days, orders, deliveries and payments go with them (the tables cascade).
      await env.DB.prepare('delete from customers where id = ?').bind(id).run();
      // And so does their login, or they would keep signing in with the PIN they chose.
      if (gone.mobile) await forgetLogin(env, String(gone.mobile));
      return new Response(null, { status: 204 });
    });
}
