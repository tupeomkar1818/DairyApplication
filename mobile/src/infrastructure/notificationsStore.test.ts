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

import type { AppNotification } from '@/src/domain/notifications/entities';
import {
  addNotification,
  addNotifications,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationsFor,
  unreadCount,
} from '@/src/infrastructure/notificationsStore';

const customerRow = {
  audience: 'Customer' as const,
  customerId: 'cust_1',
  type: 'OrderPlaced' as const,
  title: 'Order placed',
  body: 'Paneer for 16 Sep.',
};

const adminRow = {
  audience: 'Admin' as const,
  customerId: 'cust_1',
  type: 'OrderPlaced' as const,
  title: 'Asha ordered an add-on',
  body: 'Paneer for 16 Sep.',
};

describe('notifications store', () => {
  beforeEach(() => {
    memory.clear();
  });

  it('starts empty and keeps what it is given', async () => {
    expect(await loadNotifications()).toEqual([]);
    await addNotification(customerRow);
    const rows = await loadNotifications();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: 'Order placed', audience: 'Customer' });
    expect(rows[0]!.id).toMatch(/^ntf_/);
  });

  it('writes a batch in one go without dropping rows', async () => {
    await addNotifications([customerRow, adminRow]);
    expect(await loadNotifications()).toHaveLength(2);
  });

  it('does not lose a row when two events are raised at once', async () => {
    await Promise.all([addNotification(customerRow), addNotification(adminRow)]);
    expect(await loadNotifications()).toHaveLength(2);
  });

  it('gives each reader only their own rows', async () => {
    await addNotifications([
      customerRow,
      adminRow,
      { ...customerRow, customerId: 'cust_2', title: 'Someone else' },
      { audience: 'DeliveryBoy', deliveryBoyId: 'db_1', type: 'OrderPlaced', title: 'Route change', body: '' },
    ]);
    const all = await loadNotifications();

    expect(notificationsFor(all, { audience: 'Customer', customerId: 'cust_1' }).map((n) => n.title)).toEqual([
      'Order placed',
    ]);
    expect(notificationsFor(all, { audience: 'Admin' }).map((n) => n.title)).toEqual(['Asha ordered an add-on']);
    expect(notificationsFor(all, { audience: 'DeliveryBoy', deliveryBoyId: 'db_1' })).toHaveLength(1);
    expect(notificationsFor(all, { audience: 'DeliveryBoy', deliveryBoyId: 'db_2' })).toHaveLength(0);
  });

  it('never shows a customer row to a customer whose id is unknown', async () => {
    await addNotification(customerRow);
    const all = await loadNotifications();
    expect(notificationsFor(all, { audience: 'Customer' })).toHaveLength(0);
  });

  it('counts and clears unread rows', async () => {
    const row = await addNotification(customerRow);
    await addNotification({ ...customerRow, title: 'Second' });

    let mine = notificationsFor(await loadNotifications(), { audience: 'Customer', customerId: 'cust_1' });
    expect(unreadCount(mine)).toBe(2);

    await markNotificationRead(row.id);
    mine = notificationsFor(await loadNotifications(), { audience: 'Customer', customerId: 'cust_1' });
    expect(unreadCount(mine)).toBe(1);

    await markAllNotificationsRead({ audience: 'Customer', customerId: 'cust_1' });
    mine = notificationsFor(await loadNotifications(), { audience: 'Customer', customerId: 'cust_1' });
    expect(unreadCount(mine)).toBe(0);
  });

  it('marking all read leaves another reader untouched', async () => {
    await addNotifications([customerRow, adminRow]);
    await markAllNotificationsRead({ audience: 'Customer', customerId: 'cust_1' });

    const admin = notificationsFor(await loadNotifications(), { audience: 'Admin' });
    expect(unreadCount(admin)).toBe(1);
  });

  it('drops stored junk instead of crashing the inbox', async () => {
    memory.set('DAIRY_NOTIFICATIONS_V1', JSON.stringify([{ nope: true }, null, 'text']));
    expect(await loadNotifications()).toEqual([]);
  });

  it('returns rows newest first', async () => {
    const rows: AppNotification[] = [
      { ...customerRow, id: 'a', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
      { ...customerRow, id: 'b', createdAt: '2026-09-05T00:00:00.000Z', updatedAt: '2026-09-05T00:00:00.000Z' },
    ];
    memory.set('DAIRY_NOTIFICATIONS_V1', JSON.stringify(rows));

    const mine = notificationsFor(await loadNotifications(), { audience: 'Customer', customerId: 'cust_1' });
    expect(mine.map((n) => n.id)).toEqual(['b', 'a']);
  });
});
