import type { CustomerSubscriptionPlanDto } from '@/src/domain/customers/dtos';
import { planBoundaryToIsoYmd } from '@/src/domain/shared/planBoundaryDates';

/**
 * Pure calendar rules for customer subscription plan lines (shared by admin UI and the mock service).
 * Plan boundaries may be DD/MM/YYYY (form) or YYYY-MM-DD… (stored); comparisons use normalized YYYY-MM-DD.
 */

function addDaysIsoYmd(ymd: string, deltaDays: number): string {
  const [yy, mm, dd] = ymd.slice(0, 10).split('-').map((x) => Number(x));
  const d = new Date(yy, mm - 1, dd);
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const activeSegmentsCache = new WeakMap<object, Array<[string, string]>>();

/** Inclusive [from, to] YYYY-MM-DD ranges in which a Monthly plan line is active (pause window removed). */
export function subscriptionPlanActiveSegments(p: CustomerSubscriptionPlanDto): Array<[string, string]> {
  const cached = activeSegmentsCache.get(p);
  if (cached) return cached;

  const start = planBoundaryToIsoYmd(p.startDate);
  if (!start) return [];
  const end = planBoundaryToIsoYmd(p.endDate) ?? '9999-12-31';

  const ps = planBoundaryToIsoYmd(p.pauseStartDate) ?? '';
  if (!ps || ps > end) {
    const res: Array<[string, string]> = [[start, end]];
    activeSegmentsCache.set(p, res);
    return res;
  }

  const pe = planBoundaryToIsoYmd(p.pauseEndDate) ?? '';
  const resume = planBoundaryToIsoYmd(p.resumeDate) ?? '';

  const out: Array<[string, string]> = [];
  const dayBeforePause = addDaysIsoYmd(ps, -1);
  const preEnd = end <= dayBeforePause ? end : dayBeforePause;
  if (start <= preEnd) out.push([start, preEnd]);

  let activeAgainFrom = '';
  if (resume) activeAgainFrom = resume;
  else if (pe) activeAgainFrom = addDaysIsoYmd(pe, 1);
  if (activeAgainFrom && activeAgainFrom <= end) {
    const segStart = activeAgainFrom >= start ? activeAgainFrom : start;
    out.push([segStart, end]);
  }

  // A pause covering the whole range leaves no active segment — the line is inactive, not fully active.
  activeSegmentsCache.set(p, out);
  return out;
}

/** True when the plan delivers / is active on the given calendar day (YYYY-MM-DD). */
export function subscriptionPlanActiveOnDateYmd(p: CustomerSubscriptionPlanDto, ymd: string): boolean {
  const kind = p.subscriptionKind ?? 'Monthly';
  if (kind === 'Daily') {
    const dd = planBoundaryToIsoYmd(p.deliveryDate);
    return !!dd && dd === ymd;
  }
  for (const [a, b] of subscriptionPlanActiveSegments(p)) {
    if (ymd >= a && ymd <= b) return true;
  }
  return false;
}

/** Roll-up line total for one delivery of a subscription plan row. */
export function planLineTotal(p: CustomerSubscriptionPlanDto): number {
  const items = Math.max(1, Number(p.numberOfItems ?? 1));
  const base = Number(p.originalPrice ?? 0);
  const disc = Number(p.discountedPrice ?? 0);
  const unit = disc > 0 && disc < base ? disc : base;
  if ((p.subscriptionKind ?? 'Monthly') === 'Daily' && p.dailyCost != null && Number.isFinite(Number(p.dailyCost))) {
    return Math.round(Number(p.dailyCost) * items);
  }
  return Math.round(items * (Number.isFinite(unit) ? unit : 0));
}

/**
 * Number of calendar days in `monthYyyyMm` on which the plan is active.
 * Note: `frequency` (Weekend Only / Alternate Day / …) is not modelled by the plan schedule — calendar, delivery
 * marking and billing all treat every active day as a delivery day — so this counts active days only.
 */
export function subscriptionPlanActiveDaysInMonth(p: CustomerSubscriptionPlanDto, monthYyyyMm: string): number {
  const m = monthYyyyMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return 0;
  const dim = new Date(Number(m[1]), Number(m[2]), 0).getDate();
  let days = 0;
  for (let d = 1; d <= dim; d += 1) {
    if (subscriptionPlanActiveOnDateYmd(p, `${monthYyyyMm}-${String(d).padStart(2, '0')}`)) days += 1;
  }
  return days;
}
