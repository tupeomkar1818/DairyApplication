import { describe, expect, it } from 'vitest';

import {
  deliveryFromRow,
  deliveryToRow,
  exceptionFromRow,
  exceptionToRow,
  extraOrderFromRow,
  extraOrderToRow,
  paymentFromRow,
  paymentRequestFromRow,
  paymentRequestToRow,
  paymentToRow,
  type Row,
} from '@/customers/operational';

const NOW = '2026-10-11T06:00:00.000Z';
const roundTrip = <T>(to: (id: string, r: Row, now: string) => T, from: (row: T) => Row, record: Row): Row =>
  from(to('cust_1', record, NOW));

describe('a customer’s days and money: record ↔ rows', () => {
  it('keeps a delivered day exactly as the delivery boy marked it', () => {
    const delivered: Row = {
      id: 'del_1',
      deliveryDate: '2026-10-10',
      productName: 'Cow Milk',
      quantityLabel: '500 ml',
      status: 'Delivered',
      subscriptionItems: 2,
      markedBy: 'Delivery app (9876500022)',
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(roundTrip(deliveryToRow, deliveryFromRow, delivered)).toEqual(delivered);
  });

  it('keeps a missed day with its reason', () => {
    const missed: Row = {
      id: 'del_2',
      deliveryDate: '2026-10-09',
      productName: 'Cow Milk',
      quantityLabel: '500 ml',
      status: 'Missed',
      missedReason: 'Marked not delivered by delivery app',
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(roundTrip(deliveryToRow, deliveryFromRow, missed)).toEqual(missed);
  });

  it('keeps a one-off order, its offer and what was in the combo', () => {
    const combo: Row = {
      id: 'extra_1',
      orderDate: '2026-10-12',
      deliveryDate: '2026-10-12',
      productName: 'Diwali box',
      quantityLabel: 'Combo',
      numberOfItems: 2,
      price: 599,
      status: 'Pending',
      offer: { offerId: 'offer_1', kind: 'combo', title: { en: 'Diwali box', mr: 'दिवाळी बॉक्स' }, listPrice: 650 },
      comboItems: [{ productName: 'Ghee', packLabel: '500 ml', quantity: 1 }],
      placedBy: 'customer',
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(roundTrip(extraOrderToRow, extraOrderFromRow, combo)).toEqual(combo);
  });

  it('keeps a plain one-off order with no offer on it', () => {
    const order: Row = {
      id: 'extra_2',
      orderDate: '2026-10-12',
      deliveryDate: '2026-10-12',
      productName: 'Paneer',
      quantityLabel: '200 g',
      packId: 'pack_paneer',
      numberOfItems: 1,
      price: 100,
      status: 'Delivered',
      placedBy: 'admin',
      createdAt: NOW,
      updatedAt: NOW,
    };
    const back = roundTrip(extraOrderToRow, extraOrderFromRow, order);
    expect(back).toEqual(order);
    expect(back.offer).toBeUndefined();
  });

  it('keeps a paused stretch and a changed quantity', () => {
    const pause: Row = {
      id: 'exc_1',
      kind: 'skip',
      fromYmd: '2026-10-20',
      toYmd: '2026-10-25',
      reason: 'Paused from the app',
      createdBy: 'customer',
      createdAt: NOW,
      updatedAt: NOW,
    };
    const quantity: Row = {
      id: 'exc_2',
      kind: 'quantity',
      fromYmd: '2026-10-15',
      toYmd: '2026-10-15',
      planId: 'sub_milk',
      numberOfItems: 3,
      createdBy: 'admin',
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(roundTrip(exceptionToRow, exceptionFromRow, pause)).toEqual(pause);
    expect(roundTrip(exceptionToRow, exceptionFromRow, quantity)).toEqual(quantity);
    // A row written before day quantities existed is a skip.
    expect(exceptionToRow('cust_1', { fromYmd: '2026-10-01', toYmd: '2026-10-01' }, NOW).kind).toBe('skip');
  });

  it('keeps a payment and a payment the customer says they made', () => {
    const payment: Row = {
      id: 'pay_1',
      paymentDate: '2026-10-05',
      amountPaid: 1500,
      paymentMode: 'UPI',
      transactionId: '432101234567',
      collectedBy: 'Admin',
      notes: 'Bill payment for 2026-09',
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(roundTrip(paymentToRow, paymentFromRow, payment)).toEqual(payment);

    const request: Row = {
      id: 'payreq_1',
      amount: 1500,
      method: 'UPI',
      reference: '432101234567',
      paidOnYmd: '2026-10-05',
      note: 'paid in the morning',
      status: 'Pending',
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(roundTrip(paymentRequestToRow, paymentRequestFromRow, request)).toEqual(request);
  });

  it('gives a record with no id one, and rounds money to rupees', () => {
    expect(deliveryToRow('cust_1', { deliveryDate: '2026-10-10' }, NOW).id).toMatch(/^del_/);
    expect(paymentToRow('cust_1', { amountPaid: 1499.6 }, NOW).amount).toBe(1500);
    expect(extraOrderToRow('cust_1', { price: 58.4, numberOfItems: 0 }, NOW)).toMatchObject({ price: 58, number_of_items: 1 });
  });
});
