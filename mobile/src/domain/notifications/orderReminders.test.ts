import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = new Map<string, string>();
const customerList: { items: CustomerResponse[] } = { items: [] };

vi.mock('@/src/infrastructure/storage/storage', () => ({
  readJson: async (key: string) => {
    const raw = memory.get(key);
    return raw ? JSON.parse(raw) : null;
  },
  writeJson: async (key: string, value: unknown) => {
    memory.set(key, JSON.stringify(value));
  },
}));

vi.mock('@/src/infrastructure/service-registry', async () => {
  const { NotificationServiceMock } = await import('@/src/domain/notifications/service.mock');
  // The evening reminders are written through the registry, to whatever keeps the rows. `listAll` is how a service
  // says the dairy's server keeps them — and then 6 pm is the server's job, not an open app's.
  notifications.service = new NotificationServiceMock();
  return { services: { customers: { list: async () => customerList }, notifications: notifications.service } };
});

/** Set per test: only an app that may see every customer sends the evening reminders. */
let seesEveryCustomer = true;

/** The notification service the registry hands out, so a test can say the dairy’s server keeps the rows. */
const notifications = vi.hoisted(() => ({ service: {} as { listAll?: () => Promise<unknown[]> } & object }));
vi.mock('@/src/infrastructure/customerScope', () => ({ mayReadEveryCustomer: async () => seesEveryCustomer }));

import type { CustomerResponse } from '@/src/domain/customers/dtos';
import {
  buildOrderReminders,
  orderReminderDay,
  orderReminderKey,
  orderReminderTimeFor,
  upcomingOrderReminders,
} from '@/src/domain/notifications/orderReminders';
import { loadNotifications, recordOrderReminderResponse } from '@/src/infrastructure/notificationsStore';
import { sendDueOrderReminders } from '@/src/infrastructure/orderReminderScheduler';

const TS = { createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
const TOMORROW = '2026-09-17';

function customer(id: string, overrides: Partial<CustomerResponse> = {}): CustomerResponse {
  return {
    id,
    name: `Customer ${id}`,
    mobile: '9876543210',
    address: 'A-1',
    societyName: 'Green View',
    deliveryTime: 'Morning',
    paymentType: 'Cash',
    status: 'Active',
    subscription: [],
    subscriptionPlans: [
      {
        id: `plan_${id}`,
        productName: 'Cow Milk',
        quantityLabel: '500 ml',
        numberOfItems: 2,
        deliveryTime: 'Morning',
        frequency: 'Daily',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        status: 'Active',
        effectiveFinalPrice: 52 * 2 * 30,
        ...TS,
      },
    ],
    deliveries: [],
    extraOrders: [],
    subscriptionExceptions: [],
    monthlyBillAmount: 0,
    nextDeliveryDate: TOMORROW,
    ...TS,
    ...overrides,
  } as CustomerResponse;
}

describe('when the reminder is due', () => {
  it('runs for tomorrow from 6 pm until the 9 pm cut-off, and not outside it', () => {
    expect(orderReminderDay(new Date(2026, 8, 16, 17, 59, 59))).toBeNull();
    expect(orderReminderDay(new Date(2026, 8, 16, 18, 0, 0))).toBe(TOMORROW);
    expect(orderReminderDay(new Date(2026, 8, 16, 20, 59, 59))).toBe(TOMORROW);
    expect(orderReminderDay(new Date(2026, 8, 16, 21, 0, 0))).toBeNull();
    expect(orderReminderDay(new Date(2026, 8, 16, 9, 0, 0))).toBeNull();
  });

  it('goes by IST, not the device clock', () => {
    // 12:30 UTC is 6 pm IST: due. 12:29 UTC is 5:59 pm IST: not yet. 15:30 UTC is 9 pm IST: closed.
    expect(orderReminderDay(new Date('2026-09-16T12:30:00Z'))).toBe(TOMORROW);
    expect(orderReminderDay(new Date('2026-09-16T12:29:00Z'))).toBeNull();
    expect(orderReminderDay(new Date('2026-09-16T15:30:00Z'))).toBeNull();
    expect(orderReminderTimeFor(TOMORROW).toISOString()).toBe('2026-09-16T12:30:00.000Z');
  });
});

describe('buildOrderReminders', () => {
  it("tells each customer with a delivery tomorrow what is coming and until when they can change it", () => {
    const withExtra = customer('b', {
      extraOrders: [
        { id: 'x1', orderDate: TOMORROW, productName: 'Paneer', quantityLabel: '200 gm', price: 110, status: 'Pending', ...TS },
      ],
    });
    const rows = buildOrderReminders([customer('a'), withExtra], TOMORROW);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      audience: 'Customer',
      customerId: 'a',
      type: 'OrderReminder',
      title: "Tomorrow's order · Thu, 17 Sep",
      dateYmd: TOMORROW,
      subjectKey: orderReminderKey('a', TOMORROW),
    });
    expect(rows[0]!.body).toContain('Cow Milk · 500 ml × 2');
    expect(rows[0]!.body).toContain('Do you want to change it, or keep it as it is?');
    expect(rows[0]!.body).toContain('until 9 pm today');
    expect(rows[1]!.body).toContain('Paneer · 200 gm');
    expect(rows[1]!.body).toContain('includes 1 extra item');
  });

  it('skips customers with nothing tomorrow, inactive accounts, no app access, and anyone already reminded', () => {
    const skipped = customer('skip', {
      subscriptionExceptions: [{ id: 's', fromYmd: TOMORROW, toYmd: TOMORROW, createdBy: 'customer', ...TS }],
    });
    const rows = buildOrderReminders(
      [skipped, customer('inactive', { status: 'Inactive' }), customer('noapp', { appAccessEnabled: false }), customer('done'), customer('new')],
      TOMORROW,
      new Set([orderReminderKey('done', TOMORROW)]),
    );
    expect(rows.map((r) => r.customerId)).toEqual(['new']);
  });
});

