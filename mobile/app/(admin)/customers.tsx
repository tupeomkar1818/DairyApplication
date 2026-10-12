import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { AdminListScreenLayout } from '@/src/components/admin/AdminListScreenLayout';
import { CustomerListSection } from '@/src/components/admin/CustomerListSection';
import { useStrings } from '@/src/i18n/useStrings';

export default function AdminCustomersScreen() {
  const params = useLocalSearchParams<{ editId?: string }>();
  const t = useStrings('customers');

  useEffect(() => {
    const id = (params.editId ?? '').trim();
    if (!id) return;
    router.replace({ pathname: '/(admin)/customers-edit', params: { id } });
  }, [params.editId]);

  return (
    <AdminListScreenLayout title={t.list.title}>
      {({ bottomInset }) => <CustomerListSection bottomInset={bottomInset} />}
    </AdminListScreenLayout>
  );
}
