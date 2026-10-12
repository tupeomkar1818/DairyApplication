import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = new Map<string, string>();

vi.mock('@/src/infrastructure/storage/storage', () => ({
  readJson: async (key: string) => {
    const raw = memory.get(key);
    return raw ? JSON.parse(raw) : null;
  },
  writeJson: async (key: string, value: unknown) => {
    memory.set(key, JSON.stringify(value));
  },
}));

// The event helpers write through the registry; these tests are about what the phone stores, so they wire the
// on-phone services and leave the server-backed ones out.
vi.mock('@/src/infrastructure/service-registry', async () => {
  const [{ NotificationServiceMock }, { AnnouncementServiceMock }, { ChatServiceMock }] = await Promise.all([
    import('@/src/domain/notifications/service.mock'),
    import('@/src/domain/announcements/service.mock'),
    import('@/src/domain/chat/service.mock'),
  ]);
  return {
    services: {
      notifications: new NotificationServiceMock(),
      announcements: new AnnouncementServiceMock(),
      chat: new ChatServiceMock(),
    },
  };
});

import type { AppNotification } from '@/src/domain/notifications/entities';
import {
  notifyDayResumed,
  notifyDaysSkipped,
  notifyDeliveryMarked,
  notifyOrderCancelled,
  notifyOrderPlaced,
  notifyPaymentRecorded,
  notifyQuantityChanged,
} from '@/src/domain/notifications/events';
import { notificationText } from '@/src/domain/notifications/notificationText';
import {
  loadNotifications,
  mergeNotifications,
  NOTIFICATION_MERGE_WINDOW_MS,
  notificationsFor,
} from '@/src/infrastructure/notificationsStore';

const customer = { customerId: 'cust_1', customerName: 'Asha', deliveryBoyId: 'db_1' };

/** Events are fire-and-forget; let the queued writes land before reading. */
async function settle(): Promise<AppNotification[]> {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  return loadNotifications();
}

const inbox = (all: AppNotification[]) => ({
  customer: notificationsFor(all, { audience: 'Customer', customerId: 'cust_1' }),
  admin: notificationsFor(all, { audience: 'Admin' }),
  deliveryBoy: notificationsFor(all, { audience: 'DeliveryBoy', deliveryBoyId: 'db_1' }),
});

