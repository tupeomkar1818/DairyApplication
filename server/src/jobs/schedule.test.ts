import { describe, expect, it } from 'vitest';

import type { Customer, Plan } from '@/customers/mapping';
import type { Row } from '@/customers/selfService';
import { orderForDay, packsOn, planRunsOn, remindable } from '@/jobs/schedule';

/**
 * The rules the evening job reads a day by. They are a port of the apps' own
 * (`mobile/src/domain/customers/daySchedule.ts`), so these cases mirror the app's: a difference here would show as
 * a reminder that does not match the day the customer then opens.
 */

const TS = '2026-10-01T00:00:00.000Z';

const plan = (over: Row = {}): Plan => ({
  id: 'sub_milk',
  productName: 'Cow Milk',
  quantityLabel: '500 ml',
  numberOfItems: 2,
  frequency: 'Daily',
  startDate: '2026-10-01',
  openEnded: true,
  status: 'Active',
  originalPrice: 30,
  discountedPrice: 0,
  createdAt: TS,
  ...over,
});

const customer = (over: Partial<Customer> = {}): Customer => ({
  id: 'cust_1',
  name: 'Meera Joshi',
  mobile: '9876500011',
  status: 'Active',
  subscriptionPlans: [plan()],
  subscriptionExceptions: [],
  extraOrders: [],
  createdAt: TS,
  updatedAt: TS,
  ...over,
});

describe('when a line is running', () => {
  it('runs from its first day, with no last day', () => {
    expect(planRunsOn(plan(), '2026-09-30')).toBe(false);
    expect(planRunsOn(plan(), '2026-10-01')).toBe(true);
    expect(planRunsOn(plan(), '2027-05-05')).toBe(true);
  });

  it('stops after its last day', () => {
    expect(planRunsOn(plan({ endDate: '2026-10-10' }), '2026-10-10')).toBe(true);
    expect(planRunsOn(plan({ endDate: '2026-10-10' }), '2026-10-11')).toBe(false);
  });

  it('does not run while it is paused, and runs again after', () => {
    const paused = plan({ pauseStartDate: '2026-10-05', pauseEndDate: '2026-10-07' });
    expect(planRunsOn(paused, '2026-10-04')).toBe(true);
    expect(planRunsOn(paused, '2026-10-06')).toBe(false);
    expect(planRunsOn(paused, '2026-10-08')).toBe(true);
  });

  it('a one-day line runs on its own day only', () => {
    const daily = plan({ subscriptionKind: 'Daily', deliveryDate: '2026-10-12' });
    expect(planRunsOn(daily, '2026-10-12')).toBe(true);
    expect(planRunsOn(daily, '2026-10-13')).toBe(false);
  });
});

describe('how many packs go out', () => {
  it('the usual quantity when nothing says otherwise', () => {
    expect(packsOn(plan(), '2026-10-12', [])).toBe(2);
  });

  it('none on a skipped day', () => {
    expect(packsOn(plan(), '2026-10-12', [{ kind: 'skip', fromYmd: '2026-10-12', toYmd: '2026-10-12' }])).toBe(0);
  });

  it('none when the whole day is skipped, whatever is subscribed', () => {
    expect(packsOn(plan(), '2026-10-12', [{ kind: 'skip', fromYmd: '2026-10-10', toYmd: '2026-10-15', planId: '' }])).toBe(0);
  });

  it('the quantity set for that day', () => {
    const change = { kind: 'quantity', planId: 'sub_milk', fromYmd: '2026-10-12', toYmd: '2026-10-12', numberOfItems: 5, createdAt: TS };
    expect(packsOn(plan(), '2026-10-12', [change])).toBe(5);
  });

  it('the newest one when a day was changed twice', () => {
    const changes = [
      { kind: 'quantity', planId: 'sub_milk', fromYmd: '2026-10-12', toYmd: '2026-10-12', numberOfItems: 5, createdAt: '2026-10-11T08:00:00.000Z' },
      { kind: 'quantity', planId: 'sub_milk', fromYmd: '2026-10-12', toYmd: '2026-10-12', numberOfItems: 3, createdAt: '2026-10-11T09:00:00.000Z' },
    ];
    expect(packsOn(plan(), '2026-10-12', changes)).toBe(3);
  });

  it('a skip beats a quantity change for the same day', () => {
    const changes = [
      { kind: 'quantity', planId: 'sub_milk', fromYmd: '2026-10-12', toYmd: '2026-10-12', numberOfItems: 5, createdAt: TS },
      { kind: 'skip', fromYmd: '2026-10-12', toYmd: '2026-10-12', planId: 'sub_milk' },
    ];
    expect(packsOn(plan(), '2026-10-12', changes)).toBe(0);
  });
});

describe('what the reminder reads', () => {
  it('names the lines and adds up the day', () => {
    const order = orderForDay(customer(), '2026-10-12', 'en');
    expect(order).toEqual({ planItems: ['Cow Milk · 500 ml × 2'], addOnItems: [], amount: 60 });
  });

  it('bills a discounted line at its discounted price', () => {
    const order = orderForDay(customer({ subscriptionPlans: [plan({ discountedPrice: 25 })] }), '2026-10-12', 'en');
    expect(order?.amount).toBe(50);
  });

  it('counts the one-off orders for that day, and leaves a cancelled one out', () => {
    const withAddOns = customer({
      extraOrders: [
        { id: 'e1', deliveryDate: '2026-10-12', productName: 'Paneer', quantityLabel: '200 g', numberOfItems: 2, price: 100, status: 'Pending' },
        { id: 'e2', deliveryDate: '2026-10-12', productName: 'Ghee', quantityLabel: '200 ml', numberOfItems: 1, price: 240, status: 'Cancelled' },
      ],
    });
    const order = orderForDay(withAddOns, '2026-10-12', 'en');
    expect(order).toEqual({ planItems: ['Cow Milk · 500 ml × 2'], addOnItems: ['Paneer · 200 g × 2'], amount: 260 });
  });

  it('reads a combo by its offer’s name, in the reader’s language', () => {
    const withCombo = customer({
      extraOrders: [
        {
          id: 'e3',
          deliveryDate: '2026-10-12',
          productName: 'Festival box',
          quantityLabel: 'Combo',
          numberOfItems: 1,
          price: 499,
          status: 'Pending',
          offer: { offerId: 'offer_box', kind: 'combo', title: { en: 'Festival box', mr: 'सणाचा बॉक्स' } },
          comboItems: [{ productName: 'Shrikhand', packLabel: '500 g', quantity: 2 }],
        },
      ],
    });
    expect(orderForDay(withCombo, '2026-10-12', 'en')?.addOnItems).toEqual(['Festival box (Shrikhand · 500 g × 2)']);
    expect(orderForDay(withCombo, '2026-10-12', 'mr')?.addOnItems).toEqual(['सणाचा बॉक्स (Shrikhand · 500 g × 2)']);
  });

  it('says nothing when nothing is going that day', () => {
    expect(orderForDay(customer({ subscriptionPlans: [] }), '2026-10-12', 'en')).toBeNull();
    const skipped = customer({ subscriptionExceptions: [{ kind: 'skip', fromYmd: '2026-10-12', toYmd: '2026-10-12' }] });
    expect(orderForDay(skipped, '2026-10-12', 'en')).toBeNull();
  });
});

describe('who hears from the dairy', () => {
  it('leaves out closed accounts and anyone without the app', () => {
    expect(remindable(customer())).toBe(true);
    expect(remindable(customer({ status: 'Inactive' }))).toBe(false);
    expect(remindable(customer({ appAccessEnabled: false }))).toBe(false);
  });
});
