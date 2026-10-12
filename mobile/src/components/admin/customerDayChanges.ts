import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { strings } from '@/src/i18n/strings';

/**
 * The customer's day changes as the admin reads them: which days, which product, what changed, and who changed it.
 */

export type DayChangeRow = {
  id: string;
  fromYmd: string;
  toYmd: string;
  /** "Cow Milk · 500 ml", or "Whole subscription" for a skip covering every line. */
  productLabel: string;
  /** "Skipped", "× 3 (usually 1)" or "None of this product". */
  changeLabel: string;
  kind: 'skip' | 'quantity';
  createdBy: 'customer' | 'admin';
};

function monthBounds(monthYyyyMm: string): { first: string; last: string } {
  const [y, m] = monthYyyyMm.split('-').map(Number);
  const lastDay = new Date(y!, m!, 0).getDate();
  return { first: `${monthYyyyMm}-01`, last: `${monthYyyyMm}-${String(lastDay).padStart(2, '0')}` };
}

/** Day changes that touch the month, earliest first. */
export function dayChangesForMonth(
  customer: Pick<CustomerResponse, 'subscriptionExceptions' | 'subscriptionPlans'>,
  monthYyyyMm: string,
): DayChangeRow[] {
  const { first, last } = monthBounds(monthYyyyMm);
  const t = strings('customers').dayChanges;
  const plans = new Map((customer.subscriptionPlans ?? []).map((p) => [String(p.id ?? ''), p] as const));

  return (customer.subscriptionExceptions ?? [])
    .map((ex) => {
      const fromYmd = String(ex.fromYmd ?? '').slice(0, 10);
      const toYmd = String(ex.toYmd || ex.fromYmd || '').slice(0, 10);
      return { ex, fromYmd, toYmd };
    })
    .filter(({ fromYmd, toYmd }) => fromYmd <= last && toYmd >= first)
    .map(({ ex, fromYmd, toYmd }) => {
      const kind = ex.kind === 'quantity' ? 'quantity' : 'skip';
      const plan = ex.planId ? plans.get(String(ex.planId)) : undefined;
      const productLabel = plan
        ? [plan.productName, plan.quantityLabel].map((x) => String(x ?? '').trim()).filter(Boolean).join(' · ')
        : ex.planId
          ? t.removedProduct
          : t.wholeSubscription;

      let changeLabel = t.skipped;
      if (kind === 'quantity') {
        const n = Math.max(0, Math.floor(Number(ex.numberOfItems ?? 0)));
        const usual = Math.max(1, Math.floor(Number(plan?.numberOfItems ?? 1)) || 1);
        changeLabel = n === 0 ? t.noneOfProduct : t.changedQuantity(n, usual);
      }

      return {
        id: ex.id,
        fromYmd,
        toYmd,
        productLabel,
        changeLabel,
        kind,
        createdBy: ex.createdBy === 'admin' ? 'admin' : 'customer',
      } as DayChangeRow;
    })
    .sort((a, b) => a.fromYmd.localeCompare(b.fromYmd) || a.productLabel.localeCompare(b.productLabel));
}
