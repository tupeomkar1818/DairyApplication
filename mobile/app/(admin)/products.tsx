import { router } from 'expo-router';

import { AdminListScreenLayout } from '@/src/components/admin/AdminListScreenLayout';
import { ProductListSection } from '@/src/components/admin/ProductListSection';

export default function AdminProductsScreen() {
  return (
    <AdminListScreenLayout title="Products">
      {({ bottomInset }) => <ProductListSection bottomInset={bottomInset} />}
    </AdminListScreenLayout>
  );
}
