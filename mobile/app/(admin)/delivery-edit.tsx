import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Text } from 'react-native-paper';

import {
  buildUpdatePayloadFromSimpleForm,
  COLORS,
  ddmmyyyyToIso,
  DeliveryBoyBasicFormFields,
  simpleFormFromDeliveryBoy,
  validateSimpleDeliveryBoyForm,
  type SimpleDeliveryBoyForm,
} from '@/src/components/admin/DeliveryBoyBasicForm';
import { DeliveryBoyFormScreenLayout } from '@/src/components/admin/DeliveryBoyFormScreenLayout';
import { UpdateDeliveryBoyRequestSchema } from '@/src/domain/deliveryBoys/validations';
import { useDeliveryBoy, useUpdateDeliveryBoy } from '@/src/hooks/deliveryBoys';

export default function AdminEditDeliveryBoyScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ?? '';

  const boyQuery = useDeliveryBoy(id);
  const update = useUpdateDeliveryBoy();

  const [form, setForm] = useState<SimpleDeliveryBoyForm>(() => ({
    fullName: '',
    mobileNumber: '',
    primaryRouteName: '',
    joiningDate: '',
    monthlySalary: '',
    perDaySalary: '',
    salaryType: 'Fixed Monthly Salary',
    status: 'Active',
  }));
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!boyQuery.data) return;
    setForm(simpleFormFromDeliveryBoy(boyQuery.data));
    setTouched(false);
    setFormError(null);
  }, [boyQuery.data]);

  const fieldErrors = useMemo(() => (touched ? validateSimpleDeliveryBoyForm(form) : {}), [form, touched]);

  async function onSave() {
    setTouched(true);
    setFormError(null);
    const errs = validateSimpleDeliveryBoyForm(form);
    if (Object.keys(errs).length > 0) {
      setFormError('Please fix the highlighted fields.');
      return;
    }
    const joiningIso = ddmmyyyyToIso(form.joiningDate.trim());
    if (!joiningIso) return;
    const payload = buildUpdatePayloadFromSimpleForm(form, joiningIso);
    const parsed = UpdateDeliveryBoyRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Please check the form.');
      return;
    }
    try {
      await update.mutateAsync({ id, data: parsed.data });
      router.back();
    } catch {
      setFormError('Unable to update delivery boy. Please try again.');
    }
  }

  function onCancel() {
    router.back();
  }

  const textMain = isDark ? styles.textOnDark : styles.textOnLight;

  if (!id) {
    return (
      <View style={[styles.fallback, isDark ? styles.pageDark : styles.pageLight, styles.centered]}>
        <Text variant="bodyLarge" style={textMain}>
          Missing delivery boy id.
        </Text>
        <Button mode="contained" onPress={onCancel} buttonColor={COLORS.primary}>
          Go back
        </Button>
      </View>
    );
  }

  if (boyQuery.isError) {
    return (
      <View style={[styles.fallback, isDark ? styles.pageDark : styles.pageLight, styles.centered]}>
        <Text variant="bodyLarge" style={textMain}>
          Could not load this delivery boy.
        </Text>
        <Button mode="contained" onPress={onCancel} buttonColor={COLORS.primary}>
          Go back
        </Button>
      </View>
    );
  }

  if (boyQuery.isLoading || !boyQuery.data) {
    return (
      <View style={[styles.fallback, isDark ? styles.pageDark : styles.pageLight, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text variant="bodyMedium" style={[textMain, { marginTop: 16 }]}>
          Loading…
        </Text>
      </View>
    );
  }

  return (
    <DeliveryBoyFormScreenLayout
      title="Edit Delivery Boy"
      subtitle="Update delivery details"
      onBack={onCancel}
      formError={formError}
      footer={({ isMobile }) => (
        <View style={[styles.footerInner, isMobile && styles.footerMobile]}>
          <Button
            mode="outlined"
            onPress={onCancel}
            disabled={update.isPending}
            style={[styles.btn, isMobile && styles.btnFull, styles.btnCancel]}
            contentStyle={styles.btnContent}
            labelStyle={styles.btnLabel}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={onSave}
            loading={update.isPending}
            disabled={update.isPending}
            style={[styles.btn, isMobile && styles.btnFull, styles.btnSave]}
            contentStyle={styles.btnContent}
            labelStyle={styles.btnSaveLabel}
            buttonColor={COLORS.primary}
          >
            Save
          </Button>
        </View>
      )}
    >
      <DeliveryBoyBasicFormFields form={form} setForm={setForm} fieldErrors={fieldErrors} scheme={scheme} />
    </DeliveryBoyFormScreenLayout>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1 },
  pageLight: { backgroundColor: '#E8EDF4' },
  pageDark: { backgroundColor: '#070B14' },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  textOnLight: { color: COLORS.text },
  textOnDark: { color: 'rgba(248,250,252,0.96)' },
  footerInner: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, width: '100%' },
  footerMobile: { flexDirection: 'column', maxWidth: '100%' },
  btn: { borderRadius: 12, minWidth: 120 },
  btnFull: { width: '100%', minWidth: '100%' },
  btnContent: { paddingVertical: 8, paddingHorizontal: 6 },
  btnLabel: { fontWeight: '600', fontSize: 15 },
  btnCancel: { borderColor: 'rgba(37,99,235,0.4)' },
  btnSave: { elevation: 1 },
  btnSaveLabel: { fontWeight: '600', fontSize: 15 },
});
