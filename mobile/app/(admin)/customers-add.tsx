import { router } from 'expo-router';
import { useMemo } from 'react';

import type { AdminProductLite } from '@/src/components/admin/buildSubscriptionPayloadFromPlans';
import { CustomerFormScreen } from '@/src/components/admin/CustomerFormScreen';
import { emptyCustomerForm, validateCustomerForm, type CustomerFormState } from '@/src/components/admin/customerFormShared';
import { useCreateCustomer } from '@/src/hooks/customers';
import { useProducts } from '@/src/hooks/products';

export default function AdminAddCustomerScreen() {
  const create = useCreateCustomer();
  const products = useProducts();
  const initialForm = useMemo(() => emptyCustomerForm(), []);

  const adminProducts = useMemo(() => {
    const items = products.data?.items ?? [];
    return items.filter((p) => p.isActive) as AdminProductLite[];
  }, [products.data?.items]);

  async function onSave(form: CustomerFormState) {
    const parsed = validateCustomerForm(form, adminProducts);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? 'Please check the form');
    }
    const created = await create.mutateAsync(parsed.data);
    router.replace({ pathname: '/(admin)/customers-detail', params: { id: created.id } });
  }

  return (
    <CustomerFormScreen
      title="Add Customer"
      saveLabel="Save Customer"
      initialForm={initialForm}
      isPending={create.isPending}
      onSave={onSave}
      onCancel={() => router.back()}
    />
  );
}
