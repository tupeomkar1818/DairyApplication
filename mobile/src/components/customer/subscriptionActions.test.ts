import { describe, expect, it } from 'vitest';

import { computeCustomerMonthBillTotal } from '@/src/components/admin/customerSubscriptionMonthUtils';
import { DayLockedError, SubscriptionDateError } from '@/src/components/customer/customerActions';
import {
  buildSubscriptionCards,
  changeDailyQuantity,
  changeEndDate,
  describeDayChange,
  describeDayChangeDates,
  lastArrangedDayYmd,
  removeDayChange,
  stopSubscription,
} from '@/src/components/customer/subscriptionActions';
import { planQuantityOn } from '@/src/domain/customers/daySchedule';
import type { CustomerResponse } from '@/src/domain/customers/dtos';

const TS = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
/** 10 pm on 15 Sep: the 16th is already arranged, so the first day a change reaches is the 17th. */
const LATE_ON_15TH = new Date(2026, 8, 15, 22, 0, 0);
/** 8 am on 15 Sep: the 16th can still change. */
const MORNING_15TH = new Date(2026, 8, 15, 8, 0, 0);

type Plan = NonNullable<CustomerResponse['subscriptionPlans']>[number];
type Exception = NonNullable<CustomerResponse['subscriptionExceptions']>[number];
type Delivery = NonNullable<CustomerResponse['deliveries']>[number];

function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'sub_milk',
    productName: 'Cow Milk',
    quantityLabel: '500 ml',
    numberOfItems: 1,
    deliveryTime: 'Morning',
    frequency: 'Daily',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    originalPrice: 56,
    discountedPrice: 52,
    status: 'Active',
    ...TS,
    ...overrides,
  } as Plan;
}

function customer(overrides: Partial<CustomerResponse> = {}): CustomerResponse {
  return {
    id: 'cust_1',
    name: 'Asha',
    mobile: '9876543210',
    address: 'A-1',
    societyName: 'Green View',
    deliveryTime: 'Morning',
    paymentType: 'Cash',
    status: 'Active',
    subscription: [],
    subscriptionPlans: [plan()],
    extraOrders: [],
    subscriptionExceptions: [],
    deliveries: [],
    monthlyBillAmount: 0,
    nextDeliveryDate: '2026-09-16',
    ...TS,
    ...overrides,
  } as CustomerResponse;
}

