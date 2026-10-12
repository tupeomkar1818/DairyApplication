import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CustomerFormScreen } from '@/src/components/admin/CustomerFormScreen';
import {
  customerFormFromResponse,
  validateCustomerEditForm,
  type CustomerFormState,
  type CustomerFormTab,
} from '@/src/components/admin/customerFormShared';
import { useCustomers, useUpdateCustomer } from '@/src/hooks/customers';
import { strings } from '@/src/i18n/strings';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

export default function AdminEditCustomerScreen() {
  const params = useLocalSearchParams<{ id?: string; from?: string; section?: string }>();
  const t = useStrings('customers');
  const id = params.id ?? '';
  const openedFromDetail = params.from === 'detail';
  // The details screen's per-section Edit links open the form at that section.
  const initialSection: CustomerFormTab | undefined =
    params.section === 'address' || params.section === 'billing' || params.section === 'basic' ? params.section : undefined;
  const customers = useCustomers();
  const update = useUpdateCustomer();

  const customer = useMemo(() => {
    const items = customers.data?.items ?? [];
    return items.find((c) => c.id === id) ?? null;
  }, [customers.data?.items, id]);

  const initialForm = useMemo(() => (customer ? customerFormFromResponse(customer) : null), [customer?.id]);

  async function onSave(form: CustomerFormState) {
    if (!customer) return;
    // Profile/address/billing only — the form has no plan controls, so subscription fields are never sent.
    const parsed = validateCustomerEditForm(form);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? strings('customers').form.checkForm);
    }
    const updated = await update.mutateAsync({ id: customer.id, data: parsed.data });
    // Opened from the detail screen: go back to it instead of stacking a second detail screen.
    if (openedFromDetail && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace({ pathname: '/(admin)/customers-detail', params: { id: updated.id } });
  }

  if (!customer || !initialForm) {
    const loading = !customers.isError && (customers.isLoading || !customers.data);
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={amraleColors.blue} size="large" />
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{customers.isError ? t.edit.couldNotLoad : t.edit.notFound}</Text>
        <Text style={styles.body}>
          {customers.isError
            ? t.edit.loadErrorBody
            : t.edit.deletedBody}
        </Text>
        <View style={styles.actions}>
          {customers.isError ? (
            <Pressable onPress={() => void customers.refetch()} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
              <Text style={styles.btnText}>{t.edit.retry}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/customers'))}
            style={({ pressed }) => [styles.btn, styles.btnOutline, pressed && styles.pressed]}
          >
            <Text style={[styles.btnText, styles.btnOutlineText]}>{t.edit.back}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <CustomerFormScreen
      key={customer.id}
      mode="edit"
      title={t.form.editTitle}
      saveLabel={t.form.editSave}
      initialForm={initialForm}
      initialSection={initialSection}
      isPending={update.isPending}
      onSave={onSave}
      onCancel={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: amraleSpacing.sm,
    padding: amraleSpacing.lg,
    backgroundColor: amraleColors.surface,
  },
  title: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.text, textAlign: 'center' },
  body: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: amraleSpacing.sm, marginTop: amraleSpacing.sm },
  btn: {
    minHeight: 44,
    paddingHorizontal: amraleSpacing.lg,
    borderRadius: amraleRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: amraleColors.blue,
  },
  btnText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.white },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: amraleColors.blue },
  btnOutlineText: { color: amraleColors.blue },
  pressed: { opacity: 0.88 },
});
