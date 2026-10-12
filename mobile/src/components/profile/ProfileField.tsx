import type { ReactNode } from 'react';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { amraleColors, amraleRadius, amraleTypography, dairyTactileColors } from '@/src/theme/dairyTactile';

type Props = TextInputProps & {
  label: string;
  labelRight?: ReactNode;
};

export function ProfileField({ label, labelRight, style, onFocus, onBlur, ...inputProps }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelRight}
      </View>
      <TextInput
        {...inputProps}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, focused && styles.inputFocused, style]}
        placeholderTextColor={amraleColors.textSubtle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 13,
    color: amraleColors.textMuted,
  },
  input: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 15,
    color: amraleColors.text,
    // Same fill and border as the phone-number fields beside it.
    backgroundColor: amraleColors.inputBgLight,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  inputFocused: {
    borderColor: amraleColors.blue,
    borderWidth: 1.5,
    // The blue border is the focus ring; without this the browser draws its own on top.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
});
