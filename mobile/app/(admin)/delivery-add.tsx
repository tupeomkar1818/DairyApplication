import React, { useMemo, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from 'react-native-paper';

import {
  buildCreatePayloadFromSimpleForm,
  COLORS,
  ddmmyyyyToIso,
  DeliveryBoyBasicFormFields,
  emptySimpleDeliveryBoyForm,
  validateSimpleDeliveryBoyForm,
  type SimpleDeliveryBoyForm,
} from '@/src/components/admin/DeliveryBoyBasicForm';
import { DeliveryBoyFormScreenLayout } from '@/src/components/admin/DeliveryBoyFormScreenLayout';
import { CreateDeliveryBoyRequestSchema } from '@/src/domain/deliveryBoys/validations';
import { useCreateDeliveryBoy } from '@/src/hooks/deliveryBoys';

export default function AdminAddDeliveryBoyScreen() {
  const scheme = useColorScheme();
  const create = useCreateDeliveryBoy();

  const [form, setForm] = useState<SimpleDeliveryBoyForm>(() => emptySimpleDeliveryBoyForm());
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    const payload = buildCreatePayloadFromSimpleForm(form, joiningIso);
    const parsed = CreateDeliveryBoyRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Please check the form.');
      return;
    }
    try {
      await create.mutateAsync(parsed.data);
      router.back();
    } catch {
      setFormError('Unable to add delivery boy. Please try again.');
    }
  }

  function onCancel() {
    router.back();
  }

  return (
    <DeliveryBoyFormScreenLayout
      title="Add Delivery Boy"
      subtitle="Enter delivery boy details"
      onBack={onCancel}
      formError={formError}
      footer={({ isMobile }) => (
        <View style={[styles.footerInner, isMobile && styles.footerMobile]}>
          <Button
            mode="outlined"
            onPress={onCancel}
            disabled={create.isPending}
            style={[styles.btn, isMobile && styles.btnFull, styles.btnCancel]}
            contentStyle={styles.btnContent}
            labelStyle={styles.btnLabel}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={onSave}
            loading={create.isPending}
            disabled={create.isPending}
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
