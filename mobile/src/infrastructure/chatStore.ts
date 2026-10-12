import type { ChatAuthor, ChatMessage } from '@/src/domain/chat/entities';
import { CHAT_STORE_KEY } from '@/src/infrastructure/storage/keys';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';

/**
 * Chat messages between customers and the dairy, in one list. Writes are serialized read-modify-write, so a customer
 * and the admin typing at the same moment never drop each other's message.
 */

/** Keeps on-device storage in check; the oldest messages go first. */
const MAX_MESSAGES = 2000;

function sanitize(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m): m is ChatMessage =>
      !!m &&
      typeof m === 'object' &&
      typeof (m as ChatMessage).id === 'string' &&
      typeof (m as ChatMessage).customerId === 'string' &&
      typeof (m as ChatMessage).text === 'string' &&
      ((m as ChatMessage).from === 'customer' || (m as ChatMessage).from === 'admin'),
  );
}

export async function loadChatMessages(): Promise<ChatMessage[]> {
  return sanitize(await readJson<unknown>(CHAT_STORE_KEY));
}

let queue: Promise<unknown> = Promise.resolve();

function update(updater: (current: ChatMessage[]) => ChatMessage[]): Promise<ChatMessage[]> {
  const run = queue
    .catch(() => undefined)
    .then(async () => {
      const next = updater(await loadChatMessages());
      const trimmed = next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
      await writeJson(CHAT_STORE_KEY, trimmed);
      return trimmed;
    });
  queue = run;
  return run;
}

export async function sendChatMessage(input: {
  customerId: string;
  from: ChatAuthor;
  text: string;
  senderName?: string;
}): Promise<ChatMessage> {
  const now = new Date().toISOString();
  const message: ChatMessage = {
    id: `msg_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`,
    customerId: input.customerId,
    from: input.from,
    text: input.text,
    senderName: input.senderName,
    createdAt: now,
    updatedAt: now,
  };
  await update((current) => [...current, message]);
  return message;
}

/** Marks the other side's messages in one conversation as seen by `reader`. */
export async function markChatRead(customerId: string, reader: ChatAuthor): Promise<void> {
  const now = new Date().toISOString();
  await update((current) =>
    current.map((m) =>
      m.customerId === customerId && m.from !== reader && !m.readAt ? { ...m, readAt: now, updatedAt: now } : m,
    ),
  );
}
