import { describe, expect, it } from 'vitest';

import {
  parsePickerDate,
  pickerMaxYear,
  pickerStartMonth,
  pickerYears,
  toDdMmYyyy,
  toYmd,
} from '@/src/components/shared/datePickerDates';

describe('parsePickerDate', () => {
  it('reads DD/MM/YYYY and YYYY-MM-DD as the local day', () => {
    expect(toYmd(parsePickerDate('05/09/2026')!)).toBe('2026-09-05');
    expect(toDdMmYyyy(parsePickerDate('2026-09-05')!)).toBe('05/09/2026');
    expect(toDdMmYyyy(parsePickerDate('2026-09-05T18:30:00.000Z')!)).toBe('05/09/2026');
  });

  it('rejects partial, empty and impossible dates', () => {
    for (const v of ['', '  ', '05/09', '5/9/2026', '31/02/2026', '2026-13-01', 'abc', undefined, null]) {
      expect(parsePickerDate(v)).toBeNull();
    }
  });
});

describe('pickerStartMonth', () => {
  const now = new Date(2026, 8, 17);

  it('opens on the value month, else the fallback, else this month', () => {
    expect(toYmd(pickerStartMonth('14/02/2024', null, 1950, 2031, now))).toBe('2024-02-01');
    expect(toYmd(pickerStartMonth('', new Date(1995, 0, 1), 1950, 2026, now))).toBe('1995-01-01');
    expect(toYmd(pickerStartMonth('12/3', undefined, 1950, 2031, now))).toBe('2026-09-01');
  });

  it('keeps the month inside the year range and never returns an invalid date', () => {
    expect(toYmd(pickerStartMonth('01/06/2090', null, 1950, 2031, now))).toBe('2031-01-01');
    expect(toYmd(pickerStartMonth('01/06/1900', null, 1950, 2031, now))).toBe('1950-01-01');
    expect(Number.isNaN(pickerStartMonth(null, new Date('bad'), 1950, 2031, now).getTime())).toBe(false);
  });
});

describe('year list', () => {
  it('lists newest first between the bounds', () => {
    const now = new Date(2026, 0, 1);
    expect(pickerMaxYear(0, now)).toBe(2026);
    expect(pickerMaxYear(5, now)).toBe(2031);
    expect(pickerYears(2024, 2026)).toEqual([2026, 2025, 2024]);
  });
});
