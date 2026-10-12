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

import { notificationLook } from '@/src/components/notifications/notificationLook';
import type { AppNotification } from '@/src/domain/notifications/entities';
import { notifyOfferAvailable, offerNotificationSubject } from '@/src/domain/notifications/events';
import { notificationText } from '@/src/domain/notifications/notificationText';
import { loadNotifications, notificationsFor } from '@/src/infrastructure/notificationsStore';
import { NOTIFICATIONS_STORE_KEY } from '@/src/infrastructure/storage/keys';

const diwali = { id: 'offer_diwali', title: { en: 'Diwali sale', mr: 'दिवाळी सेल' }, endYmd: '2026-10-31' };

const mine = (all: AppNotification[], customerId = 'cust_1') => notificationsFor(all, { audience: 'Customer', customerId });

describe('new offer notifications', () => {
  beforeEach(() => {
    memory.clear();
  });

  it('writes one notification in both languages that opens Offers', async () => {
    expect(await notifyOfferAvailable({ customerId: 'cust_1', offer: diwali })).toBe(true);
    const [row, ...rest] = mine(await loadNotifications());
    expect(rest).toHaveLength(0);
    expect(row).toMatchObject({
      type: 'Offer',
      title: 'New offer for you',
      body: 'Diwali sale · Valid till 31 Oct. Open Offers to see it.',
      link: '/(customer)/offers',
      subjectKey: offerNotificationSubject('offer_diwali', 'cust_1'),
    });
    expect(notificationText(row!, 'mr').body).toContain('दिवाळी सेल');
    expect(notificationLook('Offer').category).toBe('Offer');
  });

  it('never notifies the same customer about the same offer twice, even after it was read long ago', async () => {
    await notifyOfferAvailable({ customerId: 'cust_1', offer: diwali });
    // Read, and older than the store's merge window.
    const old = (await loadNotifications()).map((n) => ({ ...n, readAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' }));
    memory.set(NOTIFICATIONS_STORE_KEY, JSON.stringify(old));

    expect(await notifyOfferAvailable({ customerId: 'cust_1', offer: diwali })).toBe(false);
    const rows = mine(await loadNotifications());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.readAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('keeps calls made at the same moment to one row', async () => {
    await Promise.all([
      notifyOfferAvailable({ customerId: 'cust_1', offer: diwali }),
      notifyOfferAvailable({ customerId: 'cust_1', offer: diwali }),
    ]);
    expect(mine(await loadNotifications())).toHaveLength(1);
  });

  it('notifies each customer, and each offer, separately', async () => {
    await notifyOfferAvailable({ customerId: 'cust_1', offer: diwali });
    await notifyOfferAvailable({ customerId: 'cust_2', offer: diwali });
    await notifyOfferAvailable({ customerId: 'cust_1', offer: { id: 'offer_2', title: { en: 'Ghee week' } } });
    const all = await loadNotifications();
    expect(mine(all).map((n) => n.body)).toEqual(
      expect.arrayContaining(['Ghee week · Until the dairy ends it. Open Offers to see it.']),
    );
    expect(mine(all)).toHaveLength(2);
    expect(mine(all, 'cust_2')).toHaveLength(1);
  });
});
