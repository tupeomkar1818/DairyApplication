import { describe, expect, it } from 'vitest';

import { ApiError } from '@/http';
import { customerSelfPatch, type CatalogPack, type Customer, type Row, type SelfServiceContext } from '@/customers/selfService';

/**
 * The customer app's own writes. Every test asks the same question: what does the server write when a phone sends
 * this, and what does it refuse?
 */

/** Midday in the dairy's day on Monday 12 October 2026, so tomorrow is open and today is not. */
const NOW = new Date('2026-10-12T06:00:00.000Z');
const TODAY = '2026-10-12';
const TOMORROW = '2026-10-13';
const TS = '2026-10-01T00:00:00.000Z';

const pack: CatalogPack = { productName: 'Cow Milk', packLabel: '500 ml', price: 30, discountPrice: null };

function context(over: Partial<SelfServiceContext> = {}): SelfServiceContext {
  return {
    now: NOW,
    packs: new Map([
      ['pack_500', pack],
      ['pack_shri', { productName: 'Shrikhand', packLabel: '500 g', price: 180, discountPrice: 160 } as CatalogPack],
    ]),
    offers: new Map(),
    claimedOfferIds: new Set(),
    ...over,
  };
}

const plan: Row = {
  id: 'sub_milk',
  productName: 'Cow Milk',
  quantityLabel: '500 ml',
  packId: 'pack_500',
  numberOfItems: 2,
  frequency: 'Daily',
  deliveryTime: 'Morning',
  startDate: '2026-09-01',
  openEnded: true,
  status: 'Active',
  productAdditionTag: 'Regular',
  originalPrice: 30,
  discountedPrice: 0,
  effectiveFinalPrice: 30,
  createdAt: TS,
  updatedAt: TS,
};

function customer(over: Partial<Customer> = {}): Customer {
  return {
    id: 'cust_1',
    name: 'Asha Pawar',
    mobile: '9876500011',
    subscriptionPlans: [plan],
    subscriptionExceptions: [],
    extraOrders: [],
    paymentRequests: [],
    deliveries: [],
    ...over,
  };
}

