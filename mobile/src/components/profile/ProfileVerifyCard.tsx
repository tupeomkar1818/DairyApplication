import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput as RNTextInput, View } from 'react-native';

import { MockOtpBanner } from '@/src/components/auth/MockOtpBanner';
import { ProfileOtpInputGrid } from '@/src/components/profile/ProfileOtpInputGrid';
import { emptyOtpDigits, otpDigitsToString } from '@/src/components/profile/profileOtpUtils';
import { useOtpCountdown, useOtpResendCountdown } from '@/src/components/profile/useOtpCountdown';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

/** A sentence's words before and after its value, so the value can be styled wherever the language puts it. */
function around(sentence: (value: string) => string): [string, string] {
  const mark = '\u0000';
  const [before = '', after = ''] = sentence(mark).split(mark);
  return [before, after];
}

type Props = {
  otpExpiryAt?: string;
  resendAvailableAt?: string;
  demoOtp?: string;
  error?: string | null;
  submitting?: boolean;
  resending?: boolean;
  submitLabel?: string;
  sectionTitle?: string;
  hint?: string;
  onSubmit: (otp: string) => void;
  onResend: () => void;
};

export function ProfileVerifyCard({
  otpExpiryAt,
  resendAvailableAt,
  demoOtp,
  error,
  submitting,
  resending,
  submitLabel,
  sectionTitle,
  hint,
  onSubmit,
  onResend,
}: Props) {
  const t = useStrings('profile');
  const [resendBefore, resendAfter] = around(t.verify.resendIn);
  const [digits, setDigits] = useState(emptyOtpDigits);
  const refs = useRef<Array<RNTextInput | null>>([]);
  const countdown = useOtpCountdown(otpExpiryAt);
  const { remainingMs: resendCooldownMs, label: resendCooldownLabel } = useOtpResendCountdown(resendAvailableAt);
  const resendLocked = resendCooldownMs > 0 || resending;

  const onChangeDigit = (index: number, value: string) => {
    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);
    if (value && index < 5) refs.current[index + 1]?.focus();
  };

  const onBackspace = (index: number) => {
    if (digits[index]) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    if (index > 0) refs.current[index - 1]?.focus();
  };

  const handleSubmit = () => {
    onSubmit(otpDigitsToString(digits));
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <MaterialCommunityIcons name="shield-check-outline" size={20} color={amraleColors.blue} />
          <Text style={styles.cardHeaderTitle}>{sectionTitle ?? t.verify.saveTitle}</Text>
        </View>
        <View style={styles.timer}>
          <MaterialCommunityIcons name="timer-outline" size={18} color={amraleColors.blue} />
          <Text style={styles.timerText}>{countdown}</Text>
        </View>
      </View>

      <Text style={styles.hint}>{hint ?? t.verify.saveHint}</Text>

      {demoOtp ? <MockOtpBanner otp={demoOtp} variant="inline" /> : null}

      <ProfileOtpInputGrid
        digits={digits}
        onChangeDigit={onChangeDigit}
        onBackspace={onBackspace}
        inputRefs={refs}
        hasError={!!error}
      />

      {error ? (
        <View style={styles.errorRow}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color={amraleColors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={handleSubmit}
        disabled={submitting || otpDigitsToString(digits).length < 6}
        style={({ pressed }) => [
          styles.submitBtn,
          (submitting || otpDigitsToString(digits).length < 6) && styles.submitBtnDisabled,
          pressed && !submitting && styles.pressed,
        ]}
      >
        {submitting ? (
          <ActivityIndicator color={amraleColors.white} />
        ) : (
          <Text style={styles.submitBtnText}>{submitLabel ?? t.verify.saveSubmit}</Text>
        )}
      </Pressable>

      {resendCooldownMs > 0 ? (
        <View style={styles.resendCooldownRow}>
          <MaterialCommunityIcons name="timer-outline" size={16} color={amraleColors.textMuted} />
          <Text style={styles.resendCooldownText}>
            {resendBefore}
            <Text style={styles.resendCooldownBold}>{resendCooldownLabel}</Text>
            {resendAfter}
          </Text>
        </View>
      ) : null}

      <Pressable onPress={onResend} disabled={resendLocked} hitSlop={10} style={styles.resendBtn}>
        <Text style={[styles.resendText, resendLocked && styles.resendDisabled]}>
          {resending ? t.verify.sending : t.verify.resend}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.xl,
    padding: amraleSpacing.md,
    gap: amraleSpacing.md,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cardHeaderTitle: {
    flexShrink: 1,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 13,
    color: amraleColors.blue,
    letterSpacing: 0.6,
  },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 15,
    color: amraleColors.blue,
  },
  hint: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    color: amraleColors.textMuted,
    lineHeight: 21,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    color: amraleColors.error,
    lineHeight: 18,
  },
  submitBtn: {
    backgroundColor: amraleColors.blue,
    borderRadius: amraleRadius.lg,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: amraleColors.blue,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  submitBtnDisabled: {
    backgroundColor: amraleColors.buttonDisabledFilled,
    shadowOpacity: 0,
  },
  submitBtnText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 14,
    color: amraleColors.white,
    letterSpacing: 0.8,
  },
  pressed: { opacity: 0.92 },
  resendCooldownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  resendCooldownText: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    color: amraleColors.textMuted,
  },
  resendCooldownBold: {
    fontFamily: amraleTypography.fontFamily.bold,
    color: amraleColors.blue,
  },
  resendBtn: { alignSelf: 'center', paddingVertical: 4 },
  resendText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 14,
    color: amraleColors.textMuted,
  },
  resendDisabled: { opacity: 0.6 },
});
