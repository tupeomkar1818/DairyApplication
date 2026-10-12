import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { MobileNumberField } from '@/src/components/auth';
import { AuthBrandLayout, AuthCard } from '@/src/components/auth/AuthBrandLayout';
import { authFormStyles } from '@/src/components/auth/authFormStyles';
import { RequestOtpRequestSchema } from '@/src/domain/auth/validations';
import { DomainError } from '@/src/domain/shared/errors';
import { useRequestOtp } from '@/src/hooks/auth';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleTypography } from '@/src/theme/dairyTactile';

export default function LoginScreen() {
  const t = useStrings('auth');
  const c = useStrings('common');
  const requestOtp = useRequestOtp();

  const [mobileNumber, setMobileNumber] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo(() => RequestOtpRequestSchema.safeParse({ mobileNumber }), [mobileNumber]);
  // Say what is wrong only once they have finished typing (or tried to continue), not on the first digit.
  const fieldError =
    touched && !validation.success ? (validation.error.issues[0]?.message ?? c.errors.invalidMobile) : null;
  const busy = requestOtp.isPending;

  async function onGetOtp() {
    setTouched(true);
    setError(null);
    if (!validation.success || busy) return;

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
      setError(e instanceof DomainError ? e.message : c.errors.network);
    }
  }

  return (
    <AuthBrandLayout>
      <AuthCard>
        <Text style={authFormStyles.title}>{t.login.title}</Text>
        <Text style={authFormStyles.subtitle}>{t.login.subtitle}</Text>

        <MobileNumberField
          variant="light"
          showLabel
          label={c.fields.mobileNumber}
          prominent
          value={mobileNumber}
          onChangeText={(text) => {
            setError(null);
            setMobileNumber(text);
            if (text.length === 10) setTouched(true);
          }}
          onBlur={() => mobileNumber.length > 0 && setTouched(true)}
          onSubmitEditing={() => void onGetOtp()}
          returnKeyType="go"
          error={fieldError}
        />

        {error ? (
          <View style={authFormStyles.errorBox} accessibilityLiveRegion="polite">
            <MaterialCommunityIcons name="wifi-alert" size={16} color={amraleColors.error} />
            <Text style={authFormStyles.errorBoxText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => void onGetOtp()}
          disabled={busy}
          style={({ pressed }) => [
            authFormStyles.button,
            !validation.success && authFormStyles.buttonIdle,
            pressed && !busy && authFormStyles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t.login.getOtp}
          accessibilityState={{ disabled: busy, busy }}
        >
          {busy ? (
            <ActivityIndicator color={amraleColors.white} />
          ) : (
            <>
              <Text style={authFormStyles.buttonText}>{t.login.getOtp}</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color={amraleColors.white} />
            </>
          )}
        </Pressable>

        <View style={authFormStyles.note}>
          <MaterialCommunityIcons name="shield-lock-outline" size={16} color={amraleColors.textSubtle} />
          <Text style={authFormStyles.noteText}>{t.login.privacyNote}</Text>
        </View>

        <View style={authFormStyles.divider} />

        <View style={styles.roles}>
          <Text style={styles.rolesText}>{t.login.whoSignsIn}</Text>
          <Pressable onPress={() => router.push('/(auth)/contact-admin')} hitSlop={6} accessibilityRole="link">
            <Text style={authFormStyles.link}>{t.login.newCustomer}</Text>
          </Pressable>
        </View>
      </AuthCard>
    </AuthBrandLayout>
  );
}

const styles = StyleSheet.create({
  roles: { alignItems: 'center', gap: 6 },
  rolesText: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    color: amraleColors.textMuted,
    textAlign: 'center',
  },
});
