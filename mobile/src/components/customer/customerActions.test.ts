import { describe, expect, it } from 'vitest';

import {
  cancelAddOnOrder,
  DayLockedError,
  findPendingAddOn,
  isOrderableByCustomer,
  nextOrderableDayYmd,
  placeAddOnOrder,
  setAddOnItems,
  setPlanQuantityForDays,
  skipDays,
  SubscriptionDateError,
  subscribeToProduct,
  unskipDay,
  validateSubscriptionDates,
} from '@/src/components/customer/customerActions';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { ProductResponse } from '@/src/domain/products/dtos';
import type { ProductPack } from '@/src/domain/products/entities';

const TS = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
const NOW_ISO = '2026-09-15T10:00:00.000Z';
/** 8 am on the 15th: well before the 9 pm cut-off for the 16th. */
const NOW = new Date(2026, 8, 15, 8, 0, 0);
const TOMORROW = '2026-09-16';

const PACK_250: ProductPack = { id: 'pk_250', label: '250 ml', unit: 'ml', quantity: 250, price: 60, discountPrice: 55 };
const PACK_500: ProductPack = { id: 'pk_500', label: '500 ml', unit: 'ml', quantity: 500, price: 100, discountPrice: 90 };

function product(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id: 'prod_1',
    name: 'Paneer',
    category: 'Milk Product',
    productType: 'Milk Product',
    price: 100,
    discountPrice: 90,
    unit: 'Gram',
    variants: ['250 ml', '500 ml'],
    description: '',
    availableStock: 10,
    availableDays: [],
    deliveryTimeSlots: [],
    availability: 'Available',
    features: [],
    taxApplicable: false,
    isVisibleToCustomer: true,
    isVisibleOfflineCounter: true,
    isActive: true,
    ...TS,
    ...overrides,
  } as ProductResponse;
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
    routeName: 'Route A',
    subscription: [],
    subscriptionPlans: [],
    extraOrders: [],
    subscriptionExceptions: [],
    deliveries: [],
    monthlyBillAmount: 0,
    nextDeliveryDate: TOMORROW,
    ...TS,
    ...overrides,
  } as CustomerResponse;
}

describe('isOrderableByCustomer', () => {
  it('hides inactive or customer-invisible products', () => {
    expect(isOrderableByCustomer(product())).toBe(true);
    expect(isOrderableByCustomer(product({ isActive: false }))).toBe(false);
    expect(isOrderableByCustomer(product({ isVisibleToCustomer: false }))).toBe(false);
  });
});

describe('placeAddOnOrder', () => {
  it('records the order with the price of the day it was placed', () => {
    const { order, extraOrders } = placeAddOnOrder(customer(), {
      product: product(),
      pack: PACK_500,
      numberOfItems: 2,
      dateYmd: TOMORROW,
      now: NOW,
      nowIso: NOW_ISO,
    });

    expect(extraOrders).toHaveLength(1);
    expect(order).toMatchObject({
      productName: 'Paneer',
      quantityLabel: '500 ml',
      numberOfItems: 2,
      price: 90,
      status: 'Pending',
      placedBy: 'customer',
      deliveryDate: TOMORROW,
    });
  });

  it('prices the order from the chosen pack, not the product', () => {
    const small = placeAddOnOrder(customer(), {
      product: product(),
      pack: PACK_250,
      numberOfItems: 1,
      dateYmd: TOMORROW,
      now: NOW,
    }).order;
    const large = placeAddOnOrder(customer(), {
      product: product(),
      pack: PACK_500,
      numberOfItems: 1,
      dateYmd: TOMORROW,
      now: NOW,
    }).order;

    expect([small.quantityLabel, small.price, small.packId]).toEqual(['250 ml', 55, 'pk_250']);
    expect([large.quantityLabel, large.price, large.packId]).toEqual(['500 ml', 90, 'pk_500']);
  });

  it('refuses a day that is past the cut-off', () => {
    const lateEvening = new Date(2026, 8, 15, 22, 0, 0);
    expect(() =>
      placeAddOnOrder(customer(), {
        product: product(),
        pack: PACK_500,
        numberOfItems: 1,
        dateYmd: TOMORROW,
        now: lateEvening,
      }),
    ).toThrow(DayLockedError);
  });

  it('refuses a day that has already been delivered', () => {
    const delivered = customer({
      deliveries: [
        {
          id: 'del_1',
          deliveryDate: TOMORROW,
          productName: 'Cow Milk',
          quantityLabel: '500 ml',
          status: 'Delivered',
          ...TS,
        },
      ] as CustomerResponse['deliveries'],
    });

    expect(() =>
      placeAddOnOrder(delivered, {
        product: product(),
        pack: PACK_500,
        numberOfItems: 1,
        dateYmd: TOMORROW,
        now: NOW,
      }),
    ).toThrow('This day has already been delivered.');
  });
});

