import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import type { AdminProductLite } from '@/src/components/admin/buildSubscriptionPayloadFromPlans';
import { CustomerFormScreen } from '@/src/components/admin/CustomerFormScreen';
import {
  customerFormFromResponse,
  validateCustomerForm,
  type CustomerFormState,
} from '@/src/components/admin/customerFormShared';
import { useCustomers, useUpdateCustomer } from '@/src/hooks/customers';
import { useProducts } from '@/src/hooks/products';
import { amraleColors } from '@/src/theme/dairyTactile';

export default function AdminEditCustomerScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ?? '';
  const customers = useCustomers();
  const update = useUpdateCustomer();
  const products = useProducts();

  const customer = useMemo(() => {
    const items = customers.data?.items ?? [];
    return items.find((c) => c.id === id) ?? null;
  }, [customers.data?.items, id]);

  const initialForm = useMemo(() => (customer ? customerFormFromResponse(customer) : null), [customer?.id]);

  const adminProducts = useMemo(() => {
    const items = products.data?.items ?? [];
    return items.filter((p) => p.isActive) as AdminProductLite[];
  }, [products.data?.items]);

  async function onSave(form: CustomerFormState) {
    if (!customer) return;
    const parsed = validateCustomerForm(form, adminProducts);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? 'Please check the form');
    }
    const updated = await update.mutateAsync({ id: customer.id, data: parsed.data });
    router.replace({ pathname: '/(admin)/customers-detail', params: { id: updated.id } });
  }

  if (!customer || !initialForm) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={amraleColors.blue} size="large" />
      </View>
    );
  }

  return (
    <CustomerFormScreen
      key={customer.id}
      title="Update Customer"
      saveLabel="Save Customer"
      initialForm={initialForm}
      isPending={update.isPending}
      onSave={onSave}
      onCancel={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: amraleColors.surface },
});
