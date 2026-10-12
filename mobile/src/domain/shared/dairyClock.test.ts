import { describe, expect, it } from 'vitest';

import { dairyClockParts, dairyInstant, dairyTimeLabel, dairyTodayYmd } from '@/src/domain/shared/dairyClock';

describe('dairy clock (IST)', () => {
  it('reads IST from any instant, whatever the device time zone', () => {
    // 12:30 UTC is 6:00 pm IST.
    expect(dairyClockParts(new Date('2026-09-16T12:30:00Z'))).toEqual({ ymd: '2026-09-16', hour: 18, minute: 0 });
    // 20:00 UTC on the 16th is already 1:30 am on the 17th in India.
    expect(dairyTodayYmd(new Date('2026-09-16T20:00:00Z'))).toBe('2026-09-17');
  });

  it('builds IST instants, rolling back across months for "the evening before"', () => {
    expect(dairyInstant('2026-09-16', 18).toISOString()).toBe('2026-09-16T12:30:00.000Z');
    expect(dairyInstant('2026-10-01', 21, 0, -1).toISOString()).toBe('2026-09-30T15:30:00.000Z');
    expect(dairyInstant('2027-01-01', 18, 0, -1).toISOString()).toBe('2026-12-31T12:30:00.000Z');
  });

  it('labels times the way people say them', () => {
    expect(dairyTimeLabel(18)).toBe('6 pm');
    expect(dairyTimeLabel(21)).toBe('9 pm');
    expect(dairyTimeLabel(0)).toBe('12 am');
    expect(dairyTimeLabel(11, 30)).toBe('11:30 am');
  });
});