describe('cancelAddOnOrder', () => {
  it('marks the order cancelled rather than deleting it', () => {
    const placed = placeAddOnOrder(customer(), {
      product: product(),
      pack: PACK_500,
      numberOfItems: 1,
      dateYmd: TOMORROW,
      now: NOW,
      nowIso: NOW_ISO,
    });
    const c = customer({ extraOrders: placed.extraOrders });

    const { extraOrders } = cancelAddOnOrder(c, placed.order.id, { now: NOW, nowIso: NOW_ISO });
    expect(extraOrders[0]).toMatchObject({ id: placed.order.id, status: 'Cancelled' });
  });

  it('does nothing for an order that is not there', () => {
    const c = customer();
    expect(cancelAddOnOrder(c, 'nope', { now: NOW }).order).toBeNull();
  });
});

describe('skipDays', () => {
  it('records a single day', () => {
    const { skip } = skipDays(customer(), { fromYmd: TOMORROW, now: NOW, nowIso: NOW_ISO });
    expect(skip).toMatchObject({ fromYmd: TOMORROW, toYmd: TOMORROW, createdBy: 'customer' });
  });

  it('records a stretch of days, and a backwards range collapses to one day', () => {
    expect(skipDays(customer(), { fromYmd: TOMORROW, toYmd: '2026-09-30', now: NOW }).skip.toYmd).toBe('2026-09-30');
    expect(skipDays(customer(), { fromYmd: TOMORROW, toYmd: '2026-09-01', now: NOW }).skip.toYmd).toBe(TOMORROW);
  });

  it('can be limited to one subscription line', () => {
    const { skip } = skipDays(customer(), { fromYmd: TOMORROW, planId: 'sub_1', now: NOW });
    expect(skip.planId).toBe('sub_1');
  });

  it('refuses a day past the cut-off', () => {
    const lateEvening = new Date(2026, 8, 15, 22, 0, 0);
    expect(() => skipDays(customer(), { fromYmd: TOMORROW, now: lateEvening })).toThrow(DayLockedError);
  });
});

describe('unskipDay', () => {
  it('removes the skip', () => {
    const first = skipDays(customer(), { fromYmd: TOMORROW, now: NOW, nowIso: NOW_ISO });
    const c = customer({ subscriptionExceptions: first.subscriptionExceptions });

    expect(unskipDay(c, first.skip.id, { now: NOW }).subscriptionExceptions).toEqual([]);
  });

  it('leaves an unknown id alone', () => {
    const c = customer();
    expect(unskipDay(c, 'nope', { now: NOW }).subscriptionExceptions).toEqual([]);
  });
});

describe('subscribeToProduct', () => {
  it('creates a daily line priced from the catalog', () => {
    const { plan } = subscribeToProduct(customer(), {
      product: product({ name: 'Cow Milk' }),
      pack: { ...PACK_500, price: 60, discountPrice: 55 },
      numberOfItems: 1,
      startYmd: TOMORROW,
      nowIso: NOW_ISO,
    });

    expect(plan).toMatchObject({
      productName: 'Cow Milk',
      quantityLabel: '500 ml',
      frequency: 'Daily',
      status: 'Active',
      startDate: TOMORROW,
      originalPrice: 60,
      discountedPrice: 55,
      effectiveFinalPrice: 55,
    });
  });

  it('keeps the lines the customer already had', () => {
    const first = subscribeToProduct(customer(), {
      product: product(),
      pack: PACK_500,
      numberOfItems: 1,
      startYmd: TOMORROW,
    });
    const second = subscribeToProduct(customer({ subscriptionPlans: first.subscriptionPlans }), {
      product: product({ name: 'Curd' }),
      pack: PACK_250,
      numberOfItems: 1,
      startYmd: TOMORROW,
    });

    expect(second.subscriptionPlans.map((p) => p.productName)).toEqual(['Paneer', 'Curd']);
  });
});

