import { describe, expect, it } from 'vitest';

import type { Customer } from '@/customers/mapping';
import { buildAdminSummary, buildReminder, indiaYmd, reminderKey, tomorrowYmd } from '@/jobs/reminders';
import { formatDay, money, timeLabel } from '@/jobs/words';

const TS = '2026-10-01T00:00:00.000Z';

const customer = (over: Partial<Customer> = {}): Customer => ({
  id: 'cust_1',
  name: 'Meera Joshi',
  mobile: '9876500011',
  status: 'Active',
  subscriptionPlans: [
    {
      id: 'sub_milk',
      productName: 'Cow Milk',
      quantityLabel: '500 ml',
      numberOfItems: 2,
      startDate: '2026-10-01',
      openEnded: true,
      status: 'Active',
      originalPrice: 30,
      createdAt: TS,
    },
  ],
  subscriptionExceptions: [],
  extraOrders: [],
  createdAt: TS,
  updatedAt: TS,
  ...over,
});

describe('the dairy’s day', () => {
  it('is India’s day, whatever the server thinks it is in', () => {
    // 11 pm UTC on 11 October is already 12 October in India.
    expect(indiaYmd(new Date('2026-10-11T23:00:00.000Z'))).toBe('2026-10-12');
    expect(tomorrowYmd(new Date('2026-10-11T12:30:00.000Z'))).toBe('2026-10-12');
  });
});

describe('the evening reminder', () => {
  const ymd = '2026-10-12';

  it('says what is coming, what it costs and until when it can change — in both languages', () => {
    const row = buildReminder(customer(), ymd)!;
    expect(row.title).toBe("Tomorrow's order · Mon, 12 Oct");
    expect(row.body).toBe(
      'Cow Milk · 500 ml × 2 · ₹60. Do you want to change it, or keep it as it is? You can change it until 9 pm today.',
    );
    const mr = (row.translations as { mr: { title: string; body: string } }).mr;
    expect(mr.title).toBe('उद्याची ऑर्डर · सोम, 12 ऑक्टो');
    expect(mr.body).toContain('रात्री 9');
    expect(mr.body).toContain('₹60');
  });

  it('counts the extra items in', () => {
    const withAddOn = customer({
      extraOrders: [
        { id: 'e1', deliveryDate: ymd, productName: 'Paneer', quantityLabel: '200 g', numberOfItems: 1, price: 100, status: 'Pending' },
      ],
    });
    const row = buildReminder(withAddOn, ymd)!;
    expect(row.body).toContain('includes 1 extra item');
    expect(row.body).toContain('₹160');
  });

  it('opens the customer’s days, and is about that one day', () => {
    const row = buildReminder(customer(), ymd)!;
    expect(row).toMatchObject({
      audience: 'Customer',
      customerId: 'cust_1',
      type: 'OrderReminder',
      link: '/(customer)/my-days',
      dateYmd: ymd,
      monthYyyyMm: '2026-10',
      subjectKey: reminderKey('cust_1', ymd),
    });
  });

  it('says nothing to a customer with nothing coming, or without the app', () => {
    expect(buildReminder(customer({ subscriptionPlans: [] }), ymd)).toBeNull();
    expect(buildReminder(customer({ appAccessEnabled: false }), ymd)).toBeNull();
  });
});

describe('the dairy’s line for the evening', () => {
  it('counts the customers asked, in both languages', () => {
    const row = buildAdminSummary(3, '2026-10-12');
    expect(row.title).toBe('Order reminders sent for Mon, 12 Oct');
    expect(row.body).toContain('3 customers were asked at 6 pm');
    expect(row.body).toContain('They can change it until 9 pm.');
    expect((row.translations as { mr: { title: string } }).mr.title).toContain('ऑर्डर रिमाइंडर');
  });

  it('reads right for one customer', () => {
    expect(buildAdminSummary(1, '2026-10-12').body).toContain('1 customer was asked');
  });
});

describe('the words the server writes', () => {
  it('writes the dairy’s date the way the apps do', () => {
    expect(formatDay('2026-10-12', 'en', { weekday: true })).toBe('Mon, 12 Oct');
    expect(formatDay('2026-10-12', 'mr')).toBe('12 ऑक्टो');
  });

  it('writes money with Indian grouping and English digits', () => {
    expect(money(60)).toBe('₹60');
    expect(money(125000)).toBe('₹1,25,000');
    expect(money(32.5)).toBe('₹32.50');
  });

  it('says the time the way each language does', () => {
    expect(timeLabel(18, 'en')).toBe('6 pm');
    expect(timeLabel(21, 'mr')).toBe('रात्री 9');
    expect(timeLabel(18, 'mr')).toBe('संध्याकाळी 6');
  });
});