describe('one change, one notification', () => {
  beforeEach(() => {
    memory.clear();
  });

  it('merges quantity steps on the same line and day into the latest', async () => {
    const step = (n: number) =>
      notifyQuantityChanged({ ...customer, itemLabel: 'Cow Milk · 500 ml', fromYmd: '2026-09-21', toYmd: '2026-09-21', numberOfItems: n, usual: 1 });
    step(2);
    await settle();
    step(3);
    const { customer: mine, admin, deliveryBoy } = inbox(await settle());

    expect(mine.map((n) => n.body)).toEqual(['Cow Milk · 500 ml × 3 on 21 Sep.']);
    expect(admin).toHaveLength(1);
    expect(deliveryBoy).toHaveLength(1);
  });

  it('keeps separate notifications for different days or products', async () => {
    notifyQuantityChanged({ ...customer, itemLabel: 'Cow Milk · 500 ml', fromYmd: '2026-09-21', toYmd: '2026-09-21', numberOfItems: 2, usual: 1 });
    await settle();
    notifyQuantityChanged({ ...customer, itemLabel: 'Cow Milk · 500 ml', fromYmd: '2026-09-22', toYmd: '2026-09-22', numberOfItems: 2, usual: 1 });
    await settle();
    notifyQuantityChanged({ ...customer, itemLabel: 'Curd · 500 gm', fromYmd: '2026-09-21', toYmd: '2026-09-21', numberOfItems: 2, usual: 1 });
    expect(inbox(await settle()).customer).toHaveLength(3);
  });

  it('shows a pause that was undone as the latest state only', async () => {
    notifyDaysSkipped({ ...customer, fromYmd: '2026-09-20', toYmd: '2026-09-20' });
    await settle();
    notifyDayResumed({ ...customer, fromYmd: '2026-09-20', toYmd: '2026-09-20' });
    const { customer: mine } = inbox(await settle());
    expect(mine.map((n) => n.title)).toEqual(['Delivery back on']);
  });

  describe('add-ons for the same day', () => {
    const TS = { createdAt: '2026-09-16T00:00:00.000Z', updatedAt: '2026-09-16T00:00:00.000Z' };
    const order = (id: string, productName: string, quantityLabel: string, numberOfItems = 1, dateYmd = '2026-09-18') =>
      ({ ...TS, id, orderDate: dateYmd, deliveryDate: dateYmd, productName, quantityLabel, numberOfItems, price: 50, status: 'Pending' }) as const;

    it('come under one notification listing every item', async () => {
      const paneer = order('o1', 'Paneer', '200 gm', 2);
      const curd = order('o2', 'Curd', '500 gm');
      const lassi = order('o3', 'Lassi', '250 ml');

      notifyOrderPlaced({ ...customer, itemLabel: 'Paneer · 200 gm × 2', dateYmd: '2026-09-18', extraOrders: [paneer] });
      await settle();
      notifyOrderPlaced({ ...customer, itemLabel: 'Curd · 500 gm', dateYmd: '2026-09-18', extraOrders: [paneer, curd] });
      await settle();
      notifyOrderPlaced({ ...customer, itemLabel: 'Lassi · 250 ml', dateYmd: '2026-09-18', extraOrders: [paneer, curd, lassi] });
      const { customer: mine, admin, deliveryBoy } = inbox(await settle());

      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({
        title: '3 add-ons ordered',
        body: 'For Fri, 18 Sep: Paneer · 200 gm × 2, Curd · 500 gm, Lassi · 250 ml.',
      });
      expect(admin.map((n) => n.title)).toEqual(['Asha ordered 3 add-ons']);
      expect(deliveryBoy.map((n) => n.body)).toEqual(['Add-ons on Fri, 18 Sep: Paneer · 200 gm × 2, Curd · 500 gm, Lassi · 250 ml.']);
    });

    it('stay separate for different days', async () => {
      const today = order('o1', 'Paneer', '200 gm', 1, '2026-09-18');
      const nextDay = order('o2', 'Paneer', '200 gm', 1, '2026-09-19');
      notifyOrderPlaced({ ...customer, itemLabel: 'Paneer · 200 gm', dateYmd: '2026-09-18', extraOrders: [today] });
      await settle();
      notifyOrderPlaced({ ...customer, itemLabel: 'Paneer · 200 gm', dateYmd: '2026-09-19', extraOrders: [today, nextDay] });
      expect(inbox(await settle()).customer).toHaveLength(2);
    });

    it('show what is still coming after one is cancelled, and say so when none are left', async () => {
      const paneer = order('o1', 'Paneer', '200 gm');
      const curd = order('o2', 'Curd', '500 gm');
      notifyOrderPlaced({ ...customer, itemLabel: 'Curd · 500 gm', dateYmd: '2026-09-18', extraOrders: [paneer, curd] });
      await settle();

      notifyOrderCancelled({
        ...customer,
        itemLabel: 'Curd · 500 gm',
        dateYmd: '2026-09-18',
        extraOrders: [paneer, { ...curd, status: 'Cancelled' }],
      });
      let mine = inbox(await settle()).customer;
      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({ title: 'Add-ons updated', body: 'Curd · 500 gm cancelled. Still coming on Fri, 18 Sep: Paneer · 200 gm.' });

      notifyOrderCancelled({
        ...customer,
        itemLabel: 'Paneer · 200 gm',
        dateYmd: '2026-09-18',
        extraOrders: [{ ...paneer, status: 'Cancelled' }, { ...curd, status: 'Cancelled' }],
      });
      mine = inbox(await settle()).customer;
      expect(mine.map((n) => [n.title, n.body])).toEqual([
        ['Add-ons cancelled', 'No add-ons on Fri, 18 Sep now. Paneer · 200 gm was cancelled.'],
      ]);
    });
  });

  it('replaces a delivery notice when the day is marked again', async () => {
    notifyDeliveryMarked({ customerId: 'cust_1', customerName: 'Asha', dateYmd: '2026-09-16', delivered: false, itemsLabel: 'Cow Milk' });
    await settle();
    notifyDeliveryMarked({ customerId: 'cust_1', customerName: 'Asha', dateYmd: '2026-09-16', delivered: true, itemsLabel: 'Cow Milk' });
    const all = await settle();
    expect(inbox(all).customer.map((n) => n.title)).toEqual(['Delivered']);
    // The admin's "not delivered" alert stays: the delivered receipt goes to the customer only.
    expect(inbox(all).admin).toHaveLength(1);
  });

  it('never merges separate payments', async () => {
    notifyPaymentRecorded({ customerId: 'cust_1', amount: 300, dateYmd: '2026-09-05' });
    await settle();
    notifyPaymentRecorded({ customerId: 'cust_1', amount: 300, dateYmd: '2026-09-05' });
    expect(inbox(await settle()).customer).toHaveLength(2);
  });
});

