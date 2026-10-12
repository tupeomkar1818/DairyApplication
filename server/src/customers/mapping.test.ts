import { describe, expect, it } from 'vitest';

import { customerFromRow, customerToRow, planToRow, type Customer, type CustomerRow, type PlanRow } from '@/customers/mapping';

const TS = { created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-02T00:00:00.000Z' };

const plan = {
  id: 'sub_milk',
  productName: 'Cow Milk',
  quantityLabel: '500 ml',
  packId: 'pack_500',
  numberOfItems: 2,
  frequency: 'Daily',
  deliveryTime: 'Morning',
  startDate: '2026-10-01',
  openEnded: true,
  status: 'Active',
  productAdditionTag: 'Regular',
  originalPrice: 30,
  discountedPrice: 0,
  effectiveFinalPrice: 30,
  createdAt: TS.created_at,
  updatedAt: TS.updated_at,
};

const customer: Customer = {
  id: 'cust_1',
  name: 'Asha Patil',
  mobile: '9876500011',
  houseFlatNumber: 'B-12',
  societyName: 'Sai Heights',
  streetArea: 'Paud Road',
  city: 'Pune',
  pincode: '411038',
  address: 'B-12, Sai Heights, Paud Road, Pune, 411038',
  routeName: 'Kothrud A',
  assignedDeliveryBoyId: 'db_1',
  deliveryTime: 'Morning',
  billingType: 'Postpaid',
  billingCycleDate: 30,
  discountAmount: 50,
  appAccessEnabled: true,
  status: 'Active',
  subscriptionStartDate: '2026-10-01',
  // No columns of their own.
  paymentType: 'Monthly',
  advanceBalance: 250,
  preferredPaymentMode: 'UPI',
  specialDeliveryInstructions: 'Ring the bell twice',
  createdAt: TS.created_at,
  updatedAt: TS.updated_at,
};

describe('customers: record ↔ rows', () => {
  it('keeps the profile, the extra fields and the delivery boy’s name', () => {
    const row = { ...customerToRow(customer), user_id: null, ...TS } as CustomerRow;
    const planRow = planToRow('cust_1', plan, TS.updated_at);
    const back = customerFromRow(row, [planRow], 'Sagar More');

    expect(back).toMatchObject({
      name: 'Asha Patil',
      mobile: '9876500011',
      routeName: 'Kothrud A',
      assignedDeliveryBoyName: 'Sagar More',
      discountAmount: 50,
      // round-tripped through details_json
      paymentType: 'Monthly',
      advanceBalance: 250,
      specialDeliveryInstructions: 'Ring the bell twice',
    });
    expect(back.subscriptionPlans).toEqual([plan]);
  });

  it('says Unassigned when no delivery boy is set, and never returns a missing array', () => {
    const row = { ...customerToRow({ ...customer, assignedDeliveryBoyId: undefined }), user_id: null, ...TS } as CustomerRow;
    const back = customerFromRow(row, []);
    expect(back.assignedDeliveryBoyName).toBe('Unassigned');
    expect(back.assignedDeliveryBoyId).toBeUndefined();
    for (const key of ['subscriptionPlans', 'deliveries', 'extraOrders', 'payments', 'paymentRequests', 'offerClaims']) {
      expect(Array.isArray(back[key])).toBe(true);
    }
  });

  it('writes a plan line the way the bill reads it', () => {
    const row: PlanRow = planToRow('cust_1', { ...plan, id: undefined, endDate: '2026-12-31', openEnded: undefined }, 'now');
    expect(row).toMatchObject({
      customer_id: 'cust_1',
      product_name: 'Cow Milk',
      pack_label: '500 ml',
      number_of_items: 2,
      start_date: '2026-10-01',
      end_date: '2026-12-31',
      open_ended: 0,
      effective_price: 30,
      updated_at: 'now',
    });
  });
});
