import { describe, expect, it } from 'vitest';

import { normalizeIndicDigitsToAscii, normalizeMobileNumberInput } from '@/src/domain/shared/numerals';

describe('normalizeIndicDigitsToAscii', () => {
  it('converts Devanagari digits to ASCII', () => {
    expect(normalizeIndicDigitsToAscii('९८७६५४३२१०')).toBe('9876543210');
  });

  it('leaves ASCII digits unchanged', () => {
    expect(normalizeIndicDigitsToAscii('8208682688')).toBe('8208682688');
  });

  it('handles mixed Marathi and English digits', () => {
    expect(normalizeIndicDigitsToAscii('98७६५43210')).toBe('9876543210');
  });
});

describe('normalizeMobileNumberInput', () => {
  it('strips non-digits after indic conversion', () => {
    expect(normalizeMobileNumberInput('९८ ७६-५४३२१०')).toBe('9876543210');
  });

  it('caps at 10 digits', () => {
    expect(normalizeMobileNumberInput('12345678901234')).toBe('1234567890');
  });
});