/** The error code the server answered with, for a patch it refused. */
function refusedCode(current: Customer, patch: Record<string, unknown>, ctx = context()): string {
  try {
    customerSelfPatch(current, patch, ctx);
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  return 'ACCEPTED';
}

const order = (over: Row = {}): Row => ({
  id: 'extra_new',
  orderDate: TOMORROW,
  deliveryDate: TOMORROW,
  productName: 'Cow Milk',
  quantityLabel: '500 ml',
  packId: 'pack_500',
  numberOfItems: 2,
  price: 30,
  status: 'Pending',
  placedBy: 'customer',
  createdAt: TS,
  updatedAt: TS,
  ...over,
});

describe('what a customer may send at all', () => {
  it('refuses anything that is the dairy’s', () => {
    expect(refusedCode(customer(), { discountAmount: 0 })).toBe('FORBIDDEN');
    expect(refusedCode(customer(), { payments: [] })).toBe('FORBIDDEN');
    expect(refusedCode(customer(), { status: 'Active' })).toBe('FORBIDDEN');
    expect(refusedCode(customer(), { offerClaims: [{ offerId: 'o', code: 'X', claimedAt: TS }] })).toBe('FORBIDDEN');
  });

  it('writes only the lists the patch carried', () => {
    const out = customerSelfPatch(customer(), { extraOrders: [order()] }, context());
    expect(Object.keys(out)).toEqual(['extraOrders']);
  });
});

describe('one-off orders', () => {
  it('takes an order for tomorrow at the catalog’s price', () => {
    const out = customerSelfPatch(customer(), { extraOrders: [order()] }, context());
    expect(out.extraOrders).toEqual([expect.objectContaining({ id: 'extra_new', price: 30, status: 'Pending', placedBy: 'customer' })]);
  });

  it('bills a discounted pack at its discounted price', () => {
    const out = customerSelfPatch(
      customer(),
      { extraOrders: [order({ packId: 'pack_shri', productName: 'Shrikhand', quantityLabel: '500 g', price: 160 })] },
      context(),
    );
    expect((out.extraOrders as Row[])[0]!.price).toBe(160);
  });

  it('refuses an order priced by the phone', () => {
    expect(refusedCode(customer(), { extraOrders: [order({ price: 1 })] })).toBe('ORDER_PRICE_MISMATCH');
  });

  it('refuses an order under another pack’s name', () => {
    expect(refusedCode(customer(), { extraOrders: [order({ productName: 'Ghee' })] })).toBe('ORDER_PACK_MISMATCH');
  });

  it('refuses an order for today — the crates went out this morning', () => {
    expect(refusedCode(customer(), { extraOrders: [order({ deliveryDate: TODAY, orderDate: TODAY })] })).toBe('DAY_CLOSED');
  });

  it('refuses an order for tomorrow once 9 pm has passed', () => {
    const late = context({ now: new Date('2026-10-12T15:40:00.000Z') });
    expect(refusedCode(customer(), { extraOrders: [order()] }, late)).toBe('DAY_CLOSED');
  });

  it('refuses an order for a day the van has already been', () => {
    const marked = customer({ deliveries: [{ id: 'd1', deliveryDate: TOMORROW, productName: 'Cow Milk', quantityLabel: '500 ml', status: 'Delivered' }] });
    expect(refusedCode(marked, { extraOrders: [order()] })).toBe('DAY_CLOSED');
  });

  it('takes a cancellation, and keeps the order on the record', () => {
    const placed = customer({ extraOrders: [order({ id: 'extra_1' })] });
    const out = customerSelfPatch(placed, { extraOrders: [order({ id: 'extra_1', status: 'Cancelled' })] }, context());
    expect(out.extraOrders).toEqual([expect.objectContaining({ id: 'extra_1', status: 'Cancelled' })]);
  });

  it('refuses to touch an order the dairy has already delivered', () => {
    const delivered = customer({ extraOrders: [order({ id: 'extra_1', status: 'Delivered' })] });
    expect(refusedCode(delivered, { extraOrders: [order({ id: 'extra_1', status: 'Cancelled' })] })).toBe('ORDER_ALREADY_SETTLED');
  });

  it('keeps an order that was left out of the patch', () => {
    const placed = customer({ extraOrders: [order({ id: 'extra_1' })] });
    const out = customerSelfPatch(placed, { extraOrders: [] }, context());
    expect(out.extraOrders).toEqual([expect.objectContaining({ id: 'extra_1', status: 'Pending' })]);
  });

  it('keeps the stored price and day when a phone sends an order back changed', () => {
    const placed = customer({ extraOrders: [order({ id: 'extra_1' })] });
    const out = customerSelfPatch(
      placed,
      { extraOrders: [order({ id: 'extra_1', price: 1, deliveryDate: '2026-12-25', numberOfItems: 3 })] },
      context(),
    );
    expect(out.extraOrders).toEqual([expect.objectContaining({ price: 30, deliveryDate: TOMORROW, numberOfItems: 3 })]);
  });

  it('refuses more packs than a day can take', () => {
    expect(refusedCode(customer(), { extraOrders: [order({ numberOfItems: 99 })] })).toBe('ORDER_QUANTITY_INVALID');
  });
});

describe('orders placed on an offer', () => {
  const combo = {
    id: 'offer_box',
    kind: 'combo',
    title: { en: 'Festival box' },
    startYmd: '2026-10-01',
    endYmd: '2026-10-31',
    code: 'DIWALI50',
    comboPrice: 499,
    comboItems: [{ productName: 'Shrikhand', packLabel: '500 g', quantity: 2, listPrice: 180 }],
  };
  const comboOrder = (over: Row = {}) =>
    order({
      id: 'extra_combo',
      productName: 'Festival box',
      quantityLabel: 'Combo',
      packId: undefined,
      price: 499,
      numberOfItems: 1,
      offer: { offerId: 'offer_box', kind: 'combo', title: { en: 'Festival box' }, listPrice: 360 },
      ...over,
    });

  it('takes a combo at the offer’s price once the code has been typed', () => {
    const ctx = context({ offers: new Map([['offer_box', combo]]), claimedOfferIds: new Set(['offer_box']) });
    const out = customerSelfPatch(customer(), { extraOrders: [comboOrder()] }, ctx);
    // The wording and the "was" price come from the offer the dairy wrote, not from the phone.
    expect(out.extraOrders).toEqual([
      expect.objectContaining({ price: 499, offer: { offerId: 'offer_box', kind: 'combo', title: { en: 'Festival box' }, listPrice: 360 } }),
    ]);
  });

  it('refuses a coded offer the customer has not unlocked', () => {
    const ctx = context({ offers: new Map([['offer_box', combo]]) });
    expect(refusedCode(customer(), { extraOrders: [comboOrder()] }, ctx)).toBe('OFFER_NOT_AVAILABLE');
  });

  it('refuses an offer that has ended', () => {
    const ended = { ...combo, endedAt: '2026-10-05T00:00:00.000Z' };
    const ctx = context({ offers: new Map([['offer_box', ended]]), claimedOfferIds: new Set(['offer_box']) });
    expect(refusedCode(customer(), { extraOrders: [comboOrder()] }, ctx)).toBe('OFFER_NOT_AVAILABLE');
  });

  it('refuses a combo bought below the offer’s price', () => {
    const ctx = context({ offers: new Map([['offer_box', combo]]), claimedOfferIds: new Set(['offer_box']) });
    expect(refusedCode(customer(), { extraOrders: [comboOrder({ price: 99 })] }, ctx)).toBe('ORDER_PRICE_MISMATCH');
  });

  it('takes a pack at a price offer’s price', () => {
    const priceOffer = {
      id: 'offer_shri',
      kind: 'price',
      title: { en: 'Shrikhand week' },
      startYmd: '2026-10-01',
      endYmd: '2026-10-19',
      priceItems: [{ packId: 'pack_shri', productName: 'Shrikhand', packLabel: '500 g', listPrice: 180, offerPrice: 140 }],
    };
    const ctx = context({ offers: new Map([['offer_shri', priceOffer]]) });
    const out = customerSelfPatch(
      customer(),
      {
        extraOrders: [
          order({
            packId: 'pack_shri',
            productName: 'Shrikhand',
            quantityLabel: '500 g',
            price: 140,
            offer: { offerId: 'offer_shri', kind: 'price', title: { en: 'Shrikhand week' }, listPrice: 180 },
          }),
        ],
      },
      ctx,
    );
    expect((out.extraOrders as Row[])[0]!.price).toBe(140);
  });
});

describe('days the customer changes', () => {
  const skip = (over: Row = {}): Row => ({
    id: 'exc_new',
    kind: 'skip',
    fromYmd: TOMORROW,
    toYmd: TOMORROW,
    reason: 'Paused from the app',
    createdBy: 'customer',
    createdAt: TS,
    updatedAt: TS,
    ...over,
  });

  it('takes a pause for a day that is still open', () => {
    const out = customerSelfPatch(customer(), { subscriptionExceptions: [skip()] }, context());
    expect(out.subscriptionExceptions).toEqual([expect.objectContaining({ id: 'exc_new', kind: 'skip', createdBy: 'customer' })]);
  });

  it('refuses a pause for today', () => {
    expect(refusedCode(customer(), { subscriptionExceptions: [skip({ fromYmd: TODAY, toYmd: TODAY })] })).toBe('DAY_CLOSED');
  });

  it('refuses a change to a day that has passed', () => {
    expect(refusedCode(customer(), { subscriptionExceptions: [skip({ fromYmd: '2026-10-01', toYmd: '2026-10-01' })] })).toBe('DAY_CLOSED');
  });

  it('holds an already arranged day at the quantity it was arranged with', () => {
    const held = skip({ id: 'qty_hold', kind: 'quantity', planId: 'sub_milk', fromYmd: TODAY, toYmd: TODAY, numberOfItems: 2 });
    const out = customerSelfPatch(customer(), { subscriptionExceptions: [held] }, context());
    expect(out.subscriptionExceptions).toEqual([expect.objectContaining({ id: 'qty_hold', numberOfItems: 2 })]);
  });

  it('refuses to change an arranged day to another quantity', () => {
    const cut = skip({ id: 'qty_cut', kind: 'quantity', planId: 'sub_milk', fromYmd: TODAY, toYmd: TODAY, numberOfItems: 1 });
    expect(refusedCode(customer(), { subscriptionExceptions: [cut] })).toBe('DAY_CLOSED');
  });

  it('undoes a change that is entirely in the open days', () => {
    const made = customer({ subscriptionExceptions: [skip({ id: 'exc_1', fromYmd: '2026-10-20', toYmd: '2026-10-22' })] });
    expect(customerSelfPatch(made, { subscriptionExceptions: [] }, context()).subscriptionExceptions).toEqual([]);
  });

  it('refuses to undo a change that reaches back into the arranged days', () => {
    const made = customer({ subscriptionExceptions: [skip({ id: 'exc_1', fromYmd: '2026-10-01', toYmd: '2026-10-22' })] });
    expect(refusedCode(made, { subscriptionExceptions: [] })).toBe('DAY_CHANGE_NOT_YOURS');
  });

  it('lets such a change be ended at the last arranged day instead', () => {
    const made = customer({ subscriptionExceptions: [skip({ id: 'exc_1', fromYmd: '2026-10-01', toYmd: '2026-10-22' })] });
    const out = customerSelfPatch(made, { subscriptionExceptions: [skip({ id: 'exc_1', fromYmd: '2026-10-01', toYmd: TODAY })] }, context());
    expect(out.subscriptionExceptions).toEqual([expect.objectContaining({ id: 'exc_1', toYmd: TODAY })]);
  });

  it('refuses to shorten it into the arranged days', () => {
    const made = customer({ subscriptionExceptions: [skip({ id: 'exc_1', fromYmd: '2026-10-01', toYmd: '2026-10-22' })] });
    expect(refusedCode(made, { subscriptionExceptions: [skip({ id: 'exc_1', fromYmd: '2026-10-01', toYmd: '2026-10-05' })] })).toBe(
      'DAY_CHANGE_NOT_YOURS',
    );
  });
});

describe('the standing order', () => {
  it('starts a new line at the catalog’s price, whatever the phone sent', () => {
    const added: Row = {
      ...plan,
      id: 'sub_new',
      productName: 'Shrikhand',
      quantityLabel: '500 g',
      packId: 'pack_shri',
      startDate: TOMORROW,
      originalPrice: 1,
      discountedPrice: 1,
      effectiveFinalPrice: 1,
    };
    const out = customerSelfPatch(customer(), { subscriptionPlans: [plan, added] }, context());
    expect(out.subscriptionPlans).toEqual([
      plan,
      expect.objectContaining({ id: 'sub_new', originalPrice: 180, discountedPrice: 160, effectiveFinalPrice: 160 }),
    ]);
  });

  it('refuses a line starting before today', () => {
    const added: Row = { ...plan, id: 'sub_new', packId: 'pack_500', startDate: '2026-10-01' };
    expect(refusedCode(customer(), { subscriptionPlans: [plan, added] })).toBe('SUBSCRIPTION_START_INVALID');
  });

  it('takes a new everyday quantity and a last day, and keeps the price', () => {
    const out = customerSelfPatch(
      customer(),
      { subscriptionPlans: [{ ...plan, numberOfItems: 3, endDate: '2026-11-30', openEnded: false, effectiveFinalPrice: 1 }] },
      context(),
    );
    expect(out.subscriptionPlans).toEqual([
      expect.objectContaining({ numberOfItems: 3, endDate: '2026-11-30', openEnded: false, effectiveFinalPrice: 30 }),
    ]);
  });

  it('lets the customer stop a line, and keeps the line on the record', () => {
    const out = customerSelfPatch(customer(), { subscriptionPlans: [{ ...plan, status: 'Inactive' }] }, context());
    expect(out.subscriptionPlans).toEqual([expect.objectContaining({ id: 'sub_milk', status: 'Inactive' })]);
  });

  it('keeps a line the patch left out', () => {
    expect(customerSelfPatch(customer(), { subscriptionPlans: [] }, context()).subscriptionPlans).toEqual([plan]);
  });

  it('refuses to undo a state the dairy set', () => {
    const paused = customer({ subscriptionPlans: [{ ...plan, status: 'Paused' }] });
    expect(refusedCode(paused, { subscriptionPlans: [{ ...plan, status: 'Active' }] })).toBe('SUBSCRIPTION_STATUS_NOT_YOURS');
  });
});

describe('payments the customer says they have made', () => {
  const request = (over: Row = {}): Row => ({
    id: 'payreq_new',
    amount: 500,
    method: 'UPI',
    reference: '123456789012',
    paidOnYmd: TODAY,
    status: 'Pending',
    createdAt: TS,
    updatedAt: TS,
    ...over,
  });

  it('takes a request, and waits for the dairy to confirm it', () => {
    const out = customerSelfPatch(customer(), { paymentRequests: [request()] }, context());
    expect(out.paymentRequests).toEqual([expect.objectContaining({ amount: 500, status: 'Pending' })]);
  });

  it('refuses a request that confirms itself', () => {
    expect(refusedCode(customer(), { paymentRequests: [request({ status: 'Approved' })] })).toBe('PAYMENT_STATUS_NOT_YOURS');
  });

  it('drops anything of the dairy’s review a phone put on a new request', () => {
    const out = customerSelfPatch(
      customer(),
      { paymentRequests: [request({ paymentId: 'pay_1', reviewNote: 'Received', reviewedAt: TS })] },
      context(),
    );
    expect(out.paymentRequests).toEqual([
      expect.objectContaining({ paymentId: undefined, reviewNote: undefined, reviewedAt: undefined }),
    ]);
  });

  it('refuses an amount that is not money, or a day in the future', () => {
    expect(refusedCode(customer(), { paymentRequests: [request({ amount: 0 })] })).toBe('PAYMENT_AMOUNT_INVALID');
    expect(refusedCode(customer(), { paymentRequests: [request({ paidOnYmd: '2026-12-01' })] })).toBe('PAYMENT_DATE_INVALID');
  });

  it('lets a pending request be withdrawn', () => {
    const sent = customer({ paymentRequests: [request({ id: 'payreq_1' })] });
    const out = customerSelfPatch(sent, { paymentRequests: [request({ id: 'payreq_1', status: 'Cancelled' })] }, context());
    expect(out.paymentRequests).toEqual([expect.objectContaining({ id: 'payreq_1', status: 'Cancelled' })]);
  });

  it('refuses to withdraw one the dairy has already confirmed', () => {
    const confirmed = customer({ paymentRequests: [request({ id: 'payreq_1', status: 'Approved' })] });
    expect(refusedCode(confirmed, { paymentRequests: [request({ id: 'payreq_1', status: 'Cancelled' })] })).toBe('PAYMENT_ALREADY_REVIEWED');
  });

  it('keeps a request the patch left out', () => {
    const sent = customer({ paymentRequests: [request({ id: 'payreq_1' })] });
    expect(customerSelfPatch(sent, { paymentRequests: [] }, context()).paymentRequests).toEqual([
      expect.objectContaining({ id: 'payreq_1', status: 'Pending' }),
    ]);
  });
});

describe('days that were delivered', () => {
  const delivered: Row = {
    id: 'del_1',
    deliveryDate: '2026-10-10',
    productName: 'Cow Milk',
    quantityLabel: '500 ml',
    status: 'Delivered',
    createdAt: TS,
    updatedAt: TS,
  };

  it('records how many packs a delivered day had, when it never recorded one', () => {
    const out = customerSelfPatch(customer({ deliveries: [delivered] }), { deliveries: [{ ...delivered, subscriptionItems: 2 }] }, context());
    expect(out.deliveries).toEqual([expect.objectContaining({ id: 'del_1', subscriptionItems: 2 })]);
  });

  it('leaves a day that already recorded one as it was', () => {
    const stamped = { ...delivered, subscriptionItems: 2 };
    const out = customerSelfPatch(customer({ deliveries: [stamped] }), { deliveries: [{ ...stamped, subscriptionItems: 9 }] }, context());
    expect(out.deliveries).toEqual([expect.objectContaining({ subscriptionItems: 2 })]);
  });

  it('ignores anything else a phone sends on a delivered day', () => {
    const out = customerSelfPatch(
      customer({ deliveries: [delivered] }),
      { deliveries: [{ ...delivered, status: 'Not Delivered', productName: 'Ghee' }] },
      context(),
    );
    expect(out.deliveries).toEqual([expect.objectContaining({ status: 'Delivered', productName: 'Cow Milk' })]);
  });

  it('refuses a delivery a customer made up', () => {
    expect(refusedCode(customer(), { deliveries: [{ ...delivered, id: 'del_made_up' }] })).toBe('DELIVERY_NOT_YOURS');
  });

  it('keeps a delivered day the patch left out', () => {
    expect(customerSelfPatch(customer({ deliveries: [delivered] }), { deliveries: [] }, context()).deliveries).toEqual([delivered]);
  });
});
