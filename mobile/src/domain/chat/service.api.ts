import type { ChatAuthor, ChatMessage } from '@/src/domain/chat/entities';
import type { IChatService } from '@/src/domain/chat/service.interface';
import { api } from '@/src/infrastructure/api/client';

/**
 * The chat from the dairy's server: a message typed on either side is there for the other as soon as it is sent.
 *
 * The server knows who is asking, so a customer's message goes to their own conversation whatever the phone sends.
 */
export class ChatServiceApi implements IChatService {
  async list(): Promise<ChatMessage[]> {
    const answer = await api.get<{ items: ChatMessage[] }>('/chat');
    return answer.items ?? [];
  }

  async send(input: { customerId: string; from: ChatAuthor; text: string; senderName?: string }): Promise<ChatMessage> {
    return api.post<ChatMessage>('/chat', { customerId: input.customerId, text: input.text, senderName: input.senderName });
  }

  async markRead(customerId: string): Promise<void> {
    await api.post<unknown>('/chat/read', { customerId });
  }
}
