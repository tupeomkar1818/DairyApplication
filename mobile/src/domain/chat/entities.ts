import type { EntityBase, IsoDateString } from '@/src/domain/shared/types';

/** Who wrote a chat message: the customer, or the dairy from the admin app. */
export type ChatAuthor = 'customer' | 'admin';

/**
 * One message in the chat between a customer and the dairy. Each customer has a single conversation, so messages are
 * keyed by `customerId`.
 */
export interface ChatMessage extends EntityBase {
  customerId: string;
  from: ChatAuthor;
  text: string;
  /** The customer's name or "Amrale Dairy", as it was when sent. */
  senderName?: string;
  /** When the other side first saw it. */
  readAt?: IsoDateString;
}