describe('sendDueOrderReminders', () => {
  beforeEach(() => {
    memory.clear();
    customerList.items = [customer('a'), customer('b')];
  });

  it('sends once per customer per evening, with one summary for the admin', async () => {
    const evening = new Date(2026, 8, 16, 18, 1, 0);
    expect(await sendDueOrderReminders(evening)).toBe(2);
    expect(await sendDueOrderReminders(new Date(2026, 8, 16, 18, 2, 0))).toBe(0);

    const rows = await loadNotifications();
    expect(rows.filter((r) => r.audience === 'Customer').map((r) => r.customerId).sort()).toEqual(['a', 'b']);
    const admin = rows.filter((r) => r.audience === 'Admin');
    expect(admin).toHaveLength(1);
    expect(admin[0]!.body).toContain('2 customers were asked at 6 pm');

    // A customer added later that evening is still reminded, without a second admin summary.
    customerList.items = [...customerList.items, customer('c')];
    expect(await sendDueOrderReminders(new Date(2026, 8, 16, 19, 30, 0))).toBe(1);
    const after = await loadNotifications();
    expect(after.filter((r) => r.audience === 'Customer')).toHaveLength(3);
    expect(after.filter((r) => r.audience === 'Admin')).toHaveLength(1);
  });

  it('does nothing before 6 pm or after the cut-off', async () => {
    expect(await sendDueOrderReminders(new Date(2026, 8, 16, 17, 0, 0))).toBe(0);
    expect(await sendDueOrderReminders(new Date(2026, 8, 16, 21, 5, 0))).toBe(0);
    expect(await loadNotifications()).toEqual([]);
  });

  it('says nothing from an app that cannot see every customer — one household never reminds another', async () => {
    seesEveryCustomer = false;
    expect(await sendDueOrderReminders(new Date(2026, 8, 16, 18, 1, 0))).toBe(0);
    expect(await loadNotifications()).toEqual([]);
    seesEveryCustomer = true;
  });

  it('says nothing at all where the dairy’s server keeps the rows: 6 pm is its own job', async () => {
    notifications.service.listAll = async () => [];
    expect(await sendDueOrderReminders(new Date(2026, 8, 16, 18, 1, 0))).toBe(0);
    expect(await loadNotifications()).toEqual([]);
    delete notifications.service.listAll;
  });
});