describe('nextOrderableDayYmd', () => {
  it('is tomorrow while tonight cut-off has not passed', () => {
    expect(nextOrderableDayYmd(customer(), new Date(2026, 8, 15, 8, 0, 0))).toBe('2026-09-16');
  });

  it('moves to the day after once the cut-off has passed', () => {
    expect(nextOrderableDayYmd(customer(), new Date(2026, 8, 15, 22, 0, 0))).toBe('2026-09-17');
  });

  it('skips a day that has already been delivered', () => {
    const delivered = customer({
      deliveries: [
        {
          id: 'del_1',
          deliveryDate: '2026-09-16',
          productName: 'Cow Milk',
          quantityLabel: '500 ml',
          status: 'Delivered',
          ...TS,
        },
      ] as CustomerResponse['deliveries'],
    });

    expect(nextOrderableDayYmd(delivered, new Date(2026, 8, 15, 8, 0, 0))).toBe('2026-09-17');
  });
});

describe('findPendingAddOn', () => {
  it('finds the open order for that product, pack and day', () => {
    const placed = placeAddOnOrder(customer(), {
      product: product(),
      pack: PACK_500,
      numberOfItems: 1,
      dateYmd: TOMORROW,
      now: NOW,
    });
    const c = customer({ extraOrders: placed.extraOrders });

    expect(findPendingAddOn(c, TOMORROW, 'Paneer', PACK_500)?.id).toBe(placed.order.id);
    expect(findPendingAddOn(c, TOMORROW, 'Paneer', PACK_250)).toBeNull();
    expect(findPendingAddOn(c, '2026-09-18', 'Paneer', PACK_500)).toBeNull();
  });

  it('matches an older order that has no pack id by its label', () => {
    const legacy = customer({
      extraOrders: [
        {
          id: 'extra_old',
          orderDate: TOMORROW,
          productName: 'Paneer',
          quantityLabel: '500 ml',
          price: 90,
          status: 'Pending',
          ...TS,
        },
      ] as CustomerResponse['extraOrders'],
    });

    expect(findPendingAddOn(legacy, TOMORROW, 'Paneer', PACK_500)?.id).toBe('extra_old');
  });

  it('ignores cancelled and delivered orders', () => {
    const placed = placeAddOnOrder(customer(), {
      product: product(),
      pack: PACK_500,
      numberOfItems: 1,
      dateYmd: TOMORROW,
      now: NOW,
    });
    const cancelled = cancelAddOnOrder(customer({ extraOrders: placed.extraOrders }), placed.order.id, { now: NOW });

    expect(findPendingAddOn(customer({ extraOrders: cancelled.extraOrders }), TOMORROW, 'Paneer', PACK_500)).toBeNull();
  });
});

describe('setAddOnItems', () => {
  function placedCustomer() {
    const placed = placeAddOnOrder(customer(), {
      product: product(),
      pack: PACK_500,
      numberOfItems: 1,
      dateYmd: TOMORROW,
      now: NOW,
      nowIso: NOW_ISO,
    });
    return { c: customer({ extraOrders: placed.extraOrders }), id: placed.order.id };
  }

  it('changes how many packs the order is for', () => {
    const { c, id } = placedCustomer();
    const { extraOrders } = setAddOnItems(c, id, 3, { now: NOW, nowIso: NOW_ISO });
    expect(extraOrders[0]).toMatchObject({ numberOfItems: 3, status: 'Pending' });
  });

  it('cancels the order when it drops to zero', () => {
    const { c, id } = placedCustomer();
    const { extraOrders } = setAddOnItems(c, id, 0, { now: NOW, nowIso: NOW_ISO });
    expect(extraOrders[0]!.status).toBe('Cancelled');
  });

  it('refuses once the day is locked', () => {
    const { c, id } = placedCustomer();
    expect(() => setAddOnItems(c, id, 2, { now: new Date(2026, 8, 15, 22, 0, 0) })).toThrow(DayLockedError);
  });
});

