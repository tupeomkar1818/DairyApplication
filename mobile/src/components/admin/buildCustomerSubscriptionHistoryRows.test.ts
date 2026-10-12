import { describe, expect, it } from 'vitest';

import { buildCustomerSubscriptionHistoryRows } from '@/src/components/admin/buildCustomerSubscriptionHistoryRows';
import type { CustomerResponse } from '@/src/domain/customers/dtos';

const TS = { createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' };

function plan(overrides: Record<string, unknown> = {}) {
  return {
    ...TS,
    id: 'sub_1',
    productName: 'Cow Milk',
    quantityLabel: '500 ml',
    numberOfItems: 1,
    deliveryTime: 'Morning',
    frequency: 'Daily',
    startDate: '2026-08-01',
    endDate: '2026-09-30',
    originalPrice: 30,
    status: 'Active',
    ...overrides,
  } as NonNullable<CustomerResponse['subscriptionPlans']>[number];
}

function delivery(dateYmd: string, overrides: Record<string, unknown> = {}) {
  return {
    ...TS,
    id: `del_${dateYmd}`,
    deliveryDate: dateYmd,
    productName: 'Cow Milk',
    quantityLabel: '500 ml',
    status: 'Delivered',
    ...overrides,
  } as NonNullable<CustomerResponse['deliveries']>[number];
}

function customer(overrides: Partial<CustomerResponse> = {}): CustomerResponse {
  return {
    ...TS,
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
    monthlyBillAmount: 0,
    nextDeliveryDate: '2026-09-01',
    deliveries: [delivery('2026-08-02'), delivery('2026-08-03'), delivery('2026-09-01')],
    ...overrides,
  } as CustomerResponse;
}

describe('buildCustomerSubscriptionHistoryRows', () => {
  it('counts only the selected month, so the figures match that month bill', () => {
    const c = customer();
    const august = buildCustomerSubscriptionHistoryRows(c, [], '2026-08')[0]!;
    const september = buildCustomerSubscriptionHistoryRows(c, [], '2026-09')[0]!;

    expect(august.deliveryOccurrenceCount).toBe(2);
    expect(september.deliveryOccurrenceCount).toBe(1);
    expect(august.calculatedAmount).toBe(august.deliveryOccurrenceCount * august.pricePerDelivery);
  });

  it('still totals every delivery when no month is given', () => {
    const all = buildCustomerSubscriptionHistoryRows(customer(), [])[0]!;
    expect(all.deliveryOccurrenceCount).toBe(3);
  });

  it('reports the last delivery inside the month, not the latest overall', () => {
    const august = buildCustomerSubscriptionHistoryRows(customer(), [], '2026-08')[0]!;
    expect(august.lastDeliveredDateYmd).toBe('2026-08-03');
  });

  it('drops lines that neither ran nor were delivered in the month', () => {
    const c = customer({
      subscriptionPlans: [plan({ id: 'sub_old', startDate: '2026-05-01', endDate: '2026-05-31' })],
      deliveries: [],
    });
    expect(buildCustomerSubscriptionHistoryRows(c, [], '2026-09')).toHaveLength(0);
    expect(buildCustomerSubscriptionHistoryRows(c, [], '2026-05')).toHaveLength(1);
  });

  it('keeps a line that ran in the month even with nothing delivered yet', () => {
    const c = customer({ deliveries: [] });
    const rows = buildCustomerSubscriptionHistoryRows(c, [], '2026-09');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.deliveryOccurrenceCount).toBe(0);
    expect(rows[0]!.calculatedAmount).toBe(0);
  });
});
