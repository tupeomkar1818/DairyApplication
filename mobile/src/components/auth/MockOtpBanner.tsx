import { StyleSheet, Text, View } from 'react-native';

import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

type Props = {
  otp: string;
  /** Single line (default). `banner` kept for legacy dark layouts only. */
  variant?: 'inline' | 'banner';
  /** Text colors when `variant="inline"` */
  tone?: 'light' | 'dark';
};

/** Visible mock OTP hint for development / mock service mode */
export function MockOtpBanner({ otp, variant = 'inline', tone = 'light' }: Props) {
  const t = useStrings('auth');
  if (!/^\d{6}$/.test(otp)) return null;

  if (variant === 'banner') {
    return (
      <View style={styles.banner} accessibilityRole="text" accessibilityLabel={t.mockOtp.accessibilityLabel(otp)}>
        <Text style={styles.label}>{t.mockOtp.bannerLabel}</Text>
        <Text style={styles.code}>{otp}</Text>
        <Text style={styles.hint}>{t.mockOtp.hint}</Text>
      </View>
    );
  }

  const isDark = tone === 'dark';

  return (
    <Text
      style={[styles.inlineLine, isDark && styles.inlineLineDark]}
      accessibilityRole="text"
      accessibilityLabel={t.mockOtp.accessibilityLabel(otp)}
    >
      {`${t.mockOtp.inlineLabel}: `}
      <Text style={[styles.inlineCode, isDark && styles.inlineCodeDark]}>{otp}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: amraleRadius.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    width: '100%',
    maxWidth: 260,
  },
  label: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: amraleColors.whiteMuted,
  },
  code: {
    marginTop: 2,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 22,
    letterSpacing: 6,
    color: amraleColors.white,
  },
  hint: {
    marginTop: 4,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 11,
    color: amraleColors.whiteSubtle,
    textAlign: 'center',
  },
  inlineLine: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    color: amraleColors.textMuted,
    textAlign: 'center',
  },
  inlineCode: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 13,
    color: amraleColors.blue,
    letterSpacing: 1,
  },
  inlineLineDark: {
    color: amraleColors.whiteMuted,
  },
  inlineCodeDark: {
    color: amraleColors.white,
    letterSpacing: 2,
  },
});
