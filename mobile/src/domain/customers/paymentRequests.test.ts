import { describe, expect, it } from 'vitest';

import { buildBillingTimeline, summarizeBilling } from '@/src/components/admin/billingTimeline';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import {
  addPaymentRequest,
  buildUpiPayLink,
  cancelPaymentRequest,
  confirmPaymentRequest,
  isValidReference,
  isValidUpiId,
  newPaymentReference,
  pendingPaymentTotal,
  rejectPaymentRequest,
  validatePaymentRequest,
} from '@/src/domain/customers/paymentRequests';

const TODAY = '2026-09-17';
const NOW = `${TODAY}T10:00:00.000Z`;
const TS = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };

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
    monthlyBillAmount: 0,
    nextDeliveryDate: TODAY,
    subscriptionPlans: [
      { ...TS, id: 'sub_1', productName: 'Cow Milk', quantityLabel: '500 ml', numberOfItems: 1, originalPrice: 50, deliveryTime: 'Morning', frequency: 'Daily', startDate: '2026-09-01', openEnded: true, status: 'Active' },
    ] as CustomerResponse['subscriptionPlans'],
    deliveries: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'].map((d, i) => ({
      ...TS,
      id: `d${i}`,
      deliveryDate: d,
      productName: 'Cow Milk',
      quantityLabel: '500 ml',
      status: 'Delivered' as const,
      subscriptionItems: 1,
    })),
    payments: [],
    paymentRequests: [],
    ...TS,
    ...overrides,
  } as CustomerResponse;
}

describe('UPI details', () => {
  it('accepts real UPI IDs and references', () => {
    expect(isValidUpiId('amraledairy@okhdfcbank')).toBe(true);
    expect(isValidUpiId('98765.43210-x_y@ybl')).toBe(true);
    expect(isValidUpiId('amraledairy')).toBe(false);
    expect(isValidUpiId('a@1bank')).toBe(false);
    expect(isValidReference('4123 5678 9012')).toBe(true);
    expect(isValidReference('pay_Nx81Kq2')).toBe(false);
    expect(isValidReference('12345')).toBe(false);
  });

  it('builds the upi://pay link apps open', () => {
    const link = buildUpiPayLink({ upiId: 'amraledairy@okhdfcbank', payeeName: 'Amrale Dairy', amount: 1466, note: 'Milk bill Sep 2026 & more', reference: 'AMRABC123' });
    expect(link).toBe('upi://pay?pa=amraledairy%40okhdfcbank&pn=Amrale%20Dairy&am=1466.00&cu=INR&tn=Milk%20bill%20Sep%202026%20%26%20more&tr=AMRABC123');
    expect(newPaymentReference(() => 0)).toBe('AMRAAAAAA');
  });
});

describe('customer sends a payment', () => {
  it('needs a reference for UPI, not for cash, and no reuse', () => {
    const c = customer();
    expect(validatePaymentRequest(c, { amount: 200, method: 'UPI', paidOnYmd: TODAY }, TODAY)).toMatch(/UTR/);
    expect(validatePaymentRequest(c, { amount: 200, method: 'Cash', paidOnYmd: '2026-09-18' }, TODAY)).toBeNull();
    expect(validatePaymentRequest(c, { amount: 0, method: 'Cash', paidOnYmd: TODAY }, TODAY)).toMatch(/at least/);
    expect(validatePaymentRequest(c, { amount: 200, method: 'UPI', reference: '412345678901', paidOnYmd: '2026-09-18' }, TODAY)).toMatch(/future/);

    const { paymentRequests, request } = addPaymentRequest(c, { amount: 200, method: 'UPI', reference: '4123 4567 8901', paidOnYmd: TODAY }, { today: TODAY, nowIso: NOW });
    expect(request).toMatchObject({ status: 'Pending', reference: '412345678901', amount: 200 });
    expect(pendingPaymentTotal({ paymentRequests })).toBe(200);
    expect(validatePaymentRequest({ paymentRequests }, { amount: 50, method: 'UPI', reference: '412345678901', paidOnYmd: TODAY }, TODAY)).toMatch(/already/);

    const cancelled = cancelPaymentRequest({ paymentRequests }, request.id, NOW);
    expect(cancelled[0]?.status).toBe('Cancelled');
    expect(pendingPaymentTotal({ paymentRequests: cancelled })).toBe(0);
  });
});

describe('dairy reviews a payment', () => {
  it('confirming records a payment the bill counts', () => {
    const base = customer();
    const { paymentRequests, request } = addPaymentRequest(base, { amount: 150, method: 'UPI', reference: '412345678901', paidOnYmd: '2026-09-16' }, { today: TODAY, nowIso: NOW });
    const c = { ...base, paymentRequests };
    const before = summarizeBilling(c, buildBillingTimeline(c, '2026-09'), TODAY).outstanding;
    expect(before).toBe(200);

    const done = confirmPaymentRequest(c, request.id, { today: TODAY, nowIso: NOW });
    expect(done.payment).toMatchObject({ amountPaid: 150, paymentMode: 'UPI', transactionId: '412345678901', paymentDate: '2026-09-16' });
    expect(done.pendingAmount).toBe(50);
    expect(done.paymentRequests[0]).toMatchObject({ status: 'Confirmed', paymentId: done.payment.id });
    expect(() => confirmPaymentRequest({ ...c, paymentRequests: done.paymentRequests }, request.id, { today: TODAY, nowIso: NOW })).toThrow(/already confirmed/);
  });

  it('can record a different amount, and rejecting needs a reason', () => {
    const base = customer();
    const { paymentRequests, request } = addPaymentRequest(base, { amount: 500, method: 'Cash', paidOnYmd: TODAY }, { today: TODAY, nowIso: NOW });
    const c = { ...base, paymentRequests };
    const done = confirmPaymentRequest(c, request.id, { today: TODAY, nowIso: NOW, amount: 250, collectedBy: 'Sagar' });
    expect(done.payment).toMatchObject({ amountPaid: 250, paymentMode: 'Cash', collectedBy: 'Sagar' });
    expect(done.advanceBalance).toBe(50);

    expect(() => rejectPaymentRequest(c, request.id, '  ', NOW)).toThrow(/why/);
    expect(rejectPaymentRequest(c, request.id, 'Not received', NOW)[0]).toMatchObject({ status: 'Rejected', rejectReason: 'Not received' });
  });
});
