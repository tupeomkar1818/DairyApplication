import { describe, expect, it } from 'vitest';

import { dairyTimeLabel } from '@/src/domain/shared/dairyClock';
import { getLanguage, setLanguage } from '@/src/i18n/language';
import { formatDateTime, formatDay, formatMoney, formatMonth, formatRelativeDay, formatTime } from '@/src/utils/format';

describe('shared formats', () => {
  it('writes days day-first with fixed month names', () => {
    expect(formatDay('2026-09-16')).toBe('16 Sep');
    expect(formatDay('2026-09-05', { year: true })).toBe('05 Sep 2026');
    expect(formatDay('2026-09-16', { weekday: true })).toBe('Wed, 16 Sep');
    expect(formatDay('2026-09-16T18:30:00.000Z'.slice(0, 10))).toBe('16 Sep');
    expect(formatDay('not a date')).toBe('not a date');
  });

  it('writes months in full', () => {
    expect(formatMonth('2026-09')).toBe('September 2026');
  });

  it('writes a timestamp with a 12-hour clock', () => {
    expect(formatDateTime(new Date(2026, 8, 16, 19, 5).toISOString())).toBe('16 Sep, 7:05 pm');
    expect(formatDateTime(new Date(2026, 8, 16, 0, 0).toISOString())).toBe('16 Sep, 12:00 am');
  });

  it('writes money in whole rupees with Indian grouping', () => {
    expect(formatMoney(52)).toBe('₹52');
    expect(formatMoney(1586.4)).toBe('₹1,586');
    expect(formatMoney(123456)).toBe('₹1,23,456');
    expect(formatMoney(12345678)).toBe('₹1,23,45,678');
    expect(formatMoney(undefined)).toBe('₹0');
    expect(formatMoney(-250)).toBe('-₹250');
  });
});

describe('formats in Marathi', () => {
  it('uses Marathi month, weekday and time words with 0-9 digits', () => {
    expect(formatDay('2026-09-16', { lang: 'mr' })).toBe('16 सप्टें');
    expect(formatDay('2026-09-16', { weekday: true, year: true, lang: 'mr' })).toBe('बुध, 16 सप्टें 2026');
    expect(formatMonth('2026-09', 'mr')).toBe('सप्टेंबर 2026');
    expect(formatTime(new Date(2026, 8, 16, 7, 5).toISOString(), 'mr')).toBe('सकाळी 7:05');
    expect(formatTime(new Date(2026, 8, 16, 19, 30).toISOString(), 'mr')).toBe('संध्याकाळी 7:30');
    expect(formatRelativeDay('2026-09-16', new Date(2026, 8, 16, 10), 'mr')).toBe('आज');
    expect(dairyTimeLabel(21, 0, 'mr')).toBe('रात्री 9');
    expect(formatMoney(1586)).toBe('₹1,586');
  });

  it('follows the language chosen in the app', () => {
    const before = getLanguage();
    try {
      setLanguage('mr');
      expect(formatDateTime(new Date(2026, 8, 16, 13, 5).toISOString())).toBe('16 सप्टें, दुपारी 1:05');
      setLanguage('en');
      expect(formatDateTime(new Date(2026, 8, 16, 13, 5).toISOString())).toBe('16 Sep, 1:05 pm');
    } finally {
      setLanguage(before);
    }
  });
});
