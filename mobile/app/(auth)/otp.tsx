import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput as RNTextInput, View } from 'react-native';

import { AuthBrandLayout, AuthCard } from '@/src/components/auth/AuthBrandLayout';
import { authFormStyles } from '@/src/components/auth/authFormStyles';
import { OTP_LENGTH, OtpCodeInput } from '@/src/components/auth/OtpCodeInput';
import { VerifyOtpRequestSchema } from '@/src/domain/auth/validations';
import { DomainError } from '@/src/domain/shared/errors';
import { normalizeDigitInput } from '@/src/domain/shared/numerals';
import { formatOtpCountdownMmSs, msUntilIso } from '@/src/domain/shared/otpPolicy';
import { useRequestOtp, useVerifyOtp } from '@/src/hooks/auth';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

const EMPTY = Array.from({ length: OTP_LENGTH }, () => '');

/** A sentence's words before and after its value, so the value can be styled wherever the language puts it. */
function around(sentence: (value: string) => string): [string, string] {
  const mark = '\u0000';
  const [before = '', after = ''] = sentence(mark).split(mark);
  return [before, after];
}

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

  const t = useStrings('auth');
  const c = useStrings('common');
  const verifyOtp = useVerifyOtp();
  const requestOtp = useRequestOtp();

  const [digits, setDigits] = useState<string[]>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendMs, setResendMs] = useState(() => msUntilIso(params.resendAvailableAt));
  const [expiryMs, setExpiryMs] = useState(() => msUntilIso(params.otpExpiryAt));

  const refs = useRef<Array<RNTextInput | null>>([]);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    // Refresh countdowns right away when params change (e.g. after Resend) instead of one tick later.
    setResendMs(msUntilIso(params.resendAvailableAt));
    setExpiryMs(msUntilIso(params.otpExpiryAt));
    const focusTimer = setTimeout(() => refs.current[0]?.focus(), 250);
    const id = setInterval(() => {
      setResendMs(msUntilIso(params.resendAvailableAt));
      setExpiryMs(msUntilIso(params.otpExpiryAt));
    }, 1000);
    return () => {
      clearTimeout(focusTimer);
      clearInterval(id);
    };
  }, [params.resendAvailableAt, params.otpExpiryAt]);

  const demoOtp = useMemo(() => normalizeDigitInput(params.demoOtp ?? '', OTP_LENGTH), [params.demoOtp]);
  const otp = digits.join('');
  const complete = otp.length === OTP_LENGTH;
  const expired = !!params.otpExpiryAt && expiryMs <= 0 && !success;
  const busy = verifyOtp.isPending;

  async function verify(code: string = otp) {
    if (busy || success) return;
    setError(null);
    setNotice(null);
    const validation = VerifyOtpRequestSchema.safeParse({ mobileNumber, otp: code });
    if (!validation.success) {
      setError(code.length < OTP_LENGTH ? t.otp.enterAllDigits : (validation.error.issues[0]?.message ?? t.errors.invalidOtpEntered));
      return;
    }
    if (expired) {
      setError(t.otp.expiredUseResend);
      return;
    }

    try {
      const res = await verifyOtp.mutateAsync({ mobileNumber, otp: code });
      setSuccess(true);
      const target = roleToRoute(res.session.role);
      redirectTimerRef.current = setTimeout(() => {
        redirectTimerRef.current = null;
        // Drop login/OTP from history so back doesn't return to the auth screens while signed in.
        if (router.canDismiss()) router.dismissAll();
        router.replace(target);
      }, 700);
    } catch (e) {
      setError(e instanceof DomainError ? e.message : c.errors.network);
      // A wrong code is cleared so the next attempt starts clean.
      setDigits(EMPTY);
      setTimeout(() => refs.current[0]?.focus(), 50);
    }
  }

  async function onResend() {
    setError(null);
    setNotice(null);
    try {
      const res = await requestOtp.mutateAsync({ mobileNumber });
      router.setParams({
        maskedMobileNumber: res.maskedMobileNumber,
        resendAvailableAt: res.resendAvailableAt,
        otpExpiryAt: res.otpExpiryAt,
        demoOtp: res.demoOtp,
      });
      setDigits(EMPTY);
      setNotice(t.otp.newCodeSent(res.maskedMobileNumber ?? maskedMobileNumber));
      refs.current[0]?.focus();
    } catch (e) {
      setError(e instanceof DomainError ? e.message : c.errors.network);
    }
  }

  const changeNumber = () => (router.canGoBack() ? router.back() : router.replace('/(auth)/login'));
  const canResend = resendMs <= 0 && !requestOtp.isPending && !busy && !success;
  // Expiry and the resend cooldown usually end together; one countdown on screen is enough then.
  const sameClock = Math.abs(resendMs - expiryMs) < 2000;
  const [sentBefore, sentAfter] = around(t.otp.sentTo);
  const [expiresBefore, expiresAfter] = around(t.otp.expiresIn);

  return (
    <AuthBrandLayout onBack={changeNumber} backLabel={t.otp.changeNumber}>
      <AuthCard>
        <View style={styles.iconBadge}>
          <MaterialCommunityIcons name={success ? 'shield-check' : 'message-lock-outline'} size={26} color={success ? '#15803D' : amraleColors.blue} />
        </View>
        <Text style={authFormStyles.title}>{success ? t.otp.verified : t.otp.title}</Text>
        <Text style={authFormStyles.subtitle}>
          {success ? t.otp.signingIn : sentBefore}
          {success ? null : <Text style={authFormStyles.strong}>{maskedMobileNumber}</Text>}
          {success ? null : sentAfter}
          {success ? null : (
            <Text style={authFormStyles.link} onPress={changeNumber} accessibilityRole="link">
              {c.actions.edit}
            </Text>
          )}
        </Text>

        <View style={styles.codeWrap}>
          <OtpCodeInput
            digits={digits}
            onChange={(next) => {
              setError(null);
              setDigits(next);
            }}
            inputRefs={refs}
            hasError={!!error}
            success={success}
            disabled={busy || success}
            onComplete={(code) => void verify(code)}
          />
        </View>

        {!success ? (
          expired ? (
            <View style={[styles.status, styles.statusExpired]} accessibilityLiveRegion="polite">
              <MaterialCommunityIcons name="timer-off-outline" size={16} color={amraleColors.error} />
              <Text style={[styles.statusText, styles.statusTextExpired]}>{t.otp.codeExpired}</Text>
            </View>
          ) : expiryMs > 0 ? (
            <View style={styles.status}>
              <MaterialCommunityIcons name="timer-outline" size={16} color={amraleColors.textMuted} />
              <Text style={styles.statusText}>
                {expiresBefore}
                <Text style={styles.statusStrong}>{formatOtpCountdownMmSs(expiryMs)}</Text>
                {expiresAfter}
              </Text>
            </View>
          ) : null
        ) : null}

        {error ? (
          <View style={authFormStyles.errorBox} accessibilityLiveRegion="polite">
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={amraleColors.error} />
            <Text style={authFormStyles.errorBoxText}>{error}</Text>
          </View>
        ) : null}
        {notice && !error ? (
          <View style={styles.noticeBox} accessibilityLiveRegion="polite">
            <MaterialCommunityIcons name="check-circle-outline" size={16} color="#15803D" />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        {demoOtp && !success && !expired ? (
          <View style={styles.demo}>
            <View style={styles.demoText}>
              <Text style={styles.demoLabel}>{t.otp.demoMode}</Text>
              <Text style={styles.demoCode}>{t.otp.demoCode(demoOtp)}</Text>
            </View>
            <Pressable
              onPress={() => {
                const filled = demoOtp.split('');
                setDigits(filled);
                void verify(demoOtp);
              }}
              disabled={busy}
              style={({ pressed }) => [styles.demoBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t.otp.useDemoCode}
            >
              <Text style={styles.demoBtnText}>{t.otp.useCode}</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={() => void verify()}
          disabled={busy || success}
          style={({ pressed }) => [
            authFormStyles.button,
            !complete && !success && authFormStyles.buttonIdle,
            success && authFormStyles.buttonDone,
            pressed && !busy && authFormStyles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={success ? t.otp.verified : t.otp.verifyAndSignInLabel}
          accessibilityState={{ disabled: busy || success, busy }}
        >
          {busy ? (
            <ActivityIndicator color={amraleColors.white} />
          ) : success ? (
            <>
              <MaterialCommunityIcons name="check" size={20} color={amraleColors.white} />
              <Text style={authFormStyles.buttonText}>{t.otp.verified}</Text>
            </>
          ) : (
            <>
              <Text style={authFormStyles.buttonText}>{t.otp.verifyAndSignIn}</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color={amraleColors.white} />
            </>
          )}
        </Pressable>

        {!success ? (
          <View style={styles.resendRow}>
            <Text style={styles.resendPrompt}>{t.otp.didntGetCode}</Text>
            {requestOtp.isPending ? (
              <ActivityIndicator size="small" color={amraleColors.blue} />
            ) : (
              <Pressable
                onPress={() => void onResend()}
                disabled={!canResend}
                hitSlop={8}
                style={({ pressed }) => [styles.resendBtn, pressed && canResend && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canResend }}
                accessibilityLabel={canResend ? t.otp.resendCode : t.otp.resendCodeIn(formatOtpCountdownMmSs(resendMs))}
              >
                <Text style={[authFormStyles.link, styles.resendText, !canResend && styles.resendDisabled]}>
                  {resendMs > 0 && !sameClock ? t.otp.resendIn(formatOtpCountdownMmSs(resendMs)) : t.otp.resendCode}
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </AuthCard>
    </AuthBrandLayout>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3efff',
    marginBottom: 12,
  },
  codeWrap: { marginTop: 20 },

  status: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.inputBgLight,
  },
  statusExpired: { backgroundColor: 'rgba(186, 26, 26, 0.08)' },
  statusText: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },
  statusTextExpired: { color: amraleColors.error },
  statusStrong: { fontFamily: amraleTypography.fontFamily.bold, color: amraleColors.text },

  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    padding: 10,
    borderRadius: amraleRadius.md,
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
  },
  noticeText: { flex: 1, fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: '#15803D' },

  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#f6d9a6',
    backgroundColor: '#fff8ec',
  },
  demoText: { flex: 1, minWidth: 0 },
  demoLabel: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 10, letterSpacing: 1, color: '#8a5300' },
  demoCode: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, letterSpacing: 1, color: '#5c3a00' },
  demoBtn: {
    minHeight: 34,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: amraleRadius.pill,
    backgroundColor: '#8a5300',
  },
  demoBtnText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 13, color: amraleColors.white },

  resendRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  resendPrompt: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },
  resendBtn: { minHeight: 32, justifyContent: 'center' },
  resendText: { fontSize: 14 },
  resendDisabled: { color: amraleColors.textSubtle },
});
