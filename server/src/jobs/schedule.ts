import type { Customer } from '@/customers/mapping';
import type { Row } from '@/customers/selfService';
import type { Lang } from '@/jobs/words';

/**
 * What is going to a house on a given day.
 *
 * The apps work this out for every screen they draw (`mobile/src/domain/customers/daySchedule.ts`,
 * `planSchedule.ts`, `addOns.ts`); the evening job needs the same answer with nobody holding a phone, so the rules
 * are here too. Keep them in step with those files — a difference would show as a reminder that does not match the
 * day the customer then sees.
 */

const MAX_DAY_QUANTITY = 20;

const ymdOf = (value: unknown): string => String(value ?? '').slice(0, 10);
const isYmd = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

function shift(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The days a line is running: its start to its end, minus a pause, and a Daily line only on its own day. */
function activeSegments(plan: Row): [string, string][] {
  const start = ymdOf(plan.startDate);
  if (!isYmd(start)) return [];
  const end = ymdOf(plan.endDate) || '9999-12-31';

  const pauseStart = ymdOf(plan.pauseStartDate);
  if (!isYmd(pauseStart) || pauseStart > end) return [[start, end]];

  const pauseEnd = ymdOf(plan.pauseEndDate);
  const resume = ymdOf(plan.resumeDate);
  const out: [string, string][] = [];
  const dayBeforePause = shift(pauseStart, -1);
  const preEnd = end <= dayBeforePause ? end : dayBeforePause;
  if (start <= preEnd) out.push([start, preEnd]);

  const activeAgainFrom = isYmd(resume) ? resume : isYmd(pauseEnd) ? shift(pauseEnd, 1) : '';
  if (activeAgainFrom && activeAgainFrom <= end) out.push([activeAgainFrom >= start ? activeAgainFrom : start, end]);
  return out;
}

export function planRunsOn(plan: Row, ymd: string): boolean {
  if ((plan.subscriptionKind ?? 'Monthly') === 'Daily') return ymdOf(plan.deliveryDate) === ymd;
  return activeSegments(plan).some(([from, to]) => ymd >= from && ymd <= to);
}

/** A day change covers this day — and this line, when it names one (a plain skip covers the whole day). */
function covers(change: Row, ymd: string, planId?: string): boolean {
  const from = ymdOf(change.fromYmd);
  const to = ymdOf(change.toYmd) || from;
  if (!isYmd(from) || !isYmd(to) || ymd < from || ymd > to) return false;
  const scoped = String(change.planId ?? '').trim();
  return !scoped || scoped === planId;
}

/** How many packs of this line go out on this day: 0 when it is not running or is skipped. */
export function packsOn(plan: Row, ymd: string, changes: readonly Row[]): number {
  if (!planRunsOn(plan, ymd)) return 0;
  const planId = String(plan.id ?? '');
  if (changes.some((change) => change.kind !== 'quantity' && covers(change, ymd, planId))) return 0;

  const quantity = changes
    .filter((change) => change.kind === 'quantity' && String(change.planId ?? '') === planId && covers(change, ymd, planId))
    // The newest change wins, as it does in the apps.
    .reduce<Row | null>((latest, change) => (!latest || String(change.createdAt ?? '') >= String(latest.createdAt ?? '') ? change : latest), null);

  if (quantity) {
    const n = Math.floor(Number(quantity.numberOfItems ?? 0));
    return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_DAY_QUANTITY) : 0;
  }
  const usual = Math.floor(Number(plan.numberOfItems ?? 1));
  return Number.isFinite(usual) && usual > 0 ? usual : 1;
}

/** What one delivery of this line costs. */
function lineTotal(plan: Row, packs: number): number {
  const base = Number(plan.originalPrice ?? 0);
  const discounted = Number(plan.discountedPrice ?? 0);
  const unit = discounted > 0 && discounted < base ? discounted : base;
  return Math.round((Number.isFinite(unit) ? unit : 0) * packs);
}

/** One-off orders still standing for a day; a cancelled one is not going anywhere. */
export function addOnsOn(customer: Customer, ymd: string): Row[] {
  return ((customer.extraOrders as Row[]) ?? []).filter(
    (order) => ymdOf(order.deliveryDate || order.orderDate) === ymd && order.status !== 'Cancelled',
  );
}

function packLabel(productName: unknown, quantityLabel: unknown): string {
  return [productName, quantityLabel].map((part) => String(part ?? '').trim()).filter(Boolean).join(' · ');
}

/** "Cow Milk · 500 ml × 2" — a line as it reads in a reminder. */
function label(productName: unknown, quantityLabel: unknown, count: number): string {
  const name = packLabel(productName, quantityLabel);
  return count > 1 ? `${name} × ${count}` : name;
}

/** A one-off order as it reads: a combo by its offer's name, in the reader's language, with what is in it. */
function addOnLabel(order: Row, lang: Lang): string {
  const items = Math.max(1, Math.floor(Number(order.numberOfItems ?? 1)) || 1);
  const combo = (order.comboItems as Row[] | undefined) ?? [];
  if (combo.length) {
    const title = (order.offer as { title?: { en?: string; mr?: string } } | undefined)?.title;
    const name = (lang === 'mr' ? String(title?.mr ?? '').trim() : '') || String(title?.en ?? order.productName ?? '').trim();
    const contents = combo
      .map((item) => {
        const pack = packLabel(item.productName, item.packLabel);
        const count = Math.max(1, Math.floor(Number(item.quantity ?? 1)) || 1);
        return count > 1 ? `${pack} × ${count}` : pack;
      })
      .join(', ');
    const base = contents ? `${name} (${contents})` : name;
    return items > 1 ? `${base} × ${items}` : base;
  }
  return label(order.productName, order.quantityLabel, items);
}

export type DayOrder = {
  /** "Cow Milk · 500 ml × 2" for each line of the standing order, in this language. */
  planItems: string[];
  /** The same for the one-off orders. */
  addOnItems: string[];
  /** What the day comes to, before any bill discount. */
  amount: number;
};

/** Everything going to this house on this day, as the reminder needs to read it — or null when nothing is. */
export function orderForDay(customer: Customer, ymd: string, lang: Lang): DayOrder | null {
  const changes = ((customer.subscriptionExceptions as Row[]) ?? []).map((change) => change);
  const planned = ((customer.subscriptionPlans as Row[]) ?? [])
    .map((plan) => ({ plan, packs: packsOn(plan, ymd, changes) }))
    .filter(({ packs }) => packs > 0);
  const addOns = addOnsOn(customer, ymd);
  if (!planned.length && !addOns.length) return null;

  return {
    planItems: planned.map(({ plan, packs }) => label(plan.productName, plan.quantityLabel, packs)),
    addOnItems: addOns.map((order) => addOnLabel(order, lang)),
    amount:
      planned.reduce((sum, { plan, packs }) => sum + lineTotal(plan, packs), 0) +
      addOns.reduce((sum, order) => {
        const items = Math.max(1, Math.floor(Number(order.numberOfItems ?? 1)) || 1);
        return sum + Math.round((Number(order.price ?? 0) || 0) * items);
      }, 0),
  };
}

/** Whether this customer should hear from the dairy at all: an active account that uses the app. */
export function remindable(customer: Customer): boolean {
  return customer.status !== 'Inactive' && customer.appAccessEnabled !== false;
}
