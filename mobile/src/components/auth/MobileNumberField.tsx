import { StyleSheet, Text, TextInput, View } from 'react-native';

import { normalizeMobileNumberInput } from '@/src/domain/shared/numerals';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { formFieldAttrs } from '@/src/theme/platformStyles';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string | null;
  variant?: 'dark' | 'light';
  showLabel?: boolean;
};

export function MobileNumberField({
  value,
  onChangeText,
  onBlur,
  error,
  variant = 'dark',
  showLabel = false,
}: Props) {
  const isLight = variant === 'light';

  return (
    <View style={styles.wrap}>
      {showLabel ? <Text style={[styles.label, isLight ? styles.labelLight : styles.labelDark]}>Mobile Number</Text> : null}
      <View
        style={[
          styles.row,
          isLight ? styles.rowLight : styles.rowDark,
          error ? styles.rowError : null,
        ]}
      >
        <View style={[styles.country, isLight ? styles.countryLight : styles.countryDark]}>
          <Text style={[styles.countryText, isLight ? styles.textLight : styles.textDark]}>🇮🇳 +91</Text>
        </View>
        <TextInput
          {...formFieldAttrs('login-mobile', { autoComplete: 'tel' })}
          style={[styles.input, isLight ? styles.inputLight : styles.inputDark]}
          placeholder={isLight ? 'Enter mobile number' : 'Mobile number'}
          placeholderTextColor={isLight ? amraleColors.textSubtle : amraleColors.whiteSubtle}
          keyboardType="number-pad"
          value={value}
          onChangeText={(text) => onChangeText(normalizeMobileNumberInput(text))}
          onBlur={onBlur}
          maxLength={10}
          accessibilityLabel="Mobile number"
        />
      </View>
      {error ? <Text style={[styles.errorText, isLight ? styles.errorLight : styles.errorDark]}>{error}</Text> : null}
    </View>
  );
}

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
    borderWidth: 1,
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
  rowError: {
    borderColor: amraleColors.error,
  },
  country: {
    paddingHorizontal: amraleSpacing.md,
    paddingVertical: 14,
    borderRightWidth: 1,
  },
  countryLight: { borderRightColor: amraleColors.inputBorderLight },
  countryDark: { borderRightColor: amraleColors.inputBorder },
  countryText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
  },
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
  inputLight: { color: amraleColors.text },
  inputDark: { color: amraleColors.white },
  errorText: {
    marginTop: amraleSpacing.sm,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
  },
  errorLight: { color: amraleColors.error },
  errorDark: { color: amraleColors.errorOnDark },
});
