import {
  customerFromRow,
  type Customer,
  type CustomerRow,
  type PlanRow,
} from '@/customers/mapping';
import {
  type DeliveryRow,
  type ExceptionRow,
  type ExtraOrderRow,
  type PaymentRequestRow,
  type PaymentRow,
} from '@/customers/operational';
import { ApiError, type Env } from '@/http';
import { claimsByCustomer } from '@/offers/claims';

/**
 * Reading customers whole: the profile, the subscription lines, and everything the household has done — the days
 * delivered, the days they changed, the one-off orders and the money.
 *
 * The apps hold a customer as one record, so that is how one is read, by the routes and by the evening job alike.
 */

export async function loadCustomers(env: Env, where?: { id: string }): Promise<Customer[]> {
  const rows = where
    ? await env.DB.prepare('select * from customers where id = ?').bind(where.id).all<CustomerRow>()
    : await env.DB.prepare('select * from customers order by name').all<CustomerRow>();
  if (!rows.results.length) return [];

  const ids = rows.results.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(', ');
  const forIds = <T>(sql: string) => env.DB.prepare(sql.replace('@ids', placeholders)).bind(...ids).all<T>();
  const [plans, boys, deliveries, extraOrders, exceptions, payments, paymentRequests, claims] = await Promise.all([
    forIds<PlanRow>('select * from subscription_plans where customer_id in (@ids) order by created_at'),
    env.DB.prepare('select id, full_name from delivery_boys').all<{ id: string; full_name: string }>(),
    forIds<DeliveryRow>('select * from deliveries where customer_id in (@ids) order by delivery_ymd'),
    forIds<ExtraOrderRow>('select * from extra_orders where customer_id in (@ids) order by delivery_ymd'),
    forIds<ExceptionRow>('select * from subscription_exceptions where customer_id in (@ids) order by from_ymd'),
    forIds<PaymentRow>('select * from payments where customer_id in (@ids) order by payment_date'),
    forIds<PaymentRequestRow>('select * from payment_requests where customer_id in (@ids) order by created_at'),
    claimsByCustomer(env, ids),
  ]);

  /** Groups rows by the customer they belong to. */
  const byCustomerId = <T extends { customer_id: string }>(list: readonly T[]) => {
    const map = new Map<string, T[]>();
    for (const row of list) {
      const existing = map.get(row.customer_id) ?? [];
      existing.push(row);
      map.set(row.customer_id, existing);
    }
    return map;
  };
  const deliveriesBy = byCustomerId(deliveries.results);
  const extraOrdersBy = byCustomerId(extraOrders.results);
  const exceptionsBy = byCustomerId(exceptions.results);
  const paymentsBy = byCustomerId(payments.results);
  const requestsBy = byCustomerId(paymentRequests.results);

  const byCustomer = new Map<string, PlanRow[]>();
  for (const plan of plans.results) {
    const list = byCustomer.get(plan.customer_id) ?? [];
    list.push(plan);
    byCustomer.set(plan.customer_id, list);
  }
  const boyNames = new Map(boys.results.map((b) => [b.id, b.full_name]));

  return rows.results.map((row) =>
    customerFromRow(row, byCustomer.get(row.id) ?? [], row.delivery_boy_id ? boyNames.get(row.delivery_boy_id) : undefined, {
      deliveries: deliveriesBy.get(row.id),
      extraOrders: extraOrdersBy.get(row.id),
      exceptions: exceptionsBy.get(row.id),
      payments: paymentsBy.get(row.id),
      paymentRequests: requestsBy.get(row.id),
      offerClaims: claims.get(row.id),
    }),
  );
}

export async function getCustomer(env: Env, id: string): Promise<Customer> {
  const [customer] = await loadCustomers(env, { id });
  if (!customer) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'That customer is no longer on the list.');
  return customer;
}

/** Every customer the dairy has, for a job that goes through them all. */
export async function loadEveryCustomer(env: Env): Promise<Customer[]> {
  return loadCustomers(env);
}