function delivered(ymd: string, extra: Partial<Delivery> = {}): Delivery {
  return { id: `d_${ymd}`, deliveryDate: ymd, productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Delivered', ...TS, ...extra } as Delivery;
}

function change(overrides: Partial<Exception>): Exception {
  return { id: 'ex', fromYmd: '2026-09-20', toYmd: '2026-09-20', createdBy: 'customer', ...TS, ...overrides } as Exception;
}

describe('lastArrangedDayYmd', () => {
  it('is today before the cut-off, and tomorrow after it', () => {
    expect(lastArrangedDayYmd(customer(), MORNING_15TH)).toBe('2026-09-15');
    expect(lastArrangedDayYmd(customer(), LATE_ON_15TH)).toBe('2026-09-16');
  });
});

describe('changeDailyQuantity', () => {
  it('changes the everyday quantity from the first day a change can reach', () => {
    const res = changeDailyQuantity(customer(), { planId: 'sub_milk', numberOfItems: 2, now: LATE_ON_15TH });
    expect(res.fromYmd).toBe('2026-09-17');
    expect(res.subscriptionPlans[0]!.numberOfItems).toBe(2);
  });

  it('holds the days already arranged at the old quantity', () => {
    const res = changeDailyQuantity(customer(), { planId: 'sub_milk', numberOfItems: 2, now: LATE_ON_15TH });
    const next = customer({ subscriptionPlans: res.subscriptionPlans, subscriptionExceptions: res.subscriptionExceptions });

    expect(planQuantityOn(next.subscriptionPlans![0]!, '2026-09-15', next.subscriptionExceptions)).toBe(1);
    expect(planQuantityOn(next.subscriptionPlans![0]!, '2026-09-16', next.subscriptionExceptions)).toBe(1);
    expect(planQuantityOn(next.subscriptionPlans![0]!, '2026-09-17', next.subscriptionExceptions)).toBe(2);
    expect(planQuantityOn(next.subscriptionPlans![0]!, '2026-09-30', next.subscriptionExceptions)).toBe(2);
  });

  it('does not hold a day that was already delivered', () => {
    const res = changeDailyQuantity(customer({ deliveries: [delivered('2026-09-15', { subscriptionItems: 1 })] }), {
      planId: 'sub_milk',
      numberOfItems: 2,
      now: LATE_ON_15TH,
    });
    expect(res.subscriptionExceptions.map((e) => e.fromYmd)).toEqual(['2026-09-16']);
  });

  it('leaves the bill for days already delivered exactly as it was', () => {
    const before = customer({ deliveries: [delivered('2026-09-10'), delivered('2026-09-11')] });
    const billBefore = computeCustomerMonthBillTotal(before, '2026-09');

    const res = changeDailyQuantity(before, { planId: 'sub_milk', numberOfItems: 3, now: LATE_ON_15TH });
    const after = customer({
      subscriptionPlans: res.subscriptionPlans,
      subscriptionExceptions: res.subscriptionExceptions,
      deliveries: res.deliveries,
    });

    expect(billBefore).toBe(104);
    expect(computeCustomerMonthBillTotal(after, '2026-09')).toBe(104);
    expect(res.deliveries.map((d) => d.subscriptionItems)).toEqual([1, 1]);
  });

  it('does nothing when the quantity is already the usual one', () => {
    const c = customer();
    const res = changeDailyQuantity(c, { planId: 'sub_milk', numberOfItems: 1, now: LATE_ON_15TH });
    expect(res.subscriptionPlans).toBe(c.subscriptionPlans);
    expect(res.subscriptionExceptions).toEqual([]);
  });

  it('keeps the quantity between 1 and the daily limit', () => {
    expect(changeDailyQuantity(customer(), { planId: 'sub_milk', numberOfItems: 0, now: LATE_ON_15TH }).subscriptionPlans[0]!.numberOfItems).toBe(1);
    expect(changeDailyQuantity(customer(), { planId: 'sub_milk', numberOfItems: 99, now: LATE_ON_15TH }).subscriptionPlans[0]!.numberOfItems).toBe(20);
  });
});

describe('changeEndDate', () => {
  it('extends a subscription', () => {
    const res = changeEndDate(customer(), { planId: 'sub_milk', endYmd: '2026-12-31', now: MORNING_15TH });
    expect(res.subscriptionPlans[0]).toMatchObject({ endDate: '2026-12-31', openEnded: false, status: 'Active' });
  });

  it('makes a subscription run until stopped', () => {
    const res = changeEndDate(customer(), { planId: 'sub_milk', now: MORNING_15TH });
    expect(res.subscriptionPlans[0]).toMatchObject({ endDate: undefined, openEnded: true });
  });

  it('refuses an end before the start', () => {
    const c = customer({ subscriptionPlans: [plan({ startDate: '2026-09-20' })] });
    expect(() => changeEndDate(c, { planId: 'sub_milk', endYmd: '2026-09-18', now: MORNING_15TH })).toThrow(
      'The end date must be on or after the start date.',
    );
  });

  it('refuses an end that would cut off days already arranged', () => {
    expect(() => changeEndDate(customer(), { planId: 'sub_milk', endYmd: '2026-09-15', now: LATE_ON_15TH })).toThrow(
      SubscriptionDateError,
    );
    expect(() => changeEndDate(customer(), { planId: 'sub_milk', endYmd: '2026-09-16', now: LATE_ON_15TH })).not.toThrow();
  });
});

describe('stopSubscription', () => {
  it('ends a running subscription after the days already arranged, keeping it active until then', () => {
    const res = stopSubscription(customer(), { planId: 'sub_milk', now: LATE_ON_15TH });
    expect(res.lastDayYmd).toBe('2026-09-16');
    expect(res.subscriptionPlans[0]).toMatchObject({ endDate: '2026-09-16', status: 'Active', openEnded: false });
  });

  it('keeps an earlier end date that is already sooner', () => {
    const c = customer({ subscriptionPlans: [plan({ endDate: '2026-09-15' })] });
    expect(stopSubscription(c, { planId: 'sub_milk', now: LATE_ON_15TH }).lastDayYmd).toBe('2026-09-15');
  });

  it('cancels a subscription that has not started delivering', () => {
    const c = customer({ subscriptionPlans: [plan({ startDate: '2026-09-20' })] });
    const res = stopSubscription(c, { planId: 'sub_milk', now: MORNING_15TH });
    expect(res.lastDayYmd).toBeNull();
    expect(res.subscriptionPlans[0]!.status).toBe('Inactive');
  });
});

describe('removeDayChange', () => {
  it('removes a change that has not started', () => {
    const c = customer({ subscriptionExceptions: [change({ kind: 'skip' })] });
    expect(removeDayChange(c, { exceptionId: 'ex', now: MORNING_15TH }).subscriptionExceptions).toEqual([]);
  });

  it('ends a pause that is under way before the first day a change can reach', () => {
    const c = customer({ subscriptionExceptions: [change({ kind: 'skip', fromYmd: '2026-09-14', toYmd: '2026-09-25' })] });
    const res = removeDayChange(c, { exceptionId: 'ex', now: LATE_ON_15TH });
    expect(res.subscriptionExceptions[0]).toMatchObject({ fromYmd: '2026-09-14', toYmd: '2026-09-16' });
  });

  it('refuses a change that is wholly in the past or already arranged', () => {
    const c = customer({ subscriptionExceptions: [change({ kind: 'skip', fromYmd: '2026-09-15', toYmd: '2026-09-16' })] });
    expect(() => removeDayChange(c, { exceptionId: 'ex', now: LATE_ON_15TH })).toThrow(DayLockedError);
  });
});

describe('buildSubscriptionCards', () => {
  const today = '2026-09-16';

  it('describes an active line with its dates and daily value', () => {
    const [card] = buildSubscriptionCards(customer({ subscriptionPlans: [plan({ numberOfItems: 2 })] }), today);
    expect(card).toMatchObject({ status: 'active', statusLabel: 'Active', usual: 2, unitPrice: 52, dailyValue: 104 });
    expect(card!.datesLabel).toContain('–');
  });

  it('marks lines starting later, ending within a week, off today, or ended', () => {
    const cards = buildSubscriptionCards(
      customer({
        subscriptionPlans: [
          plan({ id: 'a', productName: 'A', startDate: '2026-09-20' }),
          plan({ id: 'b', productName: 'B', endDate: '2026-09-20' }),
          plan({ id: 'c', productName: 'C' }),
          plan({ id: 'd', productName: 'D', endDate: '2026-09-12' }),
        ],
        subscriptionExceptions: [change({ id: 'off', kind: 'skip', planId: 'c', fromYmd: today, toYmd: today })],
      }),
      today,
    );
    expect(cards.map((c) => [c.plan.id, c.status])).toEqual([
      ['a', 'starts'],
      ['b', 'ending'],
      ['c', 'offToday'],
      ['d', 'ended'],
    ]);
  });

  it('leaves out lines ended over a week ago and lines cancelled before starting', () => {
    const cards = buildSubscriptionCards(
      customer({
        subscriptionPlans: [
          plan({ id: 'old', endDate: '2026-09-01' }),
          plan({ id: 'cancelled', status: 'Inactive' }),
          plan({ id: 'open', openEnded: true, endDate: undefined }),
        ],
      }),
      today,
    );
    expect(cards.map((c) => c.plan.id)).toEqual(['open']);
    expect(cards[0]!.datesLabel).toContain('no end date');
  });

  it('lists upcoming changes for the product and whole-subscription pauses, not other products', () => {
    const [card] = buildSubscriptionCards(
      customer({
        subscriptionExceptions: [
          change({ id: 'mine', kind: 'quantity', planId: 'sub_milk', numberOfItems: 3 }),
          change({ id: 'pause', kind: 'skip', fromYmd: '2026-09-18', toYmd: '2026-09-19' }),
          change({ id: 'other', kind: 'quantity', planId: 'sub_curd', numberOfItems: 2 }),
          change({ id: 'past', kind: 'skip', planId: 'sub_milk', fromYmd: '2026-09-10', toYmd: '2026-09-10' }),
        ],
      }),
      today,
    );
    expect(card!.upcoming.map((e) => e.id)).toEqual(['pause', 'mine']);
  });

  it('leaves out changes on days already arranged, which can no longer be undone', () => {
    const cards = buildSubscriptionCards(
      customer({
        subscriptionExceptions: [
          change({ id: 'held', kind: 'quantity', planId: 'sub_milk', fromYmd: today, toYmd: today, numberOfItems: 1 }),
          change({ id: 'running', kind: 'skip', planId: 'sub_milk', fromYmd: today, toYmd: '2026-09-20' }),
        ],
      }),
      today,
      '2026-09-17',
    );
    // The pause still has days ahead, so it can be cut short; the one-day hold cannot.
    expect(cards[0]!.upcoming.map((e) => e.id)).toEqual(['running']);
  });
});

describe('describing day changes', () => {
  it('reads plainly', () => {
    expect(describeDayChange(change({ kind: 'quantity', planId: 'x', numberOfItems: 3 }), 1)).toBe('× 3');
    expect(describeDayChange(change({ kind: 'quantity', planId: 'x', numberOfItems: 0 }), 1)).toBe('None');
    expect(describeDayChange(change({ kind: 'skip', planId: 'x' }), 1)).toBe('Skipped');
    expect(describeDayChange(change({ kind: 'skip' }), 1)).toBe('Everything paused');
    expect(describeDayChangeDates(change({ fromYmd: '2026-09-10', toYmd: '2026-09-12' }))).toContain('–');
  });
});
