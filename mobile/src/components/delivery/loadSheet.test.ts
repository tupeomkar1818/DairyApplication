import { describe, expect, it } from 'vitest';

import { buildTodayEntries, type TodayEntry } from '@/src/components/admin/dashboardMetrics';
import { buildLoadSheet, loadSheetItemCount } from '@/src/components/delivery/loadSheet';
import type { CustomerResponse } from '@/src/domain/customers/dtos';

function entry(overrides: Partial<TodayEntry> = {}): TodayEntry {
  return {
    customerId: 'cust_1',
    name: 'Asha',
    mobile: '9876543210',
    route: 'Route A',
    planItems: [],
    addOnItems: [],
    amount: 0,
    status: 'Pending',
    ...overrides,
  };
}

describe('buildLoadSheet', () => {
  it('groups the same product and pack across stops', () => {
    const lines = buildLoadSheet([
      entry({ customerId: 'c1', planItems: ['Cow Milk · 500 ml'] }),
      entry({ customerId: 'c2', planItems: ['Cow Milk · 500 ml'] }),
      entry({ customerId: 'c3', planItems: ['Cow Milk · 1 L'] }),
    ]);

    expect(lines.map((l) => [l.label, l.count])).toEqual([
      ['Cow Milk · 1 L', 1],
      ['Cow Milk · 500 ml', 2],
    ]);
  });

  it('counts add-on orders too and flags the line', () => {
    const lines = buildLoadSheet([
      entry({ customerId: 'c1', planItems: ['Cow Milk · 500 ml'] }),
      entry({ customerId: 'c2', addOnItems: ['Cow Milk · 500 ml', 'Curd · 200 g'] }),
    ]);

    const milk = lines.find((l) => l.label === 'Cow Milk · 500 ml');
    const curd = lines.find((l) => l.label === 'Curd · 200 g');
    expect(milk).toMatchObject({ count: 2, hasAddOn: true, productName: 'Cow Milk', packLabel: '500 ml' });
    expect(curd).toMatchObject({ count: 1, hasAddOn: true });
  });

  it('leaves subscription-only lines unflagged', () => {
    const [line] = buildLoadSheet([entry({ planItems: ['Cow Milk · 500 ml'] })]);
    expect(line?.hasAddOn).toBe(false);
  });

  it('sorts by product then pack', () => {
    const lines = buildLoadSheet([
      entry({ planItems: ['Paneer · 250 g', 'Buffalo Milk · 1 L', 'Buffalo Milk · 500 ml'] }),
    ]);
    expect(lines.map((l) => l.label)).toEqual(['Buffalo Milk · 1 L', 'Buffalo Milk · 500 ml', 'Paneer · 250 g']);
  });

  it('handles labels without a pack size and skips blanks', () => {
    const lines = buildLoadSheet([entry({ planItems: ['Ghee', '   '] })]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ productName: 'Ghee', packLabel: '', count: 1 });
  });

  it('loads a combo as the packs inside it', () => {
    const c = {
      id: 'cust_1',
      name: 'Asha',
      mobile: '9876543210',
      routeName: 'Route A',
      subscriptionPlans: [],
      deliveries: [],
      subscriptionExceptions: [],
      extraOrders: [
        {
          id: 'combo_1',
          orderDate: '2026-09-16',
          deliveryDate: '2026-09-16',
          productName: 'Diwali box',
          quantityLabel: 'Combo',
          numberOfItems: 2,
          price: 599,
          status: 'Pending',
          offer: { offerId: 'box', kind: 'combo', title: { en: 'Diwali box' }, listPrice: 650 },
          comboItems: [
            { productName: 'Ghee', packLabel: '500 ml', quantity: 1 },
            { productName: 'Paneer', packLabel: '200 g', quantity: 2 },
          ],
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      ],
    } as unknown as CustomerResponse;
    const entries = buildTodayEntries([c], '2026-09-16');
    expect(entries[0]?.addOnItems).toEqual(['Diwali box (Ghee · 500 ml, Paneer · 200 g × 2) × 2']);
    const lines = buildLoadSheet(entries);
    expect(lines.map((l) => [l.label, l.count, l.hasAddOn])).toEqual([
      ['Ghee · 500 ml', 2, true],
      ['Paneer · 200 g', 4, true],
    ]);
    expect(loadSheetItemCount(lines)).toBe(6);
  });

  it('returns nothing for a day with no stops', () => {
    expect(buildLoadSheet([])).toEqual([]);
    expect(loadSheetItemCount([])).toBe(0);
  });
});

describe('loadSheetItemCount', () => {
  it('totals every item on the sheet, not just the line count', () => {
    const lines = buildLoadSheet([
      entry({ customerId: 'c1', planItems: ['Cow Milk · 500 ml'] }),
      entry({ customerId: 'c2', planItems: ['Cow Milk · 500 ml'], addOnItems: ['Curd · 200 g'] }),
    ]);
    expect(lines).toHaveLength(2);
    expect(loadSheetItemCount(lines)).toBe(3);
  });
});
