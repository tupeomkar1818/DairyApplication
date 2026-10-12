import { describe, expect, it } from 'vitest';

import { isPin, lockedUntil, MAX_PIN_ATTEMPTS, PIN_LOCK_MS } from '@/auth/pin';

describe('what counts as a PIN', () => {
  it('is four digits', () => {
    expect(isPin('0000')).toBe(true);
    expect(isPin('9183')).toBe(true);
    expect(isPin(' 4821 ')).toBe(true);
  });

  it('is not anything else', () => {
    expect(isPin('123')).toBe(false);
    expect(isPin('12345')).toBe(false);
    expect(isPin('12a4')).toBe(false);
    expect(isPin('')).toBe(false);
    expect(isPin(undefined)).toBe(false);
  });
});

describe('an account closed after too many wrong tries', () => {
  const now = new Date('2026-10-12T10:00:00.000Z');

  it('is closed while the time has not passed', () => {
    const until = lockedUntil({ pin_locked_until: '2026-10-12T10:05:00.000Z' }, now);
    expect(until?.toISOString()).toBe('2026-10-12T10:05:00.000Z');
  });

  it('is open again afterwards', () => {
    expect(lockedUntil({ pin_locked_until: '2026-10-12T09:59:00.000Z' }, now)).toBeNull();
  });

  it('is open when it was never closed', () => {
    expect(lockedUntil({ pin_locked_until: null }, now)).toBeNull();
  });

  it('closes for long enough that guessing every PIN would take years', () => {
    // 10,000 PINs, five tries per lock: the guesser waits this long 2,000 times over.
    const years = ((10_000 / MAX_PIN_ATTEMPTS) * PIN_LOCK_MS) / (365 * 24 * 60 * 60_000);
    expect(years).toBeGreaterThan(0.05);
  });
});
