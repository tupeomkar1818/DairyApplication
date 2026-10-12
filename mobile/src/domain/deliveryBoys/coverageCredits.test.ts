import { describe, expect, it } from 'vitest';

import {
  enumerateDatesInclusive,
  MAX_ENUMERATED_DAYS,
  stripCreditsForLeaverSources,
} from '@/src/domain/deliveryBoys/coverageCredits';
import type { DeliveryBoyRouteCoverageCredit } from '@/src/domain/deliveryBoys/entities';

const nowIso = '2026-04-01T12:00:00.000Z';

function credit(over: Partial<DeliveryBoyRouteCoverageCredit>): DeliveryBoyRouteCoverageCredit {
  return {
    id: 'crc',
    createdAt: nowIso,
    updatedAt: nowIso,
    date: '2026-04-10',
    routeName: 'Route A',
    leaverDeliveryBoyId: 'boy_a',
    ...over,
  };
}

describe('stripCreditsForLeaverSources', () => {
  it("keeps another boy's credit when legacy date-only source ids collide", () => {
    // Boys A and B were both absent on 2026-04-10; the old ids were `lev_att_<date>` for both.
    const credits = [
      credit({ id: 'from_a', leaverDeliveryBoyId: 'boy_a', sourceLeaveId: 'lev_att_2026-04-10' }),
      credit({ id: 'from_b', leaverDeliveryBoyId: 'boy_b', sourceLeaveId: 'lev_att_2026-04-10' }),
    ];
    const next = stripCreditsForLeaverSources(credits, 'boy_a', ['lev_att_boy_a_2026-04-10', 'lev_att_2026-04-10']);
    expect(next.map((c) => c.id)).toEqual(['from_b']);
  });

  it('removes per-boy leave and replacement sourced credits, keeps unrelated ones', () => {
    const credits = [
      credit({ id: 'leave', sourceLeaveId: 'lev_att_boy_a_2026-04-10' }),
      credit({ id: 'repl', sourceReplacementId: 'rpl_att_boy_a_2026-04-10' }),
      credit({ id: 'manual' }),
      credit({ id: 'other_day', sourceLeaveId: 'lev_att_boy_a_2026-04-11' }),
    ];
    const next = stripCreditsForLeaverSources(credits, 'boy_a', ['lev_att_boy_a_2026-04-10', 'rpl_att_boy_a_2026-04-10']);
    expect(next.map((c) => c.id)).toEqual(['manual', 'other_day']);
  });

  it('tolerates a missing credits array', () => {
    expect(stripCreditsForLeaverSources(undefined, 'boy_a', ['x'])).toEqual([]);
  });
});

describe('enumerateDatesInclusive', () => {
  it('caps a far-future end date instead of looping for millions of days', () => {
    const out = enumerateDatesInclusive('2026-01-01', '9999-12-31');
    expect(out).toHaveLength(MAX_ENUMERATED_DAYS);
    expect(out[0]).toBe('2026-01-01');
  });

  it('treats a missing end as a single day and a reversed range as empty', () => {
    expect(enumerateDatesInclusive('2026-01-05', '')).toEqual(['2026-01-05']);
    expect(enumerateDatesInclusive('2026-01-05', '2026-01-01')).toEqual([]);
  });

  it('crosses month boundaries in local calendar days', () => {
    expect(enumerateDatesInclusive('2024-02-28', '2024-03-01')).toEqual(['2024-02-28', '2024-02-29', '2024-03-01']);
  });
});
