import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import { convertLegacyDayOrders } from '@/src/domain/customers/legacyDayOrders';
import {
  clearDailyProductOrderLines,
  hasLegacyDayOrderRows,
  loadDailyProductOrderLines,
} from '@/src/infrastructure/customerDailyProductOrdersStore';
import { mayReadEveryCustomer } from '@/src/infrastructure/customerScope';
import { services } from '@/src/infrastructure/service-registry';

let started: Promise<void> | null = null;

/**
 * Moves the admin's older day orders into the customer record (see `convertLegacyDayOrders`) and empties the old
 * store, so every app reads one set of add-ons. Runs once per app start; safe to run again.
 *
 * Almost every start has nothing to move — the rows only ever existed on a phone that kept its own records, and
 * once they are moved they are gone. So the phone is asked first and the dairy is downloaded only if the answer is
 * yes; otherwise every single launch pulled the whole customer list and the whole catalog to find nothing.
 */
export function migrateLegacyDayOrders(): Promise<void> {
  if (!started) {
    started = (async () => {
      // The dairy’s own app does this once; a customer’s app may not read anybody else’s orders.
      if (!(await mayReadEveryCustomer())) return;
      if (!(await hasLegacyDayOrderRows())) return;
      const [customers, products] = await Promise.all([services.customers.list(), services.products.list()]);
      const today = todayYmd();
      for (const customer of customers.items) {
        const lines = await loadDailyProductOrderLines(customer.id);
        if (!lines.length) continue;
        const patch = convertLegacyDayOrders({ customer, lines, products: products.items, today });
        if (patch) await services.customers.update(customer.id, patch);
        await clearDailyProductOrderLines(customer.id);
      }
    })().catch(() => {
      // A failed migration leaves the old rows where they were; the next start tries again.
      started = null;
    });
  }
  return started;
}
