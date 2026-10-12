import type { ChatAuthor, ChatMessage } from '@/src/domain/chat/entities';

/**
 * The chat between customers and the dairy, wherever it is kept.
 *
 * Each customer has one conversation. The dairy reads them all; a customer only their own — and writes only to
 * their own, whatever the phone asks for.
 */
export interface IChatService {
  /** GET /chat — every conversation for the dairy, their own for a customer. */
  list(): Promise<ChatMessage[]>;

  /** POST /chat */
  send(input: { customerId: string; from: ChatAuthor; text: string; senderName?: string }): Promise<ChatMessage>;

  /** POST /chat/read — the reader opened the conversation, so the other side's messages in it are seen. */
  markRead(customerId: string, reader: ChatAuthor): Promise<void>;
}
