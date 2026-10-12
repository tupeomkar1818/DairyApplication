import { router, useLocalSearchParams } from 'expo-router';

import { NotificationDetail, type NotificationAction } from '@/src/components/notifications/NotificationDetail';
import type { AppNotification } from '@/src/domain/notifications/entities';
import { strings } from '@/src/i18n/strings';
import { useLanguage } from '@/src/i18n/useStrings';

const ADMIN_INBOX = { audience: 'Admin' } as const;

/** From a notification the admin can open the customer it is about, and that day's delivery list. */
function adminActions(n: AppNotification): NotificationAction[] {
  const actions: NotificationAction[] = [];
  const t = strings('admin').notifications.actions;
  if (n.type === 'ChatMessage' && n.customerId) {
    const chatCustomerId = n.customerId;
    actions.push({
      label: t.openChat,
      icon: 'chat-processing-outline',
      onPress: () => router.push({ pathname: '/(admin)/admin-chat', params: { customerId: chatCustomerId } }),
    });
  }
  if (String(n.subjectKey ?? '').startsWith('payreq:')) {
    actions.push({
      label: t.reviewPayments,
      icon: 'cash-check',
      onPress: () => router.push('/(admin)/payment-requests' as never),
    });
  }
  if (n.customerId) {
    const customerId = n.customerId;
    actions.push({
      label: t.openCustomer,
      icon: 'account-outline',
      onPress: () => router.push({ pathname: '/(admin)/customers-detail', params: { id: customerId } }),
    });
  }
  if (n.dateYmd) {
    const date = n.dateYmd;
    actions.push({
      label: t.dayDeliveries,
      icon: 'truck-delivery-outline',
      onPress: () => router.push({ pathname: '/(admin)/today', params: { date } }),
    });
  }
  return actions;
}

export default function AdminNotificationDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  // Re-render on a language change so the action labels (read in adminActions) follow it.
  useLanguage();
  return (
    <NotificationDetail
      id={id}
      address={ADMIN_INBOX}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/admin-notifications'))}
      actionsFor={adminActions}
    />
  );
}
