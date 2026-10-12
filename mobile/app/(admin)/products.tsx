import { router } from 'expo-router';

import { AdminListScreenLayout } from '@/src/components/admin/AdminListScreenLayout';
import { ProductListSection } from '@/src/components/admin/ProductListSection';
import { useStrings } from '@/src/i18n/useStrings';

export default function AdminProductsScreen() {
  const t = useStrings('products');
  return (
    <AdminListScreenLayout title={t.list.title}>
      {({ bottomInset }) => <ProductListSection bottomInset={bottomInset} />}
    </AdminListScreenLayout>
  );
}
