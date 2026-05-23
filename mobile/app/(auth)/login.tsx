import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  AmraleLogo,
  AuthFooterLinks,
  AuthPrimaryButton,
  LoginLightShell,
  MobileNumberField,
} from '@/src/components/auth';
import { RequestOtpRequestSchema } from '@/src/domain/auth/validations';
import { DomainError } from '@/src/domain/shared/errors';
import { useRequestOtp } from '@/src/hooks/auth';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

export default function LoginScreen() {
  const requestOtp = useRequestOtp();
  const [mobileNumber, setMobileNumber] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo(() => RequestOtpRequestSchema.safeParse({ mobileNumber }), [mobileNumber]);
  const fieldError =
    touched && !validation.success ? (validation.error.issues[0]?.message ?? 'Invalid mobile number') : null;

  async function onVerifyWithOtp() {
    setTouched(true);
    setError(null);
    if (!validation.success) return;

    try {
      const res = await requestOtp.mutateAsync({ mobileNumber });
      router.push({
        pathname: '/(auth)/otp',
        params: {
          mobileNumber,
          maskedMobileNumber: res.maskedMobileNumber,
          resendAvailableAt: res.resendAvailableAt,
          otpExpiryAt: res.otpExpiryAt,
          demoOtp: res.demoOtp,
        },
      });
    } catch (e) {
      if (e instanceof DomainError) {
        setError(e.message);
        return;
      }
      setError('Network issue, please try again');
    }
  }

  return (
    <LoginLightShell
      footer={
        <>
          <AuthFooterLinks
            variant="light"
            onNeedHelp={() => router.push('/(auth)/faq')}
            onContactAdmin={() => router.push('/(auth)/contact-admin')}
            onPrivacyPolicy={() => router.push('/(auth)/privacy-policy')}
          />
          <Text style={styles.copyright}>© 2024 Amrale Dairy. All rights reserved.</Text>
        </>
      }
    >
      <AmraleLogo size="login" rounded style={styles.logo} />

      <View style={styles.card}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>
          Experience the purest farm fresh dairy, delivered to your door.
        </Text>

        <MobileNumberField
          variant="light"
          showLabel
          value={mobileNumber}
          onChangeText={(t) => {
            setTouched(true);
            setError(null);
            setMobileNumber(t);
          }}
          onBlur={() => setTouched(true)}
          error={fieldError}
        />

        {error ? <Text style={styles.apiError}>{error}</Text> : null}

        <AuthPrimaryButton
          label="Verify with OTP"
          variant="filled"
          onPress={onVerifyWithOtp}
          loading={requestOtp.isPending}
          disabled={requestOtp.isPending}
        />

        <View style={styles.secureRow}>
          <View style={styles.secureLine} />
          <Text style={styles.secureLabel}>SECURE ACCESS</Text>
          <View style={styles.secureLine} />
        </View>
      </View>
    </LoginLightShell>
  );
}

const styles = StyleSheet.create({
  logo: {
    marginBottom: amraleSpacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.xxl,
    padding: amraleSpacing.lg,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    shadowColor: amraleColors.cardShadow,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  title: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 26,
    color: amraleColors.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: amraleSpacing.sm,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: amraleColors.textMuted,
    textAlign: 'center',
    paddingHorizontal: amraleSpacing.xs,
  },
  apiError: {
    marginTop: amraleSpacing.sm,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    color: amraleColors.error,
    textAlign: 'center',
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: amraleSpacing.lg,
    gap: 10,
  },
  secureLine: {
    flex: 1,
    height: 1,
    backgroundColor: amraleColors.inputBorderLight,
  },
  secureLabel: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: amraleColors.textSubtle,
  },
  copyright: {
    marginTop: amraleSpacing.sm,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    color: amraleColors.textSubtle,
    textAlign: 'center',
  },
});
