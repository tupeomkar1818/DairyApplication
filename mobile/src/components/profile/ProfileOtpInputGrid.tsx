import { type RefObject } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { otpCellStyle, otpDigitInputStyle } from '@/src/components/auth/otpInputStyles';
import { normalizeDigitInput } from '@/src/domain/shared/numerals';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius } from '@/src/theme/dairyTactile';

const COLS = 3;
const BOX_SIZE = 44;
const BOX_GAP = 10;
const FONT_SIZE = 20;

type Props = {
  digits: string[];
  onChangeDigit: (index: number, value: string) => void;
  onBackspace: (index: number) => void;
  inputRefs: RefObject<(TextInput | null)[]>;
  hasError?: boolean;
};

export function ProfileOtpInputGrid({ digits, onChangeDigit, onBackspace, inputRefs, hasError }: Props) {
  const t = useStrings('auth');
  const rows = [digits.slice(0, COLS), digits.slice(COLS, 6)];
  const digitStyle = otpDigitInputStyle(BOX_SIZE, FONT_SIZE);

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          {row.map((digit, colIdx) => {
            const index = rowIdx * COLS + colIdx;
            const filled = digit.length > 0;
            return (
              <View
                key={index}
                style={[
                  styles.cell,
                  otpCellStyle(BOX_SIZE),
                  filled && !hasError && styles.cellFilled,
                  hasError && styles.cellError,
                ]}
              >
                <TextInput
                  ref={(r) => {
                    inputRefs.current[index] = r;
                  }}
                  value={digit}
                  onChangeText={(t) => onChangeDigit(index, normalizeDigitInput(t, 1))}
                  keyboardType="number-pad"
                  maxLength={1}
                  scrollEnabled={false}
                  allowFontScaling={false}
                  style={[
                    digitStyle,
                    filled && !hasError && styles.inputFilled,
                    hasError && styles.inputError,
                  ]}
                  selectionColor={amraleColors.blue}
                  autoComplete="off"
                  textContentType="none"
                  importantForAutofill="no"
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === 'Backspace') onBackspace(index);
                  }}
                  accessibilityLabel={t.otp.otpDigit(index + 1)}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    alignItems: 'center',
    gap: BOX_GAP,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: BOX_GAP,
  },
  cell: {
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  cellFilled: {
    backgroundColor: amraleColors.inputBgLight,
    borderColor: 'rgba(53, 81, 161, 0.22)',
  },
  cellError: {
    borderWidth: 2,
    borderColor: amraleColors.error,
    backgroundColor: amraleColors.white,
  },
  inputFilled: {
    color: amraleColors.blue,
  },
  inputError: {
    color: amraleColors.error,
  },
});
