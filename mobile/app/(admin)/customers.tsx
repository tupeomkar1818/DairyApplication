import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { AdminListScreenLayout } from '@/src/components/admin/AdminListScreenLayout';
import { CustomerListSection } from '@/src/components/admin/CustomerListSection';

export default function AdminCustomersScreen() {
  const params = useLocalSearchParams<{ editId?: string }>();

  useEffect(() => {
    const id = (params.editId ?? '').trim();
    if (!id) return;
    router.replace({ pathname: '/(admin)/customers-edit', params: { id } });
  }, [params.editId]);

  return (
    <AdminListScreenLayout title="Customers">
      {({ bottomInset }) => <CustomerListSection bottomInset={bottomInset} />}
    </AdminListScreenLayout>
  );
}
