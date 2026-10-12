import { describe, expect, it } from 'vitest';

import { effectiveUnitPrice } from '@/src/domain/products/pricing';

describe('effectiveUnitPrice', () => {
  it('uses the discount price when it is a real discount', () => {
    expect(effectiveUnitPrice({ price: 56, discountPrice: 52 })).toBe(52);
  });

  it('falls back to the list price when there is no discount', () => {
    expect(effectiveUnitPrice({ price: 64, discountPrice: 0 })).toBe(64);
    expect(effectiveUnitPrice({ price: 64 })).toBe(64);
  });

  it('ignores a discount that is not below the list price', () => {
    expect(effectiveUnitPrice({ price: 50, discountPrice: 50 })).toBe(50);
    expect(effectiveUnitPrice({ price: 50, discountPrice: 60 })).toBe(50);
  });
});
