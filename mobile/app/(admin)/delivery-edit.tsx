import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { DeliveryBoyFormScreen, type DeliveryBoyFormSection } from '@/src/components/admin/DeliveryBoyFormScreen';
import {
  buildUpdatePayloadFromSimpleForm,
  ddmmyyyyToIso,
  simpleFormFromDeliveryBoy,
  type SimpleDeliveryBoyForm,
} from '@/src/components/admin/deliveryBoyFormShared';
import { UpdateDeliveryBoyRequestSchema } from '@/src/domain/deliveryBoys/validations';
import { useDeliveryBoy, useUpdateDeliveryBoy } from '@/src/hooks/deliveryBoys';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

/** Back to the Delivery Boys list when this screen was opened directly (no history to pop). */
function goBackToList() {
  if (router.canGoBack()) router.back();
  else router.replace('/(admin)/delivery');
}

export default function AdminEditDeliveryBoyScreen() {
  const t = useStrings('deliveryBoys');
  const c = useStrings('common');
  const params = useLocalSearchParams<{ id?: string; section?: string }>();
  const id = params.id ?? '';
  // The Details screen's per-section Edit links open the form at that section.
  const initialSection: DeliveryBoyFormSection | undefined =
    params.section === 'salary' || params.section === 'basic' ? params.section : undefined;

  const boyQuery = useDeliveryBoy(id);
  const update = useUpdateDeliveryBoy();

  const boy = boyQuery.data ?? null;
  const initialForm = useMemo(() => (boy ? simpleFormFromDeliveryBoy(boy) : null), [boy?.id, boy?.updatedAt]);

  async function onSave(form: SimpleDeliveryBoyForm) {
    const joiningIso = ddmmyyyyToIso(form.joiningDate.trim());
    if (!joiningIso) throw new Error(t.errors.joiningDateInvalidFull);
    const parsed = UpdateDeliveryBoyRequestSchema.safeParse(buildUpdatePayloadFromSimpleForm(form, joiningIso));
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? t.errors.checkForm);
    }
    await update.mutateAsync({ id, data: parsed.data });
    goBackToList();
  }

  if (!id || boyQuery.isError || (!boy && !boyQuery.isLoading)) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{boyQuery.isError ? t.edit.loadErrorTitle : t.edit.notFoundTitle}</Text>
        <Text style={styles.body}>{boyQuery.isError ? t.edit.loadErrorBody : t.edit.notFoundBody}</Text>
        <View style={styles.actions}>
          {boyQuery.isError ? (
            <Pressable onPress={() => void boyQuery.refetch()} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
              <Text style={styles.btnText}>{t.edit.retry}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={goBackToList}
            style={({ pressed }) => [styles.btn, styles.btnOutline, pressed && styles.pressed]}
          >
            <Text style={[styles.btnText, styles.btnOutlineText]}>{c.actions.back}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!boy || !initialForm) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={amraleColors.blue} size="large" />
      </View>
    );
  }

  return (
    <DeliveryBoyFormScreen
      key={boy.id}
      title={t.form.editTitle}
      saveLabel={t.form.editSave}
      initialForm={initialForm}
      initialSection={initialSection}
      isPending={update.isPending}
      onSave={onSave}
      onCancel={goBackToList}
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
