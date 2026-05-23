import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

type Props = TextInputProps & {
  label: string;
  labelRight?: ReactNode;
};

export function ProfileField({ label, labelRight, style, ...inputProps }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelRight}
      </View>
      <TextInput
        {...inputProps}
        style={[styles.input, style]}
        placeholderTextColor={amraleColors.textSubtle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    color: amraleColors.textMuted,
  },
  input: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 16,
    color: amraleColors.text,
    backgroundColor: amraleColors.inputBgLight,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
  },
});
