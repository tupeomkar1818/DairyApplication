import { describe, expect, it } from 'vitest';

import { maskMobile, normalizeMobile, randomOtp, randomToken, sameHash, sha256Hex } from '@/auth/crypto';

describe('sign-in: the secret parts', () => {
  it('stores a code only as a hash, and a different pepper gives a different hash', async () => {
    const a = await sha256Hex('123456', 'pepper-one');
    const b = await sha256Hex('123456', 'pepper-one');
    const c = await sha256Hex('123456', 'pepper-two');
    expect(a).toHaveLength(64);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toContain('123456');
  });

  it('compares hashes without giving away how much matched', () => {
    expect(sameHash('abc', 'abc')).toBe(true);
    expect(sameHash('abc', 'abd')).toBe(false);
    expect(sameHash('abc', 'abcd')).toBe(false);
  });

  it('makes six-digit codes, zeros kept', () => {
    for (let i = 0; i < 200; i += 1) expect(randomOtp()).toMatch(/^\d{6}$/);
  });

  it('makes session tokens that are long, URL-safe and never repeat', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => randomToken()));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
  });

  it('shows a number the owner recognises but a stranger cannot read', () => {
    expect(maskMobile('9876500011')).toBe('+91 98XXXXXX11');
    expect(maskMobile('+91 98765 00011')).toBe('+91 98XXXXXX11');
  });

  it('accepts Indian mobile numbers however they are typed, and refuses the rest', () => {
    expect(normalizeMobile('9876500011')).toBe('9876500011');
    expect(normalizeMobile('+91 98765 00011')).toBe('9876500011');
    expect(normalizeMobile('919876500011')).toBe('9876500011');
    for (const bad of ['', '12345', '1234567890', '98765000119999', 'abcdefghij', null, undefined]) {
      expect(normalizeMobile(bad)).toBeNull();
    }
  });
});
