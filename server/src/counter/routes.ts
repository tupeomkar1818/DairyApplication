import { requireRole } from '@/auth/service';
import { newId, nowIso, todayInIndia } from '@/db';
import { countSale, paymentWay } from '@/counter/totals';
import { ApiError, json, readJson, type Env, type Router } from '@/http';


/**
 * Sales rung up at the counter.
 *
 * Somebody walks in, takes what they want and pays for it there — so a counter sale is finished the moment it is
 * made. It never reaches a customer's monthly bill, and it must not: the billing engine works out what a
 * subscription owes, and money already in the till would be charged a second time.
 *
 * What is written down is what was on the paper bill. Product names and prices are **copied onto each line**, not
 * pointed at: re-pricing the milk next month cannot be allowed to rewrite a receipt somebody is holding.
 */

export type SaleLineInput = {
  productId?: string;
  packId?: string;
  productName?: string;
  packLabel?: string;
  quantity?: number;
  unitPrice?: number;
};

export type SaleInput = {
  lines?: SaleLineInput[];
  discount?: number;
  paidBy?: string;
  note?: string;
  customerId?: string;
  customerName?: string;
  customerMobile?: string;
  /** The phone's own id for this sale, so a sale sent twice is only rung up once (see below). */
  clientRef?: string;
};

type SaleRow = {
  id: string;
  sale_no: string;
  ymd: string;
  sold_at: string;
  desk_user_id: string | null;
  sold_by_name: string;
  customer_id: string | null;
  customer_name: string;
  customer_mobile: string;
  items_total: number;
  discount: number;
  total: number;
  paid_by: string;
  note: string;
  printed_at: string | null;
  details_json: string;
  created_at: string;
  updated_at: string;
};

