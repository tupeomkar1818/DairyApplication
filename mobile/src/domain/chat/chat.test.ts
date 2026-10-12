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

import { cleanChatText, conversationFor, conversationSummaries, groupByDay, unreadFor } from '@/src/domain/chat/chat';
import type { ChatMessage } from '@/src/domain/chat/entities';
import { notifyChatMessage } from '@/src/domain/notifications/events';
import { loadChatMessages, markChatRead, sendChatMessage } from '@/src/infrastructure/chatStore';
import { loadNotifications, notificationsFor } from '@/src/infrastructure/notificationsStore';

function msg(id: string, customerId: string, from: 'customer' | 'admin', createdAt: string, readAt?: string): ChatMessage {
  return { id, customerId, from, text: id, createdAt, updatedAt: createdAt, readAt };
}

describe('chat rules', () => {
  const all = [
    msg('a1', 'asha', 'customer', '2026-09-15T09:00:00.000Z', '2026-09-15T10:00:00.000Z'),
    msg('r1', 'ravi', 'customer', '2026-09-16T08:00:00.000Z'),
    msg('a2', 'asha', 'admin', '2026-09-15T10:05:00.000Z'),
    msg('a3', 'asha', 'customer', '2026-09-16T07:00:00.000Z'),
    msg('r2', 'ravi', 'customer', '2026-09-16T08:01:00.000Z'),
  ];

  it('reads one conversation oldest first', () => {
    expect(conversationFor(all, 'asha').map((m) => m.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('counts what each side has not seen', () => {
    const asha = conversationFor(all, 'asha');
    expect(unreadFor(asha, 'admin').map((m) => m.id)).toEqual(['a3']);
    expect(unreadFor(asha, 'customer').map((m) => m.id)).toEqual(['a2']);
  });

  it('lists conversations for the admin, most recent first, with unread counts', () => {
    expect(conversationSummaries(all).map((s) => [s.customerId, s.last.id, s.unreadForAdmin, s.count])).toEqual([
      ['ravi', 'r2', 2, 2],
      ['asha', 'a3', 1, 3],
    ]);
  });

  it('splits a conversation into days', () => {
    const days = groupByDay([
      msg('x', 'asha', 'customer', new Date(2026, 8, 15, 9).toISOString()),
      msg('y', 'asha', 'admin', new Date(2026, 8, 15, 18).toISOString()),
      msg('z', 'asha', 'customer', new Date(2026, 8, 16, 7).toISOString()),
    ]);
    expect(days.map((d) => [d.dayYmd, d.messages.map((m) => m.id)])).toEqual([
      ['2026-09-15', ['x', 'y']],
      ['2026-09-16', ['z']],
    ]);
  });

  it('refuses empty or overlong messages and trims the rest', () => {
    expect(cleanChatText('   ')).toMatchObject({ ok: false });
    expect(cleanChatText('x'.repeat(1001))).toMatchObject({ ok: false });
    expect(cleanChatText('  Hello  \n')).toEqual({ ok: true, text: 'Hello' });
  });
});

describe('chat store and notifications', () => {
  beforeEach(() => memory.clear());

  const settle = async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  };

  it('keeps both sides of a conversation and marks only the other side read', async () => {
    await sendChatMessage({ customerId: 'asha', from: 'customer', text: 'Hi' });
    await sendChatMessage({ customerId: 'asha', from: 'admin', text: 'Hello Asha' });
    await markChatRead('asha', 'admin');

    const [fromCustomer, fromAdmin] = conversationFor(await loadChatMessages(), 'asha');
    expect(fromCustomer!.readAt).toBeTruthy();
    expect(fromAdmin!.readAt).toBeUndefined();
  });

  it('gives the other side one notification per conversation, showing the latest message', async () => {
    notifyChatMessage({ customerId: 'asha', customerName: 'Asha', from: 'customer', text: 'Milk was late' });
    await settle();
    notifyChatMessage({ customerId: 'asha', customerName: 'Asha', from: 'customer', text: 'Please call me' });
    await settle();
    notifyChatMessage({ customerId: 'asha', customerName: 'Asha', from: 'admin', text: 'Calling you now' });
    await settle();

    const all = await loadNotifications();
    expect(notificationsFor(all, { audience: 'Admin' }).map((n) => [n.title, n.body])).toEqual([
      ['Message from Asha', 'Please call me'],
    ]);
    expect(notificationsFor(all, { audience: 'Customer', customerId: 'asha' }).map((n) => [n.title, n.body])).toEqual([
      ['Message from Amrale Dairy', 'Calling you now'],
    ]);
  });
});
