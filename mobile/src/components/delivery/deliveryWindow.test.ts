import { describe, expect, it } from 'vitest';

import {
  canMarkDeliveryDay,
  deliveryDayOrToday,
  isVisibleDeliveryDay,
  lastVisibleDeliveryDay,
} from '@/src/components/delivery/deliveryWindow';

describe('what a delivery partner can see', () => {
  const today = '2026-09-30';

  it('reaches as far as tomorrow, across a month end', () => {
    expect(lastVisibleDeliveryDay(today)).toBe('2026-10-01');
    expect(isVisibleDeliveryDay('2026-09-12', today)).toBe(true);
    expect(isVisibleDeliveryDay('2026-10-01', today)).toBe(true);
    expect(isVisibleDeliveryDay('2026-10-02', today)).toBe(false);
  });

  it('lets only days that have come be marked', () => {
    expect(canMarkDeliveryDay('2026-09-30', today)).toBe(true);
    expect(canMarkDeliveryDay('2026-09-29', today)).toBe(true);
    expect(canMarkDeliveryDay('2026-10-01', today)).toBe(false);
  });

  it('opens a linked day only when it is within reach', () => {
    expect(deliveryDayOrToday('2026-10-01', today)).toBe('2026-10-01');
    expect(deliveryDayOrToday('2026-10-05', today)).toBe(today);
    expect(deliveryDayOrToday('nonsense', today)).toBe(today);
    expect(deliveryDayOrToday(undefined, today)).toBe(today);
  });
});
