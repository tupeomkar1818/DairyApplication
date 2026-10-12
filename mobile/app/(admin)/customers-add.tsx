import { router } from 'expo-router';
import { useMemo } from 'react';

import type { AdminProductLite } from '@/src/components/admin/buildSubscriptionPayloadFromPlans';
import { CustomerFormScreen } from '@/src/components/admin/CustomerFormScreen';
import { emptyCustomerForm, validateCustomerForm, type CustomerFormState } from '@/src/components/admin/customerFormShared';
import { useCreateCustomer } from '@/src/hooks/customers';
import { useProducts } from '@/src/hooks/products';
import { strings } from '@/src/i18n/strings';
import { useStrings } from '@/src/i18n/useStrings';

export default function AdminAddCustomerScreen() {
  const t = useStrings('customers');
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
      throw new Error(parsed.error.issues[0]?.message ?? strings('customers').form.checkForm);
    }
    const created = await create.mutateAsync(parsed.data);
    router.replace({ pathname: '/(admin)/customers-detail', params: { id: created.id } });
  }

  return (
    <CustomerFormScreen
      title={t.form.addTitle}
      saveLabel={t.form.addSave}
      initialForm={initialForm}
      isPending={create.isPending}
      onSave={onSave}
      onCancel={() => router.back()}
    />
  );
}
