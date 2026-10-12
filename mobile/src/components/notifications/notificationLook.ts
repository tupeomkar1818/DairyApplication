import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import type { NotificationType } from '@/src/domain/notifications/entities';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export type NotificationCategory =
  | 'Order'
  | 'Delivery'
  | 'Day change'
  | 'Subscription'
  | 'Bill'
  | 'Payment'
  | 'Support'
  | 'Announcement'
  | 'Chat'
  | 'Update'
  | 'Offer';

export type NotificationLook = {
  icon: IconName;
  /** What kind of update it is. A key: the words on the chip are `notificationCategories[category]` in the `inbox` dictionary. */
  category: NotificationCategory;
  /** Accent for the icon and category chip. */
  fg: string;
  bg: string;
};

const BLUE = { fg: '#0b4fae', bg: '#e3efff' };
const GREEN = { fg: '#16623a', bg: '#dcf3e5' };
const RED = { fg: '#9f1d1d', bg: '#fde2e1' };
const AMBER = { fg: '#8a4b00', bg: '#fff0d6' };
const GREY = { fg: '#4d5b6b', bg: '#eef1f5' };
const PURPLE = { fg: '#6b3fa0', bg: '#efe6fb' };

const LOOKS: Partial<Record<NotificationType, NotificationLook>> = {
  OrderPlaced: { icon: 'basket-plus-outline', category: 'Order', ...BLUE },
  OrderReminder: { icon: 'bell-ring-outline', category: 'Order', ...AMBER },
  OrderCancelled: { icon: 'basket-remove-outline', category: 'Order', ...GREY },
  AdditionalProductAdded: { icon: 'basket-plus-outline', category: 'Order', ...BLUE },
  DaySkipped: { icon: 'calendar-remove-outline', category: 'Day change', ...GREY },
  QuantityChanged: { icon: 'numeric', category: 'Day change', ...BLUE },
  DeliveryCompleted: { icon: 'check-circle-outline', category: 'Delivery', ...GREEN },
  DeliveryNotCompleted: { icon: 'alert-circle-outline', category: 'Delivery', ...RED },
  SubscriptionStarted: { icon: 'calendar-sync-outline', category: 'Subscription', ...GREEN },
  SubscriptionResumed: { icon: 'play-circle-outline', category: 'Subscription', ...GREEN },
  SubscriptionPaused: { icon: 'pause-circle-outline', category: 'Subscription', ...GREY },
  SubscriptionExpired: { icon: 'calendar-end', category: 'Subscription', ...AMBER },
  SubscriptionExpiringIn3Days: { icon: 'calendar-clock', category: 'Subscription', ...AMBER },
  MonthlyBillGenerated: { icon: 'receipt-text-outline', category: 'Bill', ...BLUE },
  PaymentPending: { icon: 'cash-clock', category: 'Payment', ...RED },
  PaymentReceived: { icon: 'cash-check', category: 'Payment', ...GREEN },
  Announcement: { icon: 'bullhorn-outline', category: 'Announcement', ...AMBER },
  ChatMessage: { icon: 'chat-processing-outline', category: 'Chat', ...BLUE },
  ComplaintRaised: { icon: 'lifebuoy', category: 'Support', ...PURPLE },
  ComplaintAnswered: { icon: 'message-reply-text-outline', category: 'Support', ...PURPLE },
  Offer: { icon: 'tag-heart-outline', category: 'Offer', fg: '#a3246b', bg: '#fbe3f0' },
};

/** How a notification is shown in every inbox: its icon, what kind of update it is, and its colour. */
export function notificationLook(type: NotificationType): NotificationLook {
  return LOOKS[type] ?? { icon: 'bell-outline', category: 'Update', ...BLUE };
}
