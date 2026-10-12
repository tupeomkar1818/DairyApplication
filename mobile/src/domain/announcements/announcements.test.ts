import { describe, expect, it } from 'vitest';

import {
  announcementsForCustomer,
  birthdaysOn,
  deliveryAnnouncementId,
  deliveryAttemptAnnouncement,
  isUnreadBy,
  mediaFromLink,
  personalize,
  reachOf,
  recentAnnouncements,
  recipientIds,
  youtubeVideoId,
} from '@/src/domain/announcements/announcements';
import type { Announcement } from '@/src/domain/announcements/entities';

function announcement(id: string, overrides: Partial<Announcement> = {}): Announcement {
  return {
    id,
    category: 'Festival',
    title: 'Happy Diwali, {name}!',
    message: 'Wishes from all of us.',
    audience: { kind: 'all' },
    source: 'admin',
    readBy: {},
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '2026-09-10T10:00:00.000Z',
    ...overrides,
  };
}

describe('who sees an announcement', () => {
  const all = [
    announcement('everyone', { createdAt: '2026-09-10T10:00:00.000Z' }),
    announcement('asha-only', { audience: { kind: 'customers', customerIds: ['asha'] }, createdAt: '2026-09-12T10:00:00.000Z' }),
    announcement('ravi-only', { audience: { kind: 'customers', customerIds: ['ravi'] } }),
  ];

  it('shows a customer the ones for everyone and the ones for them, newest first', () => {
    expect(announcementsForCustomer(all, 'asha').map((a) => a.id)).toEqual(['asha-only', 'everyone']);
    expect(announcementsForCustomer(all, 'ravi').map((a) => a.id)).toEqual(['everyone', 'ravi-only']);
  });

  it('keeps only the last 90 days', () => {
    const now = new Date('2026-09-16T12:00:00.000Z');
    const list = [
      announcement('today', { createdAt: '2026-09-16T08:00:00.000Z' }),
      announcement('day-90', { createdAt: '2026-06-18T12:00:00.000Z' }),
      announcement('day-91', { createdAt: '2026-06-17T11:59:00.000Z' }),
      announcement('broken', { createdAt: 'not a date' }),
    ];
    expect(recentAnnouncements(list, now).map((a) => a.id)).toEqual(['today', 'day-90']);
  });

  it('counts recipients and readers', () => {
    const read = announcement('x', { readBy: { asha: '2026-09-11T00:00:00.000Z' } });
    expect(reachOf(read, ['asha', 'ravi', 'meena'])).toEqual({ recipients: 3, read: 1 });
    expect(isUnreadBy(read, 'asha')).toBe(false);
    expect(isUnreadBy(read, 'ravi')).toBe(true);
  });

  it('notifies everyone for "all", only the chosen otherwise', () => {
    expect(recipientIds({ kind: 'all' }, ['a', 'b'])).toEqual(['a', 'b']);
    expect(recipientIds({ kind: 'customers', customerIds: ['b', 'b'] }, ['a', 'b'])).toEqual(['b']);
  });
});

describe('writing to each customer', () => {
  it('greets by first name', () => {
    expect(personalize('Happy birthday, {name}!', 'Rahul Patil')).toBe('Happy birthday, Rahul!');
    expect(personalize('Hi {NAME}', undefined)).toBe('Hi there');
  });

  it("finds today's birthdays whichever way the date was saved, skipping inactive customers", () => {
    const customers = [
      { id: 'a', dateOfBirth: '1990-09-16' },
      { id: 'b', dateOfBirth: '16/09/1985' },
      { id: 'c', dateOfBirth: '1990-09-17' },
      { id: 'd', dateOfBirth: '1990-09-16T00:00:00.000Z', status: 'Inactive' },
      { id: 'e' },
    ];
    expect(birthdaysOn(customers, '2026-09-16').map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('media links', () => {
  it('recognises YouTube links of every shape', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://example.com/video.mp4')).toBeNull();
  });

  it('reads a pasted link as a picture or a video', () => {
    expect(mediaFromLink('https://cdn.example.com/diwali.jpg')).toEqual({ kind: 'image', uri: 'https://cdn.example.com/diwali.jpg' });
    expect(mediaFromLink('https://youtu.be/dQw4w9WgXcQ')).toEqual({ kind: 'video', uri: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(mediaFromLink('https://cdn.example.com/offer.mp4')?.kind).toBe('video');
    expect(mediaFromLink('not a link')).toBeNull();
  });
});

describe('delivery attempts', () => {
  it('leave the customer a message from their delivery boy', () => {
    const a = deliveryAttemptAnnouncement({
      customerId: 'asha',
      dateYmd: '2026-09-16',
      delivered: true,
      itemsLabel: 'Cow Milk · 500 ml',
      deliveryBoyName: 'Sagar',
      now: new Date('2026-09-16T01:30:00.000Z'),
    });
    expect(a).toMatchObject({
      id: deliveryAnnouncementId('asha', '2026-09-16'),
      category: 'Delivery',
      source: 'delivery',
      senderName: 'Sagar',
      audience: { kind: 'customers', customerIds: ['asha'] },
      title: 'Your order was delivered',
    });
    expect(personalize(a.message, 'Asha Kale')).toBe(
      'Hello Asha, your order was delivered on Wed, 16 Sep by Sagar. Delivered: Cow Milk · 500 ml.',
    );
  });

  it('use one announcement per customer and day, so a correction replaces it', () => {
    const missed = deliveryAttemptAnnouncement({ customerId: 'asha', dateYmd: '2026-09-16', delivered: false, itemsLabel: '' });
    const delivered = deliveryAttemptAnnouncement({ customerId: 'asha', dateYmd: '2026-09-16', delivered: true, itemsLabel: 'Milk' });
    expect(missed.id).toBe(delivered.id);
    expect(missed.title).toBe('We could not deliver today');
  });
});
