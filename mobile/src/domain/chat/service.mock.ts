import type { ChatAuthor, ChatMessage } from '@/src/domain/chat/entities';
import type { IChatService } from '@/src/domain/chat/service.interface';
import { loadChatMessages, markChatRead, sendChatMessage } from '@/src/infrastructure/chatStore';

/** The chat kept on this phone, in one list the customer and admin apps share. */
export class ChatServiceMock implements IChatService {
  async list(): Promise<ChatMessage[]> {
    return loadChatMessages();
  }

  async send(input: { customerId: string; from: ChatAuthor; text: string; senderName?: string }): Promise<ChatMessage> {
    return sendChatMessage(input);
  }

  async markRead(customerId: string, reader: ChatAuthor): Promise<void> {
    await markChatRead(customerId, reader);
  }
}