describe('mergeNotifications', () => {
  const row = (id: string, createdAt: string, extra: Partial<AppNotification> = {}): AppNotification => ({
    id,
    audience: 'Customer',
    customerId: 'cust_1',
    type: 'QuantityChanged',
    title: 't',
    body: id,
    subjectKey: 'quantity:cust_1:milk:2026-09-21:2026-09-21',
    createdAt,
    updatedAt: createdAt,
    ...extra,
  });
  const now = new Date('2026-09-16T12:00:00.000Z');

  it('leaves an older notice on the same subject once the window has passed', () => {
    const old = row('old', new Date(now.getTime() - NOTIFICATION_MERGE_WINDOW_MS - 1000).toISOString());
    const fresh = row('new', now.toISOString());
    expect(mergeNotifications([old], [fresh], now).map((n) => n.id)).toEqual(['new', 'old']);
  });

  it('replaces a read notice too, and the new one is unread', () => {
    const read = row('read', new Date(now.getTime() - 60_000).toISOString(), { readAt: now.toISOString() });
    const fresh = row('new', now.toISOString());
    const merged = mergeNotifications([read], [fresh], now);
    expect(merged.map((n) => n.id)).toEqual(['new']);
    expect(merged[0]!.readAt).toBeUndefined();
  });

  it('only replaces the same reader’s notice', () => {
    const otherCustomer = row('other', now.toISOString(), { customerId: 'cust_2' });
    const fresh = row('new', now.toISOString());
    expect(mergeNotifications([otherCustomer], [fresh], now).map((n) => n.id)).toEqual(['new', 'other']);
  });

  it('never merges notices without a subject', () => {
    const plain = row('plain', now.toISOString(), { subjectKey: undefined });
    const fresh = row('new', now.toISOString(), { subjectKey: undefined });
    expect(mergeNotifications([plain], [fresh], now)).toHaveLength(2);
  });
});

describe('notifications in the reader’s language', () => {
  beforeEach(() => {
    memory.clear();
  });

  it('stores English and Marathi words, and shows each reader their own', async () => {
    notifyDaysSkipped({ ...customer, fromYmd: '2026-09-20', toYmd: '2026-09-20' });
    const [row] = inbox(await settle()).customer;
    expect(row!.title).toBe('Delivery paused');
    expect(notificationText(row!, 'en')).toEqual({ title: row!.title, body: row!.body });
    const mr = notificationText(row!, 'mr');
    expect(mr.title).toBe('डिलिव्हरी थांबवली');
    expect(mr.body).toContain('20 सप्टें');
  });

  it('shows rows saved before translations existed in English', () => {
    const old = { title: 'Delivered', body: 'Cow Milk delivered on 16 Sep.' };
    expect(notificationText(old, 'mr')).toEqual(old);
  });
});
