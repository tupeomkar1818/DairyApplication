import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { AmraleAuthShell, AmraleLogo, AuthPrimaryButton, MockOtpBanner, OtpInputGrid } from '@/src/components/auth';
import { VerifyOtpRequestSchema } from '@/src/domain/auth/validations';
import { DomainError } from '@/src/domain/shared/errors';
import { normalizeDigitInput } from '@/src/domain/shared/numerals';
import { formatOtpCountdownMmSs, msUntilIso } from '@/src/domain/shared/otpPolicy';
import { useRequestOtp, useVerifyOtp } from '@/src/hooks/auth';
import { amraleColors, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

function maskForDisplay(mobileNumber: string): string {
  if (mobileNumber.length !== 10) return `+91 ${mobileNumber}`;
  return `+91 ${mobileNumber.slice(0, 2)}XXXXXX${mobileNumber.slice(8)}`;
}

function roleToRoute(role: string) {
  switch (role) {
    case 'admin':
      return '/(admin)';
    case 'customer':
      return '/(customer)';
    case 'delivery_boy':
      return '/(delivery)';
    default:
      return '/(auth)/login';
  }
}

export default function OtpScreen() {
  const params = useLocalSearchParams<{
    mobileNumber?: string;
    maskedMobileNumber?: string;
    resendAvailableAt?: string;
    otpExpiryAt?: string;
    demoOtp?: string;
  }>();

  const mobileNumber = params.mobileNumber ?? '';
  const maskedMobileNumber = params.maskedMobileNumber ?? maskForDisplay(mobileNumber);

  const verifyOtp = useVerifyOtp();
  const requestOtp = useRequestOtp();

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendMs, setResendMs] = useState(() => msUntilIso(params.resendAvailableAt));
  const [expiryMs, setExpiryMs] = useState(() => msUntilIso(params.otpExpiryAt));

  const refs = useRef<Array<RNTextInput | null>>([]);
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    reveal.setValue(0);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => refs.current[0]?.focus());

    const id = setInterval(() => {
      setResendMs(msUntilIso(params.resendAvailableAt));
      setExpiryMs(msUntilIso(params.otpExpiryAt));
    }, 1000);
    return () => clearInterval(id);
  }, [params.resendAvailableAt, params.otpExpiryAt, reveal]);

  const mockOtp = useMemo(() => normalizeDigitInput(params.demoOtp ?? '', 6), [params.demoOtp]);

  const otp = useMemo(() => digits.join(''), [digits]);
  const validation = useMemo(() => VerifyOtpRequestSchema.safeParse({ mobileNumber, otp }), [mobileNumber, otp]);

  async function onVerify() {
    setError(null);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? 'Invalid OTP entered');
      return;
    }

    try {
      const res = await verifyOtp.mutateAsync({ mobileNumber, otp });
      setSuccess(true);
      setTimeout(() => router.replace(roleToRoute(res.session.role)), 700);
    } catch (e) {
      if (e instanceof DomainError) {
        setError(e.message);
        return;
      }
      setError('Network issue, please try again');
    }
  }

  async function onResend() {
    setError(null);
    try {
      const res = await requestOtp.mutateAsync({ mobileNumber });
      router.setParams({
        maskedMobileNumber: res.maskedMobileNumber,
        resendAvailableAt: res.resendAvailableAt,
        otpExpiryAt: res.otpExpiryAt,
        demoOtp: res.demoOtp,
      });
      setDigits(['', '', '', '', '', '']);
      refs.current[0]?.focus();
    } catch (e) {
      if (e instanceof DomainError) {
        setError(e.message);
        return;
      }
      setError('Network issue, please try again');
    }
  }

  function onChangeDigit(index: number, value: string) {
    setError(null);
    const clean = value.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });
    if (clean && index < 5) refs.current[index + 1]?.focus();
  }

  function onBackspace(index: number) {
    setError(null);
    if (digits[index]) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }
    if (index > 0) refs.current[index - 1]?.focus();
  }

  const resendDisabled = resendMs > 0 || requestOtp.isPending || verifyOtp.isPending;

  return (
    <AmraleAuthShell scroll>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: reveal,
            transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          },
        ]}
      >
        <AmraleLogo size="login" rounded />

        <Text style={styles.heading}>Verify with OTP</Text>
        <Text style={styles.subheading}>
          Enter the 6-digit code sent to{' '}
          <Text style={styles.mobileBold}>{maskedMobileNumber}</Text>
        </Text>

        {expiryMs > 0 ? (
          <View style={styles.expiryRow}>
            <MaterialCommunityIcons name="timer-outline" size={16} color={amraleColors.whiteMuted} />
            <Text style={styles.expiryText}>
              Code expires in <Text style={styles.expiryBold}>{formatOtpCountdownMmSs(expiryMs)}</Text>
            </Text>
          </View>
        ) : null}

        <OtpInputGrid
          digits={digits}
          onChangeDigit={onChangeDigit}
          onBackspace={onBackspace}
          inputRefs={refs}
          hasError={!!error}
        />

        {mockOtp ? <MockOtpBanner otp={mockOtp} variant="inline" tone="dark" /> : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>Verified successfully</Text> : null}

        <View style={styles.resendBlock}>
          {resendMs > 0 ? (
            <View style={styles.timerRow}>
              <MaterialCommunityIcons name="timer-outline" size={16} color={amraleColors.whiteMuted} />
              <Text style={styles.timerText}>
                Resend OTP in <Text style={styles.timerBold}>{formatOtpCountdownMmSs(resendMs)}</Text>
              </Text>
            </View>
          ) : null}
          <Pressable
            onPress={onResend}
            disabled={resendDisabled}
            style={({ pressed }) => [
              styles.resendLink,
              resendDisabled && styles.resendDisabled,
              pressed && !resendDisabled && styles.pressed,
            ]}
          >
            <Text style={styles.resendLabel}>Resend OTP</Text>
          </Pressable>
        </View>

        <View style={styles.verifyBtnWrap}>
          <AuthPrimaryButton
            label="Verify with OTP"
            variant="inverse"
            pill
            compact
            showArrow
            onPress={onVerify}
            loading={verifyOtp.isPending}
            disabled={verifyOtp.isPending || success}
          />
        </View>

        <Pressable
          onPress={() => router.replace('/(auth)/login')}
          disabled={verifyOtp.isPending || requestOtp.isPending}
          style={({ pressed }) => [styles.changeMobile, pressed && styles.pressed]}
        >
          <Text style={styles.changeMobileText}>Change mobile number</Text>
        </Pressable>

        <Text style={styles.copyright}>© 2024 Amrale Dairy. All rights reserved.</Text>
      </Animated.View>
    </AmraleAuthShell>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: amraleSpacing.md,
  },
  heading: {
    marginTop: 12,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 24,
    color: amraleColors.white,
    textAlign: 'center',
  },
  subheading: {
    marginTop: 4,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: amraleColors.whiteMuted,
    textAlign: 'center',
    paddingHorizontal: amraleSpacing.sm,
  },
  expiryRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expiryText: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    color: amraleColors.whiteMuted,
  },
  expiryBold: {
    fontFamily: amraleTypography.fontFamily.bold,
    color: amraleColors.white,
  },
  mobileBold: {
    fontFamily: amraleTypography.fontFamily.bold,
    color: amraleColors.white,
  },
  errorText: {
    marginTop: 4,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    color: amraleColors.errorOnDark,
    textAlign: 'center',
  },
  successText: {
    marginTop: 4,
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 14,
    color: amraleColors.white,
    textAlign: 'center',
  },
  resendBlock: {
    marginTop: 8,
    alignItems: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    color: amraleColors.whiteMuted,
  },
  timerBold: {
    fontFamily: amraleTypography.fontFamily.bold,
    color: amraleColors.white,
  },
  verifyBtnWrap: {
    width: '100%',
    marginTop: 12,
  },
  resendLink: {
    paddingVertical: 2,
  },
  resendLabel: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 14,
    color: amraleColors.white,
    textDecorationLine: 'underline',
  },
  resendDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  changeMobile: {
    marginTop: 8,
    paddingVertical: 2,
  },
  changeMobileText: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    color: amraleColors.white,
    textAlign: 'center',
  },
  copyright: {
    marginTop: 12,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    color: amraleColors.whiteSubtle,
    textAlign: 'center',
  },
});
