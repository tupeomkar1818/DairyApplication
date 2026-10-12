import { summarizeBilling } from '@/billing/timeline';
import { requireUser } from '@/auth/service';
import { getCustomer } from '@/customers/read';
import { ApiError, json, type Router } from '@/http';
import { indiaYmd } from '@/jobs/reminders';
import { offerFromRow, type OfferRow } from '@/offers/mapping';

/**
 * A customer's bills, month by month, worked out the way the apps work them out (`src/billing/`).
 *
 * The apps still do their own sums from the record they hold — they must, so a phone with no signal can still show
 * a bill. This is for anyone asking the server directly: the dairy's own tools, and a check that both sides agree.
 */

export function mountBilling(router: Router): Router {
  return router.get('/customers/:id/bills', async (context) => {
    const principal = await requireUser(context);
    const id = context.params.id!;
    if (principal.role === 'customer' && id !== principal.linkedRecordId) throw ApiError.forbidden();
    if (principal.role === 'delivery_boy') throw ApiError.forbidden();

    const customer = await getCustomer(context.env, id);
    const today = indiaYmd(new Date());
    const month = context.url.searchParams.get('month') ?? today.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw ApiError.badRequest('MONTH_INVALID', 'Ask for a month like 2026-10.');

    const offers = await context.env.DB.prepare('select * from offers').all<OfferRow>();
    const summary = summarizeBilling(customer, month, today, offers.results.map(offerFromRow));
    return json({ customerId: id, month, today, ...summary });
  });
}
