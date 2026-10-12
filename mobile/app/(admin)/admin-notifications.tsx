import { router } from 'expo-router';

import { NotificationsInbox } from '@/src/components/notifications/NotificationsInbox';
import { useStrings } from '@/src/i18n/useStrings';

/** What customers and delivery boys did that the dairy should know about. Tapping a row opens it in full. */
export default function AdminNotificationsScreen() {
  const t = useStrings('admin');
  return (
    <NotificationsInbox
      address={{ audience: 'Admin' }}
      emptyText={t.notifications.emptyText}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(admin)'))}
      onOpen={(n) => router.push({ pathname: '/(admin)/admin-notification-detail', params: { id: n.id } })}
    />
  );
}