type LineRow = {
  id: string;
  sale_id: string;
  line_no: number;
  product_id: string | null;
  pack_id: string | null;
  product_name: string;
  pack_label: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type Sale = ReturnType<typeof saleFromRows>;

function saleFromRows(row: SaleRow, lines: LineRow[]) {
  return {
    id: row.id,
    saleNo: row.sale_no,
    ymd: row.ymd,
    soldAt: row.sold_at,
    deskUserId: row.desk_user_id ?? undefined,
    soldByName: row.sold_by_name,
    customerId: row.customer_id ?? undefined,
    customerName: row.customer_name,
    customerMobile: row.customer_mobile,
    itemsTotal: row.items_total,
    discount: row.discount,
    total: row.total,
    paidBy: row.paid_by,
    note: row.note,
    printedAt: row.printed_at ?? undefined,
    clientRef: (JSON.parse(row.details_json || '{}') as { clientRef?: string }).clientRef,
    lines: lines
      .sort((a, b) => a.line_no - b.line_no)
      .map((l) => ({
        productId: l.product_id ?? undefined,
        packId: l.pack_id ?? undefined,
        productName: l.product_name,
        packLabel: l.pack_label,
        quantity: l.quantity,
        unitPrice: l.unit_price,
        lineTotal: l.line_total,
      })),
  };
}

async function loadSales(env: Env, where: string, binds: unknown[]): Promise<Sale[]> {
  const rows = await env.DB.prepare(`select * from counter_sales ${where}`)
    .bind(...binds)
    .all<SaleRow>();
  if (!rows.results.length) return [];
  const ids = rows.results.map((r) => r.id);
  const lines = await env.DB.prepare(`select * from counter_sale_lines where sale_id in (${ids.map(() => '?').join(', ')})`)
    .bind(...ids)
    .all<LineRow>();
  const bySale = new Map<string, LineRow[]>();
  for (const line of lines.results) {
    const list = bySale.get(line.sale_id) ?? [];
    list.push(line);
    bySale.set(line.sale_id, list);
  }
  return rows.results.map((r) => saleFromRows(r, bySale.get(r.id) ?? []));
}


/**
 * The next number for today, as it will read on the bill: 001, 002…
 *
 * Counted from what is already stored rather than held in memory, so two phones at two counters cannot both think
 * they are 007. The unique index on (ymd, sale_no) is what actually decides it; this only has to be right nearly
 * always, and the retry above handles the rest.
 */
async function nextSaleNo(env: Env, ymd: string): Promise<string> {
  const row = await env.DB.prepare('select count(*) as n from counter_sales where ymd = ?').bind(ymd).first<{ n: number }>();
  return String((row?.n ?? 0) + 1).padStart(3, '0');
}

export function mountCounter(router: Router): Router {
  return router
    /**
     * Rings up a sale.
     *
     * A desk sells; the dairy may also ring one up itself. The total is worked out here from the lines, never
     * taken from the phone: a bill is an amount of money, and the only copy of it that matters is the server's.
     */
    .post('/counter/sales', async (context) => {
      const principal = await requireRole(context, 'desk', 'admin');
      const { env } = context;
      const body = await readJson<SaleInput>(context.request);

      const counted = countSale(body.lines ?? [], body.discount);

      // Sending the same sale twice — a tap that looked like it failed, or a phone catching up after a dead spot —
      // must not take the money twice. The phone's own id for the sale is what tells them apart.
      const clientRef = String(body.clientRef ?? '').trim();
      if (clientRef) {
        const already = await loadSales(env, "where json_extract(details_json, '$.clientRef') = ? limit 1", [clientRef]);
        if (already.length) return json(already[0]);
      }

      const prepared = counted.lines.map((line) => ({ ...line, id: newId('cline') }));
      const { itemsTotal, discount, total } = counted;
      const paidBy = paymentWay(body.paidBy);

      // Whose sale it is. The name is copied so the bill still reads right if they leave the dairy later.
      let deskUserId: string | null = null;
      let soldByName = '';
      if (principal.role === 'desk') {
        deskUserId = principal.linkedRecordId ?? null;
        const me = deskUserId
          ? await env.DB.prepare('select full_name from desk_users where id = ?').bind(deskUserId).first<{ full_name: string }>()
          : null;
        soldByName = me?.full_name ?? '';
      } else {
        const me = await env.DB.prepare('select display_name from users where id = ?').bind(principal.userId).first<{ display_name: string }>();
        soldByName = me?.display_name ?? '';
      }

      // A walk-in has no record; a regular who bought at the counter can be pointed at theirs, for their history.
      let customerId: string | null = null;
      let customerName = String(body.customerName ?? '').trim();
      let customerMobile = String(body.customerMobile ?? '').trim();
      if (body.customerId) {
        const customer = await env.DB.prepare('select id, name, mobile from customers where id = ?')
          .bind(body.customerId)
          .first<{ id: string; name: string; mobile: string }>();
        if (!customer) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'No customer with that id.');
        customerId = customer.id;
        customerName = customer.name;
        customerMobile = customer.mobile;
      }

      const at = nowIso();
      const ymd = todayInIndia();
      const id = newId('sale');

      // Two counters can reach for the same number at the same moment; the unique index refuses the second, and
      // it simply takes the next one. Three goes is far more than a dairy will ever need.
      let saved: Sale | null = null;
      for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
        const saleNo = await nextSaleNo(env, ymd);
        try {
          await env.DB.batch([
            env.DB.prepare(
              `insert into counter_sales (id, sale_no, ymd, sold_at, desk_user_id, sold_by_name, customer_id, customer_name,
                 customer_mobile, items_total, discount, total, paid_by, note, details_json, created_at, updated_at)
               values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).bind(
              id,
              saleNo,
              ymd,
              at,
              deskUserId,
              soldByName,
              customerId,
              customerName,
              customerMobile,
              itemsTotal,
              discount,
              total,
              paidBy,
              String(body.note ?? ''),
              JSON.stringify(clientRef ? { clientRef } : {}),
              at,
              at,
            ),
            ...prepared.map((l) =>
              env.DB.prepare(
                `insert into counter_sale_lines (id, sale_id, line_no, product_id, pack_id, product_name, pack_label,
                   quantity, unit_price, line_total)
                 values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              ).bind(l.id, id, l.lineNo, l.productId, l.packId, l.productName, l.packLabel, l.quantity, l.unitPrice, l.lineTotal),
            ),
          ]);
          const [stored] = await loadSales(env, 'where id = ?', [id]);
          saved = stored ?? null;
        } catch (error) {
          const message = String((error as Error)?.message ?? '');
          if (!/UNIQUE|constraint/i.test(message) || attempt === 2) throw error;
        }
      }
      if (!saved) throw new ApiError(500, 'SALE_NOT_SAVED', 'The sale could not be saved. Please try again.');
      return json(saved, { status: 201 });
    })

    /** Says the bill came out of the printer, so the desk can see which ones did not. */
    .post('/counter/sales/:id/printed', async (context) => {
      await requireRole(context, 'desk', 'admin');
      const id = context.params.id!;
      const at = nowIso();
      const done = await context.env.DB.prepare('update counter_sales set printed_at = ?, updated_at = ? where id = ?')
        .bind(at, at, id)
        .run();
      if (!done.meta.changes) throw ApiError.notFound('SALE_NOT_FOUND', 'No sale with that id.');
      const [sale] = await loadSales(context.env, 'where id = ?', [id]);
      return json(sale);
    })

    /**
     * A day's sales. The desk sees its own; the dairy sees everybody's, which is what the day's takings are.
     */
    .get('/counter/sales', async (context) => {
      const principal = await requireRole(context, 'desk', 'admin');
      const ymd = String(new URL(context.request.url).searchParams.get('ymd') ?? '').slice(0, 10) || todayInIndia();
      const mine = principal.role === 'desk';
      const sales = mine
        ? await loadSales(context.env, 'where ymd = ? and desk_user_id = ? order by sold_at desc', [ymd, principal.linkedRecordId ?? ''])
        : await loadSales(context.env, 'where ymd = ? order by sold_at desc', [ymd]);
      return json({ ymd, items: sales });
    })

    /**
     * What the counter took, for the dairy's own screen.
     *
     * Kept apart from the subscription money on purpose: the round and the counter are two different trades, and
     * adding them up into one figure would hide which of them is paying for the dairy.
     */
    .get('/counter/day', async (context) => {
      await requireRole(context, 'admin');
      const params = new URL(context.request.url).searchParams;
      const from = String(params.get('from') ?? '').slice(0, 10) || String(params.get('ymd') ?? '').slice(0, 10) || todayInIndia();
      const to = String(params.get('to') ?? '').slice(0, 10) || from;

      const totals = await context.env.DB.prepare(
        `select count(*) as sales,
                coalesce(sum(total), 0) as total,
                coalesce(sum(case when paid_by = 'Cash' then total else 0 end), 0) as cash,
                coalesce(sum(case when paid_by = 'UPI' then total else 0 end), 0) as upi,
                coalesce(sum(discount), 0) as discount
           from counter_sales where ymd between ? and ?`,
      )
        .bind(from, to)
        .first<{ sales: number; total: number; cash: number; upi: number; discount: number }>();

      const byDesk = await context.env.DB.prepare(
        `select desk_user_id, sold_by_name, count(*) as sales, coalesce(sum(total), 0) as total
           from counter_sales where ymd between ? and ?
          group by desk_user_id, sold_by_name order by total desc`,
      )
        .bind(from, to)
        .all<{ desk_user_id: string | null; sold_by_name: string; sales: number; total: number }>();

      const byProduct = await context.env.DB.prepare(
        `select l.product_name, l.pack_label, sum(l.quantity) as quantity, sum(l.line_total) as total
           from counter_sale_lines l join counter_sales s on s.id = l.sale_id
          where s.ymd between ? and ?
          group by l.product_name, l.pack_label order by total desc`,
      )
        .bind(from, to)
        .all<{ product_name: string; pack_label: string; quantity: number; total: number }>();

      return json({
        from,
        to,
        sales: totals?.sales ?? 0,
        total: totals?.total ?? 0,
        cash: totals?.cash ?? 0,
        upi: totals?.upi ?? 0,
        discount: totals?.discount ?? 0,
        byDesk: byDesk.results.map((r) => ({ deskUserId: r.desk_user_id ?? undefined, name: r.sold_by_name, sales: r.sales, total: r.total })),
        byProduct: byProduct.results.map((r) => ({ productName: r.product_name, packLabel: r.pack_label, quantity: r.quantity, total: r.total })),
      });
    });
}
