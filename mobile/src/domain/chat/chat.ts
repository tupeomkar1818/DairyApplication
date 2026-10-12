import type { ChatAuthor, ChatMessage } from '@/src/domain/chat/entities';
import type { Lang } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';

/** The rules of the customer ↔ dairy chat, shared by both apps. */

export const MAX_CHAT_MESSAGE_LENGTH = 1000;

/** A message ready to send, or why it can't be. */
export function cleanChatText(text: string): { ok: true; text: string } | { ok: false; message: string } {
  const trimmed = String(text ?? '').replace(/\s+$/g, '').replace(/^\s+/g, '');
  if (!trimmed) return { ok: false, message: strings('inbox').chat.emptyMessage };
  if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) {
    return { ok: false, message: strings('inbox').chat.tooLong(MAX_CHAT_MESSAGE_LENGTH) };
  }
  return { ok: true, text: trimmed };
}

/** One customer's conversation, oldest first (how a chat reads). */
export function conversationFor(all: readonly ChatMessage[], customerId: string): ChatMessage[] {
  return all
    .filter((m) => m.customerId === customerId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

/** Messages the `reader` has not seen yet: the other side's, without a read mark. */
export function unreadFor(messages: readonly ChatMessage[], reader: ChatAuthor): ChatMessage[] {
  return messages.filter((m) => m.from !== reader && !m.readAt);
}

export type ConversationSummary = {
  customerId: string;
  last: ChatMessage;
  /** Customer messages the dairy has not read. */
  unreadForAdmin: number;
  count: number;
};

/** Every conversation for the admin's list: the most recent first, each with its last message and unread count. */
export function conversationSummaries(all: readonly ChatMessage[]): ConversationSummary[] {
  const byCustomer = new Map<string, ChatMessage[]>();
  for (const m of all) {
    const list = byCustomer.get(m.customerId) ?? [];
    list.push(m);
    byCustomer.set(m.customerId, list);
  }
  return Array.from(byCustomer.entries())
    .map(([customerId, list]) => {
      const sorted = [...list].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      return {
        customerId,
        last: sorted[sorted.length - 1]!,
        unreadForAdmin: unreadFor(sorted, 'admin').length,
        count: sorted.length,
      };
    })
    .sort((a, b) => String(b.last.createdAt).localeCompare(String(a.last.createdAt)));
}

/** The chat split into days, for "Today" / "Yesterday" / date separators. */
export function groupByDay(messages: readonly ChatMessage[]): { dayYmd: string; messages: ChatMessage[] }[] {
  const groups: { dayYmd: string; messages: ChatMessage[] }[] = [];
  for (const m of messages) {
    const d = new Date(m.createdAt);
    const ymd = Number.isNaN(d.getTime())
      ? String(m.createdAt).slice(0, 10)
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const last = groups[groups.length - 1];
    if (last && last.dayYmd === ymd) last.messages.push(m);
    else groups.push({ dayYmd: ymd, messages: [m] });
  }
  return groups;
}

/** Topics a customer can start a chat with in one tap: keys of `chat.starters` in the `inbox` dictionary. */
export const CHAT_STARTER_KEYS = ['delivery', 'bill', 'subscription', 'quality'] as const;

/** The one-tap first messages, in the app's language (read when shown). */
export function chatStarters(lang?: Lang): string[] {
  const starters = strings('inbox', lang).chat.starters;
  return CHAT_STARTER_KEYS.map((key) => starters[key]);
}
