import { requireRole, requireUser } from '@/auth/service';
import { newId, nowIso, pick } from '@/db';
import { ApiError, json, readJson, type Env, type Router } from '@/http';
import {
  packsToRows,
  productFromRow,
  productToRow,
  type PackRow,
  type Product,
  type ProductRow,
} from '@/products/mapping';

/** The catalog: what the admin keeps and the customer app offers. */

async function loadProducts(env: Env, where?: { id: string }): Promise<Product[]> {
  const rows = where
    ? await env.DB.prepare('select * from products where id = ?').bind(where.id).all<ProductRow>()
    : await env.DB.prepare('select * from products order by sort_order, name').all<ProductRow>();
  if (!rows.results.length) return [];

  const ids = rows.results.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(', ');
  const packs = await env.DB.prepare(`select * from product_packs where product_id in (${placeholders}) order by sort_order`)
    .bind(...ids)
    .all<PackRow>();

  const byProduct = new Map<string, PackRow[]>();
  for (const pack of packs.results) {
    const list = byProduct.get(pack.product_id) ?? [];
    list.push(pack);
    byProduct.set(pack.product_id, list);
  }
  return rows.results.map((row) => productFromRow(row, byProduct.get(row.id) ?? []));
}

async function getProduct(env: Env, id: string): Promise<Product> {
  const [product] = await loadProducts(env, { id });
  if (!product) throw ApiError.notFound('PRODUCT_NOT_FOUND', 'That product is no longer in the catalog.');
  return product;
}

/** Two products with the same name would be impossible to tell apart on a bill. */
async function assertNameFree(env: Env, name: string, exceptId?: string): Promise<void> {
  const row = await env.DB.prepare('select id from products where lower(name) = lower(?) and id != ?')
    .bind(name.trim(), exceptId ?? '')
    .first<{ id: string }>();
  if (row) throw ApiError.badRequest('PRODUCT_NAME_DUPLICATE', `A product called "${name.trim()}" already exists.`);
}

async function writeProduct(env: Env, product: Product, createdAt: string, updatedAt: string): Promise<void> {
  const row = productToRow(product);
  const packRows = packsToRows(product.id, product.packs);
  const statements = [
    env.DB.prepare(
      `insert into products (id, name, category, product_type, unit, description, image_key, availability, features_json,
         is_visible_to_customer, is_active, sort_order, price, discount_price, details_json, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do update set
         name = excluded.name, category = excluded.category, product_type = excluded.product_type, unit = excluded.unit,
         description = excluded.description, image_key = excluded.image_key, availability = excluded.availability,
         features_json = excluded.features_json, is_visible_to_customer = excluded.is_visible_to_customer,
         is_active = excluded.is_active, sort_order = excluded.sort_order, price = excluded.price,
         discount_price = excluded.discount_price, details_json = excluded.details_json, updated_at = excluded.updated_at`,
    ).bind(
      row.id,
      row.name,
      row.category,
      row.product_type,
      row.unit,
      row.description,
      row.image_key,
      row.availability,
      row.features_json,
      row.is_visible_to_customer,
      row.is_active,
      row.sort_order,
      row.price,
      row.discount_price,
      row.details_json,
      createdAt,
      updatedAt,
    ),
    // The packs sent are the packs there are: an old one that is gone was removed by the admin.
    env.DB.prepare('delete from product_packs where product_id = ?').bind(product.id),
    ...packRows.map((pack) =>
      env.DB.prepare(
        `insert into product_packs (id, product_id, label, unit, quantity, price, discount_price, sku, is_active, sort_order)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(pack.id, pack.product_id, pack.label, pack.unit, pack.quantity, pack.price, pack.discount_price, pack.sku, pack.is_active, pack.sort_order),
    ),
  ];
  await env.DB.batch(statements);
}

export function mountProducts(router: Router): Router {
  return router
    // Customers and delivery boys read the catalog; only the dairy writes it.
    .get('/products', async (context) => {
      await requireUser(context);
      return json({ items: await loadProducts(context.env) });
    })

    .get('/products/:id', async (context) => {
      await requireUser(context);
      return json(await getProduct(context.env, context.params.id!));
    })

    .post('/products', async (context) => {
      await requireRole(context, 'admin');
      const { env, request } = context;
      const body = await readJson<Product>(request);
      if (!String(body.name ?? '').trim()) throw ApiError.badRequest('PRODUCT_NAME_REQUIRED', 'Give the product a name.');
      await assertNameFree(env, String(body.name));
      const now = nowIso();
      const product: Product = { ...body, id: newId('prod'), createdAt: now, updatedAt: now };
      await writeProduct(env, product, now, now);
      return json(await getProduct(env, product.id), { status: 201 });
    })

    .patch('/products/:id', async (context) => {
      await requireRole(context, 'admin');
      const { env, params, request } = context;
      const id = params.id!;
      const current = await getProduct(env, id);
      const patch = await readJson<Partial<Product>>(request);
      const name = String(pick(patch.name, current.name)).trim();
      if (!name) throw ApiError.badRequest('PRODUCT_NAME_REQUIRED', 'Give the product a name.');
      await assertNameFree(env, name, id);
      const now = nowIso();
      // A patch replaces only what it carries; `packs` is all-or-nothing, as the form sends the whole list.
      const merged: Product = { ...current, ...patch, name, id, createdAt: current.createdAt, updatedAt: now };
      await writeProduct(env, merged, String(current.createdAt), now);
      return json(await getProduct(env, id));
    })

    .delete('/products/:id', async (context) => {
      await requireRole(context, 'admin');
      const { env, params } = context;
      const id = params.id!;
      // A product on someone's subscription stays in the catalog, inactive, so old bills still read. Plan lines
      // carry the product's name (that is what the bill shows), so both the id and the name are checked.
      const product = await getProduct(env, id);
      const inUse = await env.DB.prepare(
        `select
           (select count(*) from subscription_plans where product_id = ?1 or lower(product_name) = lower(?2))
           + (select count(*) from extra_orders where status = 'Pending' and lower(product_name) = lower(?2)) as used`,
      )
        .bind(id, String(product.name))
        .first<{ used: number }>();
      if ((inUse?.used ?? 0) > 0) {
        throw ApiError.badRequest('PRODUCT_IN_USE', 'Customers still subscribe to this product. Make it inactive instead.');
      }
      await env.DB.prepare('delete from products where id = ?').bind(id).run();
      return new Response(null, { status: 204 });
    });
}
