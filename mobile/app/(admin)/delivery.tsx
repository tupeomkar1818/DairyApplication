import { AdminListScreenLayout } from '@/src/components/admin/AdminListScreenLayout';
import { DeliveryBoysManagementSection } from '@/src/components/admin/DeliveryBoysManagementSection';
import { useStrings } from '@/src/i18n/useStrings';

export default function AdminDeliveryScreen() {
  const t = useStrings('deliveryBoys');
  return (
    <AdminListScreenLayout title={t.list.title}>
      {({ bottomInset }) => <DeliveryBoysManagementSection bottomInset={bottomInset} />}
    </AdminListScreenLayout>
  );
}
