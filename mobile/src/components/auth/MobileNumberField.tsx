import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { normalizeMobileNumberInput } from '@/src/domain/shared/numerals';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { formFieldAttrs } from '@/src/theme/platformStyles';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string | null;
  variant?: 'dark' | 'light';
  showLabel?: boolean;
  /** Visible label (and accessibility label). Defaults to "Mobile Number". */
  label?: string;
  /** Unique form field id/name — must differ per field on a screen (duplicate DOM ids on web otherwise). */
  fieldName?: string;
  /** Use 'off' for numbers that are not the user's own (alternate / emergency contacts). */
  autoComplete?: TextInputProps['autoComplete'];
  /** Enter / the keyboard's Go key — e.g. send the OTP. */
  onSubmitEditing?: () => void;
  returnKeyType?: TextInputProps['returnKeyType'];
  autoFocus?: boolean;
  /** Larger text and a tick once all ten digits are in (the login screen). */
  prominent?: boolean;
};

export function MobileNumberField({
  value,
  onChangeText,
  onBlur,
  error,
  variant = 'dark',
  showLabel = false,
  label,
  fieldName = 'login-mobile',
  autoComplete = 'tel',
  onSubmitEditing,
  returnKeyType,
  autoFocus,
  prominent = false,
}: Props) {
  const t = useStrings('auth');
  const isLight = variant === 'light';
  const [focused, setFocused] = useState(false);
  const complete = /^\d{10}$/.test(value);

  return (
    <View style={styles.wrap}>
      {showLabel ? (
        <Text style={[styles.label, isLight ? styles.labelLight : styles.labelDark]}>{label ?? t.mobileField.label}</Text>
      ) : null}
      <View
        style={[
          styles.row,
          isLight ? styles.rowLight : styles.rowDark,
          focused && (isLight ? styles.rowFocusLight : styles.rowFocusDark),
          error ? styles.rowError : null,
        ]}
      >
        {/* A plain "+91": flag emoji render as the letters "IN" on Windows browsers. */}
        <View style={[styles.country, isLight ? styles.countryLight : styles.countryDark]}>
          <MaterialCommunityIcons name="phone-outline" size={16} color={isLight ? amraleColors.textMuted : amraleColors.whiteMuted} />
          <Text style={[styles.countryText, prominent && styles.textProminent, isLight ? styles.textLight : styles.textDark]}>+91</Text>
        </View>
        <TextInput
          {...formFieldAttrs(fieldName, { autoComplete })}
          style={[styles.input, prominent && styles.inputProminent, isLight ? styles.inputLight : styles.inputDark, webNoOutline]}
          placeholder={prominent ? t.mobileField.placeholderProminent : isLight ? t.mobileField.placeholderLight : t.mobileField.placeholderDark}
          placeholderTextColor={isLight ? amraleColors.textSubtle : amraleColors.whiteSubtle}
          keyboardType="number-pad"
          inputMode="numeric"
          value={value}
          onChangeText={(text) => onChangeText(normalizeMobileNumberInput(text))}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          autoFocus={autoFocus}
          maxLength={10}
          accessibilityLabel={label ?? t.mobileField.placeholderDark}
        />
        {prominent && complete && !error ? (
          <MaterialCommunityIcons name="check-circle" size={20} color="#15803D" style={styles.tick} accessibilityLabel={t.mobileField.complete} />
        ) : null}
      </View>
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <MaterialCommunityIcons name="alert-circle-outline" size={14} color={isLight ? amraleColors.error : amraleColors.errorOnDark} />
          <Text style={[styles.errorText, isLight ? styles.errorLight : styles.errorDark]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The browser's own focus ring doubles up with the field's border. */
const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginTop: amraleSpacing.md,
  },
  label: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 13,
    marginBottom: 8,
  },
  labelLight: { color: amraleColors.text },
  labelDark: { color: amraleColors.white },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: amraleRadius.lg,
    overflow: 'hidden',
  },
  rowLight: {
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.inputBgLight,
  },
  rowDark: {
    borderColor: amraleColors.inputBorder,
    backgroundColor: amraleColors.inputBg,
  },
  rowFocusLight: { borderColor: amraleColors.blue, backgroundColor: amraleColors.white },
  rowFocusDark: { borderColor: amraleColors.white },
  rowError: {
    borderColor: amraleColors.error,
  },
  country: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    alignSelf: 'stretch',
    borderRightWidth: 1,
  },
  countryLight: { borderRightColor: amraleColors.inputBorderLight },
  countryDark: { borderRightColor: amraleColors.inputBorder },
  countryText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
  },
  textProminent: { fontSize: 17 },
  textLight: { color: amraleColors.text },
  textDark: { color: amraleColors.white },
  input: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: amraleSpacing.md,
    paddingVertical: 14,
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  inputProminent: { fontSize: 18, letterSpacing: 0.6, paddingVertical: 16 },
  inputLight: { color: amraleColors.text },
  inputDark: { color: amraleColors.white },
  tick: { marginRight: 14 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: amraleSpacing.sm },
  errorText: {
    flex: 1,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
  },
  errorLight: { color: amraleColors.error },
  errorDark: { color: amraleColors.errorOnDark },
});
