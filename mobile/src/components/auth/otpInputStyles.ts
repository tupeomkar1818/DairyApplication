import { Platform, StyleSheet, type TextStyle } from 'react-native';

import { amraleColors, amraleTypography } from '@/src/theme/dairyTactile';

/** Vertical inset so a single digit sits in the middle of the cell (custom font metrics). */
function iosDigitPadding(boxSize: number, fontSize: number): { paddingTop: number; paddingBottom: number } {
  const pad = Math.max(0, Math.round((boxSize - fontSize) / 2));
  // Plus Jakarta Sans bold sits slightly low in RN TextInput on iOS — nudge up by 1px.
  return { paddingTop: Math.max(0, pad - 1), paddingBottom: pad + 1 };
}

/** Centers a single digit inside a square OTP cell (native + web). Parent cell must use otpCellStyle(). */
export function otpDigitInputStyle(boxSize: number, fontSize: number): TextStyle {
  const base: TextStyle = {
    width: '100%',
    height: '100%',
    fontSize,
    lineHeight: fontSize,
    fontFamily: amraleTypography.fontFamily.bold,
    color: amraleColors.text,
    paddingHorizontal: 0,
    margin: 0,
    textAlign: 'center',
  };

  if (Platform.OS === 'android') {
    return {
      ...base,
      textAlignVertical: 'center',
      includeFontPadding: false,
      paddingVertical: 0,
    };
  }

  if (Platform.OS === 'ios') {
    const { paddingTop, paddingBottom } = iosDigitPadding(boxSize, fontSize);
    return {
      ...base,
      paddingTop,
      paddingBottom,
    };
  }

  // Web: line-height matching cell height centers the glyph in the box.
  return {
    ...base,
    lineHeight: boxSize,
    paddingVertical: 0,
  };
}

export function otpCellStyle(boxSize: number) {
  return {
    width: boxSize,
    height: boxSize,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  };
}
