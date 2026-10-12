import { describe, expect, it } from 'vitest';

import {
  notificationFromRow,
  notificationToRow,
  replacedBy,
  sameReader,
  type Notification,
  type NotificationRow,
} from '@/notifications/mapping';

const TS = { created_at: '2026-10-11T12:30:00.000Z', updated_at: '2026-10-11T12:30:00.000Z' };

const reminder: Notification = {
  id: 'ntf_1',
  audience: 'Customer',
  customerId: 'cust_1',
  type: 'OrderReminder',
  title: "Tomorrow's order · Mon, 12 Oct",
  body: 'Cow Milk · 500 ml × 2. Do you want to change it, or keep it as it is?',
  translations: { mr: { title: 'उद्याची ऑर्डर · सोम, १२ ऑक्टो', body: 'गाईचं दूध · ५०० मिली × २.' } },
  link: '/(customer)/my-days',
  subjectKey: 'reminder:cust_1:2026-10-12',
  dateYmd: '2026-10-12',
  createdAt: TS.created_at,
  updatedAt: TS.updated_at,
};

describe('notifications: record ↔ row', () => {
  it('keeps every field the app sent, in both languages', () => {
    expect(notificationFromRow({ ...notificationToRow(reminder), ...TS } as NotificationRow)).toEqual(reminder);
  });

  it('keeps an answer and a read mark', () => {
    const answered: Notification = { ...reminder, response: 'keep', respondedAt: TS.created_at, readAt: TS.created_at };
    expect(notificationFromRow({ ...notificationToRow(answered), ...TS } as NotificationRow)).toEqual(answered);
  });

  it('keeps the bill month and the announcement a row opens', () => {
    const row: Notification = {
      ...reminder,
      type: 'Announcement',
      announcementId: 'ann_1',
      monthYyyyMm: '2026-10',
      dateYmd: undefined,
      subjectKey: undefined,
    };
    const back = notificationFromRow({ ...notificationToRow(row), ...TS } as NotificationRow);
    expect(back).toMatchObject({ announcementId: 'ann_1', monthYyyyMm: '2026-10' });
    expect(back.dateYmd).toBeUndefined();
  });

  it('shows an older row with no Marathi in English', () => {
    const english: Notification = { ...reminder, translations: undefined };
    const back = notificationFromRow({ ...notificationToRow(english), ...TS } as NotificationRow);
    expect(back.translations).toBeUndefined();
    expect(back.title).toBe(reminder.title);
  });
});

describe('notifications: whose inbox', () => {
  it('tells two readers apart', () => {
    expect(sameReader({ audience: 'Customer', customerId: 'a' }, { audience: 'Customer', customerId: 'a' })).toBe(true);
    expect(sameReader({ audience: 'Customer', customerId: 'a' }, { audience: 'Customer', customerId: 'b' })).toBe(false);
    expect(sameReader({ audience: 'Admin' }, { audience: 'Admin', customerId: null })).toBe(true);
    expect(sameReader({ audience: 'Admin' }, { audience: 'DeliveryBoy', deliveryBoyId: 'db_1' })).toBe(false);
  });
});

describe('notifications: one change, one notification', () => {
  const now = new Date('2026-10-11T12:30:00.000Z');
  const stored = (over: Partial<NotificationRow>): NotificationRow =>
    ({
      ...notificationToRow(reminder),
      created_at: '2026-10-11T12:00:00.000Z',
      updated_at: null,
      ...over,
    }) as NotificationRow;

  it('replaces the same reader’s recent row on the same subject', () => {
    expect(replacedBy(reminder, [stored({ id: 'ntf_old' })], now)).toEqual(['ntf_old']);
  });

  it('leaves another reader’s row alone', () => {
    expect(replacedBy(reminder, [stored({ id: 'ntf_other', customer_id: 'cust_2' })], now)).toEqual([]);
  });

  it('leaves an older row alone: that change was yesterday’s news', () => {
    expect(replacedBy(reminder, [stored({ id: 'ntf_old', created_at: '2026-10-11T10:00:00.000Z' })], now)).toEqual([]);
  });

  it('replaces nothing when the row is not about a subject', () => {
    expect(replacedBy({ ...reminder, subjectKey: undefined }, [stored({ id: 'ntf_old' })], now)).toEqual([]);
  });
});
