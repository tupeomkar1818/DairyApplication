import { router } from 'expo-router';

import { CustomerNotLinked } from '@/src/components/customer/customerUi';
import { NotificationsInbox } from '@/src/components/notifications/NotificationsInbox';
import { useMyCustomer } from '@/src/hooks/customer/useMyCustomer';
import { useStrings } from '@/src/i18n/useStrings';

export default function CustomerNotificationsScreen() {
  const { customer, isLoading } = useMyCustomer();
  const t = useStrings('inbox').inbox;
  return (
    <NotificationsInbox
      address={customer ? { audience: 'Customer', customerId: customer.id } : null}
      isLoading={isLoading}
      notLinked={<CustomerNotLinked />}
      emptyText={t.customerEmpty}
      onOpen={(n) => router.push({ pathname: '/(customer)/notification-detail', params: { id: n.id } })}
    />
  );
}