describe('setPlanQuantityForDays', () => {
  function subscribed() {
    const { subscriptionPlans, plan } = subscribeToProduct(customer(), {
      product: product(),
      pack: PACK_500,
      numberOfItems: 1,
      startYmd: TOMORROW,
      endYmd: '2026-09-30',
      nowIso: NOW_ISO,
    });
    return { c: customer({ subscriptionPlans }), planId: plan.id };
  }

  it('records a quantity change for one day', () => {
    const { c, planId } = subscribed();
    const { subscriptionExceptions } = setPlanQuantityForDays(c, { planId, fromYmd: TOMORROW, numberOfItems: 3, now: NOW });
    expect(subscriptionExceptions).toEqual([
      expect.objectContaining({ kind: 'quantity', planId, fromYmd: TOMORROW, toYmd: TOMORROW, numberOfItems: 3 }),
    ]);
  });

  it('replaces an earlier change on the same day instead of stacking them', () => {
    const { c, planId } = subscribed();
    const first = setPlanQuantityForDays(c, { planId, fromYmd: TOMORROW, numberOfItems: 2, now: NOW });
    const second = setPlanQuantityForDays(
      { ...c, subscriptionExceptions: first.subscriptionExceptions },
      { planId, fromYmd: TOMORROW, numberOfItems: 3, now: NOW },
    );
    expect(second.subscriptionExceptions).toHaveLength(1);
    expect(second.subscriptionExceptions[0]!.numberOfItems).toBe(3);
  });

  it('clears the change when set back to the usual quantity', () => {
    const { c, planId } = subscribed();
    const raised = setPlanQuantityForDays(c, { planId, fromYmd: TOMORROW, numberOfItems: 3, now: NOW });
    const back = setPlanQuantityForDays(
      { ...c, subscriptionExceptions: raised.subscriptionExceptions },
      { planId, fromYmd: TOMORROW, numberOfItems: 1, now: NOW },
    );
    expect(back.subscriptionExceptions).toEqual([]);
  });

  it('covers a range of days', () => {
    const { c, planId } = subscribed();
    const { subscriptionExceptions } = setPlanQuantityForDays(c, {
      planId,
      fromYmd: TOMORROW,
      toYmd: '2026-09-22',
      numberOfItems: 2,
      now: NOW,
    });
    expect(subscriptionExceptions[0]).toMatchObject({ fromYmd: TOMORROW, toYmd: '2026-09-22', numberOfItems: 2 });
  });

  it('keeps skips and other lines changes', () => {
    const { c, planId } = subscribed();
    const skip = skipDays(c, { fromYmd: TOMORROW, now: NOW });
    const other = { id: 'other', kind: 'quantity', planId: 'sub_other', fromYmd: TOMORROW, toYmd: TOMORROW, numberOfItems: 4, createdBy: 'customer', ...TS };
    const next = setPlanQuantityForDays(
      { ...c, subscriptionExceptions: [...skip.subscriptionExceptions, other] as CustomerResponse['subscriptionExceptions'] },
      { planId, fromYmd: TOMORROW, numberOfItems: 2, now: NOW },
    );
    expect(next.subscriptionExceptions.map((e) => e.kind ?? 'skip')).toEqual(['skip', 'quantity', 'quantity']);
  });

  it('allows zero, and caps the quantity at the daily limit', () => {
    const { c, planId } = subscribed();
    expect(setPlanQuantityForDays(c, { planId, fromYmd: TOMORROW, numberOfItems: 0, now: NOW }).subscriptionExceptions[0]!.numberOfItems).toBe(0);
    expect(setPlanQuantityForDays(c, { planId, fromYmd: TOMORROW, numberOfItems: 99, now: NOW }).subscriptionExceptions[0]!.numberOfItems).toBe(20);
  });

  it('refuses a day past the cut-off', () => {
    const { c, planId } = subscribed();
    expect(() =>
      setPlanQuantityForDays(c, { planId, fromYmd: TOMORROW, numberOfItems: 2, now: new Date(2026, 8, 15, 22, 0, 0) }),
    ).toThrow(DayLockedError);
  });

  it('does nothing for a line that is not there', () => {
    expect(setPlanQuantityForDays(customer(), { planId: 'nope', fromYmd: TOMORROW, numberOfItems: 2, now: NOW }).subscriptionExceptions).toEqual([]);
  });
});

describe('subscription dates', () => {
  it('marks a subscription with no end date as running until stopped', () => {
    const { plan } = subscribeToProduct(customer(), { product: product(), pack: PACK_500, numberOfItems: 1, startYmd: TOMORROW });
    expect(plan.openEnded).toBe(true);
    expect(plan.endDate).toBeUndefined();
  });

  it('keeps a chosen end date, even months away', () => {
    const { plan } = subscribeToProduct(customer(), {
      product: product(),
      pack: PACK_500,
      numberOfItems: 1,
      startYmd: TOMORROW,
      endYmd: '2026-12-31',
    });
    expect(plan.openEnded).toBe(false);
    expect(plan.endDate).toBe('2026-12-31');
  });

  it('rejects an end before the start, and a missing start', () => {
    expect(() => validateSubscriptionDates('2026-09-20', '2026-09-10')).toThrow(SubscriptionDateError);
    expect(() => validateSubscriptionDates('')).toThrow('Choose a start date.');
    expect(() => validateSubscriptionDates('2026-09-20')).not.toThrow();
    expect(() => validateSubscriptionDates('2026-09-20', '2026-09-20')).not.toThrow();
  });
});
