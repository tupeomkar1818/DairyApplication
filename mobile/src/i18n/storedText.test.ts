import { describe, expect, it } from 'vitest';

import { STORED_TEXT_EXACT_KEYS, storedText } from '@/src/i18n/storedText';

describe('storedText', () => {
  it('keeps English as saved', () => {
    expect(storedText('Status updated', 'en')).toBe('Status updated');
    expect(storedText('Route cover (Sagar)', 'en')).toBe('Route cover (Sagar)');
  });

  it('shows the app’s own notes in Marathi', () => {
    expect(storedText('Status updated', 'mr')).toBe('स्थिती बदलली');
    expect(storedText('Unassigned', 'mr')).toBe('कोणालाही दिलेले नाही');
    expect(storedText('Route cover (Sagar), Route cover (Amit)', 'mr')).toBe('मार्ग बदली (Sagar), मार्ग बदली (Amit)');
    expect(storedText('Bill payment for 2026-09', 'mr')).toBe('2026-09 चे बिल पेमेंट');
  });

  it('leaves text people typed alone', () => {
    expect(storedText('Gate is locked, call first', 'mr')).toBe('Gate is locked, call first');
    expect(storedText('', 'mr')).toBe('');
    expect(storedText(undefined, 'mr')).toBe('');
  });

  it('has Marathi for every phrase it knows', () => {
    const missing = STORED_TEXT_EXACT_KEYS.filter((k) => !/[ऀ-ॿ]/.test(storedText(k, 'mr')));
    expect(missing).toEqual([]);
  });
});
