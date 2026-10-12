import { useState, type RefObject } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { otpDigitInputStyle } from '@/src/components/auth/otpInputStyles';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius } from '@/src/theme/dairyTactile';

export const OTP_LENGTH = 6;
const GAP = 8;
const MAX_BOX = 52;
const MIN_BOX = 36;

/**
 * The six OTP boxes in one row, sized to the card (36–52px each).
 *
 * Typing moves to the next box, backspace to the previous one, and pasting or auto-filling the whole code into any box
 * spreads it across all six — so an SMS code the phone offers (iOS "From Messages", Android autofill) fills in at once.
 */
export function OtpCodeInput({
  digits,
  onChange,
  inputRefs,
  hasError,
  success,
  disabled,
  onComplete,
}: {
  digits: string[];
  onChange: (next: string[]) => void;
  inputRefs: RefObject<(TextInput | null)[]>;
  hasError?: boolean;
  success?: boolean;
  disabled?: boolean;
  /** All six digits are in (typed, pasted or auto-filled). */
  onComplete?: (code: string) => void;
}) {
  const t = useStrings('auth');
  const [width, setWidth] = useState(0);
  const [focused, setFocused] = useState<number | null>(null);
  const box = width ? Math.max(MIN_BOX, Math.min(MAX_BOX, Math.floor((width - GAP * (OTP_LENGTH - 1)) / OTP_LENGTH))) : MAX_BOX;
  const fontSize = box >= 48 ? 24 : 20;
  const digitStyle = otpDigitInputStyle(box, fontSize);

  function focus(index: number) {
    inputRefs.current[Math.max(0, Math.min(OTP_LENGTH - 1, index))]?.focus();
  }

  function setFrom(index: number, raw: string) {
    const clean = raw.replace(/\D/g, '');
    const next = [...digits];
    if (clean.length <= 1) {
      next[index] = clean;
      onChange(next);
      if (clean) {
        if (index < OTP_LENGTH - 1) focus(index + 1);
        else if (next.every(Boolean)) onComplete?.(next.join(''));
      }
      return;
    }
    // A paste or autofill: a full code starts from the first box; a partial one from where it was dropped.
    const start = clean.length >= OTP_LENGTH ? 0 : index;
    const chars = clean.slice(0, OTP_LENGTH - start).split('');
    chars.forEach((c, i) => {
      next[start + i] = c;
    });
    onChange(next);
    const lastFilled = start + chars.length - 1;
    if (next.every(Boolean)) {
      inputRefs.current[lastFilled]?.blur();
      onComplete?.(next.join(''));
    } else {
      focus(lastFilled + 1);
    }
  }

  return (
    <View style={styles.row} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityLabel={t.otp.codeLabel}>
      {digits.map((digit, index) => {
        const isFocused = focused === index;
        return (
          <View
            key={index}
            style={[
              styles.cell,
              { width: box, height: box },
              digit ? styles.cellFilled : null,
              isFocused ? styles.cellFocused : null,
              hasError ? styles.cellError : null,
              success ? styles.cellSuccess : null,
            ]}
          >
            <TextInput
              ref={(r) => {
                inputRefs.current[index] = r;
              }}
              value={digit}
              onChangeText={(t) => setFrom(index, t)}
              onFocus={() => setFocused(index)}
              onBlur={() => setFocused((f) => (f === index ? null : f))}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key !== 'Backspace' || digit) return;
                if (index > 0) {
                  const next = [...digits];
                  next[index - 1] = '';
                  onChange(next);
                  focus(index - 1);
                }
              }}
              editable={!disabled}
              keyboardType="number-pad"
              inputMode="numeric"
              // Only the first box offers the SMS code; a longer max length lets a paste through to be spread.
              maxLength={index === 0 ? OTP_LENGTH : 2}
              textContentType={index === 0 ? 'oneTimeCode' : 'none'}
              autoComplete={index === 0 ? (Platform.OS === 'android' ? 'sms-otp' : 'one-time-code') : 'off'}
              importantForAutofill={index === 0 ? 'yes' : 'no'}
              autoCorrect={false}
              scrollEnabled={false}
              allowFontScaling={false}
              selectTextOnFocus
              caretHidden={Platform.OS !== 'web'}
              selectionColor={amraleColors.blue}
              style={[digitStyle, webNoOutline]}
              accessibilityLabel={t.otp.digitOf(index + 1, OTP_LENGTH)}
            />
          </View>
        );
      })}
    </View>
  );
}

const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  row: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: GAP },
  cell: {
    borderRadius: amraleRadius.md,
    borderWidth: 1.5,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.inputBgLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellFilled: { backgroundColor: amraleColors.white, borderColor: 'rgba(0, 85, 199, 0.35)' },
  cellFocused: { borderColor: amraleColors.blue, borderWidth: 2, backgroundColor: amraleColors.white },
  cellError: { borderColor: amraleColors.error, backgroundColor: 'rgba(186, 26, 26, 0.04)' },
  cellSuccess: { borderColor: '#15803D', backgroundColor: 'rgba(22, 163, 74, 0.08)' },
});
