import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FieldError, FieldLabel, FormSection, formInputStyles, ToggleCard } from '@/src/components/shared/formFields';
import { AppSnackbar } from '@/src/components/shared/AppSnackbar';
import { ResponsiveContainer } from '@/src/components/shared/ResponsiveContainer';
import { ScreenHeader } from '@/src/components/shared/ScreenHeader';
import { isValidUpiId } from '@/src/domain/customers/paymentRequests';
import { useDashboardSettings, useUpdatePaymentSettings } from '@/src/hooks/adminDashboard';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

/** Where customers pay their bills: the dairy's UPI ID, and whether cash is accepted. */
export default function AdminPaymentSettingsScreen() {
  const t = useStrings('billing').settings;
  const tCommon = useStrings('common');
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const settings = useDashboardSettings();
  const save = useUpdatePaymentSettings();
  const current = settings.data?.settings.payment;

  const [upiId, setUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('Amrale Dairy');
  const [acceptCash, setAcceptCash] = useState(true);
  const [instructions, setInstructions] = useState('');
  const [touched, setTouched] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded || !settings.data) return;
    if (current) {
      setUpiId(current.upiId);
      setPayeeName(current.payeeName || 'Amrale Dairy');
      setAcceptCash(current.acceptCash);
      setInstructions(current.instructions ?? '');
    }
    setLoaded(true);
  }, [current, loaded, settings.data]);

  const upiError = upiId.trim() && !isValidUpiId(upiId) ? t.upiError : undefined;
  const nameError = upiId.trim() && !payeeName.trim() ? t.nameError : undefined;
  const nothingError = !upiId.trim() && !acceptCash ? t.nothingError : undefined;

  async function onSave() {
    setTouched(true);
    if (upiError || nameError) return;
    try {
      await save.mutateAsync({ upiId: upiId.trim(), payeeName: payeeName.trim(), acceptCash, instructions });
      setSnack(t.saved);
    } catch {
      setSnack(tCommon.errors.couldNotSave);
    }
  }

  const webInput = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t.title}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(admin)'))}
        paddingTop={headerPaddingTop}
      />
      {settings.isLoading ? (
        <ActivityIndicator color={amraleColors.blue} size="large" style={styles.loading} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: scrollPaddingBottom(amraleSpacing.xl) }} keyboardShouldPersistTaps="handled">
          <ResponsiveContainer variant="form" style={styles.body}>
            <Text style={styles.intro}>{t.intro}</Text>

            <FormSection title={t.upiSection} icon="cellphone-check">
              <View style={styles.field}>
                <FieldLabel>{t.upiIdLabel}</FieldLabel>
                <View style={[formInputStyles.inputRow, touched && upiError && formInputStyles.inputRowError]}>
                  <MaterialCommunityIcons name="at" size={20} color={amraleColors.blue} />
                  <TextInput
                    value={upiId}
                    onChangeText={(t) => setUpiId(t.replace(/\s/g, ''))}
                    placeholder="amraledairy@okhdfcbank"
                    placeholderTextColor={amraleColors.textSubtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    style={[formInputStyles.inputText, webInput]}
                    accessibilityLabel={t.upiIdLabel}
                  />
                </View>
                <FieldError message={touched ? upiError : undefined} />
                <Text style={styles.hint}>{t.upiHint}</Text>
              </View>
              <View style={styles.field}>
                <FieldLabel>{t.payeeLabel}</FieldLabel>
                <View style={[formInputStyles.inputRow, touched && nameError && formInputStyles.inputRowError]}>
                  <MaterialCommunityIcons name="storefront-outline" size={20} color={amraleColors.blue} />
                  <TextInput
                    value={payeeName}
                    onChangeText={(t) => setPayeeName(t.slice(0, 60))}
                    placeholder="Amrale Dairy"
                    placeholderTextColor={amraleColors.textSubtle}
                    style={[formInputStyles.inputText, webInput]}
                    accessibilityLabel={t.payeeLabel}
                  />
                </View>
                <FieldError message={touched ? nameError : undefined} />
              </View>
            </FormSection>

            <FormSection title={t.cashSection} icon="cash">
              <ToggleCard
                icon="cash-multiple"
                label={t.acceptCash}
                hint={t.acceptCashHint}
                value={acceptCash}
                onChange={setAcceptCash}
              />
            </FormSection>

            <FormSection title={t.noteSection} icon="text-box-outline">
              <View style={[formInputStyles.inputRow, formInputStyles.inputRowMultiline]}>
                <TextInput
                  value={instructions}
                  onChangeText={(t) => setInstructions(t.slice(0, 200))}
                  placeholder={t.notePlaceholder}
                  placeholderTextColor={amraleColors.textSubtle}
                  multiline
                  style={[formInputStyles.inputText, styles.multiline, webInput]}
                  accessibilityLabel={t.noteSection}
                />
              </View>
            </FormSection>

            {nothingError ? <Text style={styles.warn}>{nothingError}</Text> : null}

            <Pressable
              onPress={() => void onSave()}
              disabled={save.isPending}
              style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed, save.isPending && styles.disabled]}
              accessibilityRole="button"
            >
              {save.isPending ? <ActivityIndicator color={amraleColors.white} /> : <Text style={styles.saveText}>{t.save}</Text>}
            </Pressable>
          </ResponsiveContainer>
        </ScrollView>
      )}
      <AppSnackbar visible={!!snack} message={snack ?? ''} onDismiss={() => setSnack(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: amraleColors.surface },
  loading: { marginTop: 48 },
  body: { paddingHorizontal: amraleSpacing.md, paddingTop: amraleSpacing.md, gap: amraleSpacing.md },
  intro: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 20, color: amraleColors.textMuted },
  field: { gap: 8 },
  hint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  multiline: { height: 80, textAlignVertical: 'top' },
  warn: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: '#B45309' },
  saveBtn: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.blue,
  },
  saveText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.white },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.6 },
});
