import { describe, expect, it } from 'vitest';

import {
  announcementFromRow,
  announcementToRow,
  audienceIds,
  forCustomer,
  isFor,
  sentTo,
  type Announcement,
  type AnnouncementRow,
} from '@/announcements/mapping';

const TS = { created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-02T00:00:00.000Z' };

/** A delivery announcement: the app writes these itself, in both languages. */
const delivered: Announcement = {
  id: 'ann_delivery_cust_1_2026-10-11',
  category: 'Delivery',
  title: 'Delivered',
  message: 'Your milk was delivered on Sat, 11 Oct by Sagar.',
  translations: { mr: { title: 'पोहोचले', message: 'शनिवार, ११ ऑक्टोबर रोजी तुमचं दूध पोहोचवलं.' } },
  audience: { kind: 'customers', customerIds: ['cust_1'] },
  source: 'delivery',
  senderName: 'Sagar More',
  dateYmd: '2026-10-11',
  readBy: {},
  createdAt: TS.created_at,
  updatedAt: TS.updated_at,
};

describe('announcements: record ↔ row', () => {
  it('keeps every field the app sent, column-backed or not', () => {
    const back = announcementFromRow({ ...announcementToRow(delivered), ...TS } as AnnouncementRow);
    expect(back).toEqual(delivered);
  });

  it('keeps a picture with the message', () => {
    const withMedia: Announcement = { ...delivered, media: { kind: 'image', uri: 'https://example.com/diwali.jpg' } };
    const back = announcementFromRow({ ...announcementToRow(withMedia), ...TS } as AnnouncementRow);
    expect(back.media).toEqual({ kind: 'image', uri: 'https://example.com/diwali.jpg' });
  });

  it('stores what the admin typed with no Marathi of its own', () => {
    const typed: Announcement = {
      id: 'ann_1',
      category: 'Festival',
      title: 'Happy Diwali',
      message: 'Wishing you light and sweets.',
      audience: { kind: 'all' },
      source: 'admin',
      readBy: {},
      createdAt: TS.created_at,
      updatedAt: TS.updated_at,
    };
    const row = announcementToRow(typed);
    expect(row.title_mr).toBeNull();
    expect(row.audience_customer_ids_json).toBeNull();
    expect(announcementFromRow({ ...row, ...TS } as AnnouncementRow)).toEqual(typed);
  });

  it('reads who has opened it out of its own table', () => {
    const back = announcementFromRow({ ...announcementToRow(delivered), ...TS } as AnnouncementRow, [
      { announcement_id: delivered.id, customer_id: 'cust_1', read_at: '2026-10-11T07:00:00.000Z' },
    ]);
    expect(back.readBy).toEqual({ cust_1: '2026-10-11T07:00:00.000Z' });
  });
});

describe('announcements: who it was sent to', () => {
  const everybody = { audience_kind: 'all', audience_customer_ids_json: null };
  const some = { audience_kind: 'customers', audience_customer_ids_json: JSON.stringify(['cust_1', 'cust_2']) };

  it('is for everybody, including customers who join later', () => {
    expect(isFor(everybody, 'cust_new')).toBe(true);
    expect(sentTo({ ...delivered, audience: { kind: 'all' } }, 'cust_new')).toBe(true);
  });

  it('is for the named customers only', () => {
    expect(isFor(some, 'cust_1')).toBe(true);
    expect(isFor(some, 'cust_9')).toBe(false);
    expect(sentTo(delivered, 'cust_1')).toBe(true);
    expect(sentTo(delivered, 'cust_9')).toBe(false);
  });

  it('names them, or says it went to everybody', () => {
    expect(audienceIds(delivered)).toEqual(['cust_1']);
    expect(audienceIds({ ...delivered, audience: { kind: 'all' } })).toBeNull();
  });

  it('shows a customer their own read mark and nobody else’s', () => {
    const read = { ...delivered, readBy: { cust_1: 'a', cust_2: 'b' } };
    expect(forCustomer(read, 'cust_1').readBy).toEqual({ cust_1: 'a' });
    expect(forCustomer(read, 'cust_9').readBy).toEqual({});
  });
});