describe('answers to the reminder', () => {
  beforeEach(() => {
    memory.clear();
    customerList.items = [customer('a'), customer('b')];
  });

  it("records keep / change on the reminder and keeps one running tally for the admin", async () => {
    await sendDueOrderReminders(new Date(2026, 8, 16, 18, 0, 0));
    const [reminderA] = buildOrderReminders([customer('a')], TOMORROW);
    const [reminderB] = buildOrderReminders([customer('b')], TOMORROW);

    await recordOrderReminderResponse({ reminder: reminderA as never, response: 'keep', customerName: 'Asha' });
    await recordOrderReminderResponse({ reminder: reminderB as never, response: 'change', customerName: 'Ravi' });
    // Changing one's mind replaces the answer, not adds one.
    await recordOrderReminderResponse({ reminder: reminderB as never, response: 'keep', customerName: 'Ravi' });

    const rows = await loadNotifications();
    const a = rows.find((r) => r.audience === 'Customer' && r.customerId === 'a')!;
    expect(a.response).toBe('keep');
    expect(a.readAt).toBeTruthy();
    expect(rows.filter((r) => r.audience === 'Customer')).toHaveLength(2);

    const tallies = rows.filter((r) => r.audience === 'Admin' && r.subjectKey === `reminder-answers:${TOMORROW}`);
    expect(tallies).toHaveLength(1);
    expect(tallies[0]!.body).toContain("2 kept tomorrow's order as it is, 0 chose to change it");
  });

  it('adds the reminder with the answer when the phone showed it before any app sent it', async () => {
    const [reminder] = buildOrderReminders([customer('a')], TOMORROW);
    await recordOrderReminderResponse({ reminder: reminder as never, response: 'change' });
    const rows = await loadNotifications();
    expect(rows.filter((r) => r.audience === 'Customer')).toMatchObject([{ customerId: 'a', response: 'change', type: 'OrderReminder' }]);
  });
});

describe('upcomingOrderReminders', () => {
  it('schedules one per coming day with a delivery, at 6 pm IST the evening before, skipping evenings already past', () => {
    const c = customer('a', {
      subscriptionExceptions: [{ id: 's', fromYmd: '2026-09-19', toYmd: '2026-09-19', createdBy: 'customer', ...TS }],
    });
    // 7 pm IST on the 16th: tonight's reminder (for the 17th) is already past.
    const list = upcomingOrderReminders(c, new Date('2026-09-16T13:30:00Z'), 5);
    expect(list.map((r) => r.ymd)).toEqual(['2026-09-18', '2026-09-20', '2026-09-21']);
    expect(list[0]!.at.toISOString()).toBe('2026-09-17T12:30:00.000Z');
    expect(list[0]!.title).toBe("Tomorrow's order · Fri, 18 Sep");
  });
});

describe('reminders follow the app language', () => {
  it('reads a scheduled reminder in the language chosen when it is scheduled', async () => {
    const { getLanguage, setLanguage } = await import('@/src/i18n/language');
    const before = getLanguage();
    const [first] = upcomingOrderReminders(customer('a'), new Date('2026-09-16T10:00:00Z'), 1);
    try {
      expect(first!.title).toBe("Tomorrow's order · Thu, 17 Sep");
      setLanguage('mr');
      expect(first!.title).toBe('उद्याची ऑर्डर · गुरु, 17 सप्टें');
      expect(first!.body).toContain('रात्री 9 पर्यंत');
    } finally {
      setLanguage(before);
    }
  });
});
