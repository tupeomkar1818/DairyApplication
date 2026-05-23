import type { DeliveryBoyRouteCoverageCredit } from '@/src/domain/deliveryBoys/entities';

export function enumerateDatesInclusive(fromIso: string, toIso: string): string[] {
  const start = String(fromIso).slice(0, 10);
  const end = String(toIso || fromIso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return [];
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const d = new Date(sy, sm - 1, sd);
  const endD = new Date(ey, em - 1, ed);
  if (Number.isNaN(d.getTime()) || Number.isNaN(endD.getTime())) return [];
  const out: string[] = [];
  while (d.getTime() <= endD.getTime()) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function creditDayKey(dateIso: string, leaverDeliveryBoyId: string): string {
  return `${String(dateIso).slice(0, 10)}|${leaverDeliveryBoyId}`;
}

export function stripCreditsBySourceLeaveId(credits: DeliveryBoyRouteCoverageCredit[], leaveId: string): DeliveryBoyRouteCoverageCredit[] {
  return (credits ?? []).filter((c) => c.sourceLeaveId !== leaveId);
}

export function stripCreditsBySourceReplacementId(credits: DeliveryBoyRouteCoverageCredit[], replacementId: string): DeliveryBoyRouteCoverageCredit[] {
  return (credits ?? []).filter((c) => c.sourceReplacementId !== replacementId);
}

export function buildRouteCoverageCreditsForRange(params: {
  fromIso: string;
  toIso: string;
  routeName: string;
  leaverDeliveryBoyId: string;
  leaverDeliveryBoyName?: string;
  sourceLeaveId?: string;
  sourceReplacementId?: string;
}): DeliveryBoyRouteCoverageCredit[] {
  const dates = enumerateDatesInclusive(params.fromIso, params.toIso);
  const now = new Date().toISOString();
  return dates.map((date, i) => ({
    id: `rc_${params.leaverDeliveryBoyId}_${date}_${Date.now().toString(16)}_${i}`,
    date,
    routeName: params.routeName,
    leaverDeliveryBoyId: params.leaverDeliveryBoyId,
    leaverDeliveryBoyName: params.leaverDeliveryBoyName,
    sourceLeaveId: params.sourceLeaveId,
    sourceReplacementId: params.sourceReplacementId,
    createdAt: now,
    updatedAt: now,
  }));
}

/** Merge additions; skip if same calendar day + leaver already exists on the replacer. */
export function mergeRouteCoverageCreditsDedup(
  existing: DeliveryBoyRouteCoverageCredit[] | undefined,
  additions: DeliveryBoyRouteCoverageCredit[],
): DeliveryBoyRouteCoverageCredit[] {
  const cur = [...(existing ?? [])];
  const keys = new Set(cur.map((c) => creditDayKey(c.date, c.leaverDeliveryBoyId)));
  for (const a of additions) {
    const k = creditDayKey(a.date, a.leaverDeliveryBoyId);
    if (keys.has(k)) continue;
    keys.add(k);
    cur.push(a);
  }
  return cur;
}
