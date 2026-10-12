import { describe, expect, it } from 'vitest';

import {
  addOnDateYmd,
  addOnLabel,
  addOnLineTotal,
  addOnsForDate,
  deliveredAddOnsForMonth,
  deliveredAddOnTotalForMonth,
} from '@/src/domain/customers/addOns';
import type { Customer, CustomerExtraOrder } from '@/src/domain/customers/entities';

const TS = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };

function order(overrides: Partial<CustomerExtraOrder> = {}): CustomerExtraOrder {
  return {
    id: 'extra_1',
    orderDate: '2026-09-16',
    productName: 'Paneer',
    quantityLabel: '200 gram',
    price: 90,
    status: 'Pending',
    ...TS,
    ...overrides,
  } as CustomerExtraOrder;
}

function customer(orders: CustomerExtraOrder[]): Pick<Customer, 'extraOrders'> {
  return { extraOrders: orders };
}

describe('addOnDateYmd', () => {
  it('prefers the delivery date over the day it was placed', () => {
    expect(addOnDateYmd(order({ orderDate: '2026-09-14', deliveryDate: '2026-09-16' }))).toBe('2026-09-16');
    expect(addOnDateYmd(order({ orderDate: '2026-09-14T10:00:00.000Z' }))).toBe('2026-09-14');
  });
});

describe('addOnLineTotal', () => {
  it('multiplies the price snapshot by the number of packs', () => {
    expect(addOnLineTotal(order())).toBe(90);
    expect(addOnLineTotal(order({ numberOfItems: 3 }))).toBe(270);
  });

  it('treats a missing or nonsense count as one pack', () => {
    expect(addOnLineTotal(order({ numberOfItems: 0 }))).toBe(90);
    expect(addOnLineTotal(order({ numberOfItems: Number.NaN }))).toBe(90);
  });
});

describe('addOnsForDate', () => {
  it('returns the orders still standing for that day', () => {
    const c = customer([
      order(),
      order({ id: 'extra_2', status: 'Cancelled' }),
      order({ id: 'extra_3', orderDate: '2026-09-17' }),
    ]);

    expect(addOnsForDate(c, '2026-09-16').map((o) => o.id)).toEqual(['extra_1']);
  });

  it('keeps an already delivered order on its day', () => {
    expect(addOnsForDate(customer([order({ status: 'Delivered' })]), '2026-09-16')).toHaveLength(1);
  });
});

describe('addOnLabel', () => {
  it('reads like a stop line, with the count only when there is more than one', () => {
    expect(addOnLabel(order())).toBe('Paneer · 200 gram');
    expect(addOnLabel(order({ numberOfItems: 2 }))).toBe('Paneer · 200 gram × 2');
  });
});

describe('deliveredAddOnTotalForMonth', () => {
  it('counts delivered orders only', () => {
    const c = customer([
      order({ status: 'Delivered' }),
      order({ id: 'extra_2', status: 'Pending', price: 50 }),
      order({ id: 'extra_3', status: 'Cancelled', price: 70 }),
    ]);

    expect(deliveredAddOnTotalForMonth(c, '2026-09')).toBe(90);
  });

  it('counts packs, and only the month asked for', () => {
    const c = customer([
      order({ status: 'Delivered', numberOfItems: 2 }),
      order({ id: 'extra_2', status: 'Delivered', orderDate: '2026-08-31', price: 40 }),
    ]);

    expect(deliveredAddOnTotalForMonth(c, '2026-09')).toBe(180);
    expect(deliveredAddOnTotalForMonth(c, '2026-08')).toBe(40);
  });

  it('is zero for a customer who never ordered extras', () => {
    expect(deliveredAddOnTotalForMonth({}, '2026-09')).toBe(0);
  });
});

describe('deliveredAddOnsForMonth', () => {
  it('lists the month delivered orders oldest first', () => {
    const c = customer([
      order({ id: 'extra_late', status: 'Delivered', orderDate: '2026-09-20' }),
      order({ id: 'extra_early', status: 'Delivered', orderDate: '2026-09-02' }),
      order({ id: 'extra_pending', status: 'Pending', orderDate: '2026-09-05' }),
    ]);

    expect(deliveredAddOnsForMonth(c, '2026-09').map((o) => o.id)).toEqual(['extra_early', 'extra_late']);
  });
});
