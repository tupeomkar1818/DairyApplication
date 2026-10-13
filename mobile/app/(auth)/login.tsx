import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MobileNumberField } from '@/src/components/auth';
import { AuthBrandLayout, AuthCard } from '@/src/components/auth/AuthBrandLayout';
import { authFormStyles } from '@/src/components/auth/authFormStyles';
import { RequestOtpRequestSchema } from '@/src/domain/auth/validations';
import { DomainError } from '@/src/domain/shared/errors';
import { useLogin } from '@/src/hooks/auth';
import type { Dictionary } from '@/src/i18n/strings';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

/**
 * Signing in: a mobile number and a PIN.
 *
 * The first time, the PIN is their own mobile number — the dairy sends nothing, so somebody added this morning
 * can start this morning. They are taken straight to choosing a PIN, which is the password from then on.
 */
export default function LoginScreen() {
  const t = useStrings('auth');
  const c = useStrings('common');
  const login = useLogin();

  const [mobileNumber, setMobileNumber] = useState('');
  const [secret, setSecret] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo(() => RequestOtpRequestSchema.safeParse({ mobileNumber }), [mobileNumber]);
  // Say what is wrong only once they have finished typing (or tried to continue), not on the first digit.
  const fieldError =
    touched && !validation.success ? (validation.error.issues[0]?.message ?? c.errors.invalidMobile) : null;
  const busy = login.isPending;
  // Their own number the first time, four digits after that.
  const ready = validation.success && secret.length >= 4;

  async function onSignIn() {
    setTouched(true);
    setError(null);
    if (!ready || busy) return;

    try {
      const res = await login.mutateAsync({ mobileNumber, secret });
      router.replace(res.mustSetPin ? '/(auth)/set-pin' : '/');
    } catch (e) {
      setError(signInProblem(e, t, c));
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
          returnKeyType="next"
          error={fieldError}
        />

        <View style={styles.pinField}>
          <Text style={styles.pinLabel}>{t.login.pin}</Text>
          <TextInput
            value={secret}
            onChangeText={(text) => {
              setError(null);
              setSecret(text.replace(/\D/g, '').slice(0, 10));
            }}
            onSubmitEditing={() => void onSignIn()}
            keyboardType="number-pad"
            inputMode="numeric"
            secureTextEntry
            returnKeyType="go"
            accessibilityLabel={t.login.pin}
            placeholder={t.login.pinPlaceholder}
            placeholderTextColor={amraleColors.textSubtle}
            style={styles.pinInput}
          />
          <Text style={styles.hint}>{t.login.firstTime}</Text>
        </View>

        {error ? (
          <View style={authFormStyles.errorBox} accessibilityLiveRegion="polite">
            <MaterialCommunityIcons name="wifi-alert" size={16} color={amraleColors.error} />
            <Text style={authFormStyles.errorBoxText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => void onSignIn()}
          disabled={busy}
          style={({ pressed }) => [
            authFormStyles.button,
            !ready && authFormStyles.buttonIdle,
            pressed && !busy && authFormStyles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t.login.signIn}
          accessibilityState={{ disabled: busy, busy }}
        >
          {busy ? (
            <ActivityIndicator color={amraleColors.white} />
          ) : (
            <>
              <Text style={authFormStyles.buttonText}>{t.login.signIn}</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color={amraleColors.white} />
            </>
          )}
        </Pressable>

        <Text style={styles.hint}>{t.login.forgotPin}</Text>

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

/**
 * What to show when signing in is refused.
 *
 * The server answers in English, and half the dairy's customers read Marathi, so the codes it can answer with are
 * said in the reader’s own language here. Anything unrecognised falls back to what the server said, which is
 * better than a blank card.
 */
function signInProblem(e: unknown, t: Dictionary['auth'], c: Dictionary['common']): string {
  if (e instanceof DomainError) {
    switch (e.code) {
      case 'MOBILE_NOT_REGISTERED':
        return t.errors.notRegistered;
      case 'USER_INACTIVE':
        return t.errors.inactive;
      case 'APP_ACCESS_DISABLED':
        return t.errors.appAccessDisabled;
      case 'PASSWORD_INVALID':
        return t.errors.firstTimeWrong;
      case 'PIN_INVALID':
        return t.errors.pinWrong;
      default:
        return e.message;
    }
  }
  return e instanceof Error ? e.message : c.errors.network;
}

const styles = StyleSheet.create({
  pinField: { gap: 6 },
  pinLabel: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    color: amraleColors.textMuted,
  },
  pinInput: {
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.inputBgLight,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 20,
    letterSpacing: 6,
    color: amraleColors.text,
  },
  hint: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    color: amraleColors.textMuted,
  },
  roles: { alignItems: 'center', gap: 6 },
  rolesText: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    color: amraleColors.textMuted,
    textAlign: 'center',
  },
});
