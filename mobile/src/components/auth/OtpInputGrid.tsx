import { type RefObject } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { otpCellStyle, otpDigitInputStyle } from '@/src/components/auth/otpInputStyles';
import { normalizeDigitInput } from '@/src/domain/shared/numerals';
import { amraleColors, amraleRadius } from '@/src/theme/dairyTactile';

const COLS = 3;
const BOX_SIZE = 38;
const BOX_GAP = 6;
const FONT_SIZE = 18;

type Props = {
  digits: string[];
  onChangeDigit: (index: number, value: string) => void;
  onBackspace: (index: number) => void;
  inputRefs: RefObject<(TextInput | null)[]>;
  hasError?: boolean;
};

/** 3 digits per row — line 1: indices 0–2, line 2: indices 3–5 */
export function OtpInputGrid({ digits, onChangeDigit, onBackspace, inputRefs, hasError }: Props) {
  const rows = [digits.slice(0, COLS), digits.slice(COLS, 6)];
  const digitStyle = otpDigitInputStyle(BOX_SIZE, FONT_SIZE);
  const maxWidth = BOX_SIZE * COLS + BOX_GAP * (COLS - 1);

  return (
    <View style={[styles.grid, { maxWidth, gap: BOX_GAP }]}>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={[styles.row, { gap: BOX_GAP }]}>
          {row.map((digit, colIdx) => {
            const index = rowIdx * COLS + colIdx;
            return (
              <View
                key={index}
                style={[
                  styles.cell,
                  otpCellStyle(BOX_SIZE),
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
                  style={digitStyle}
                  selectionColor={amraleColors.blue}
                  autoComplete="off"
                  textContentType="none"
                  autoCorrect={false}
                  importantForAutofill="no"
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === 'Backspace') onBackspace(index);
                  }}
                  accessibilityLabel={`OTP digit ${index + 1}`}
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
    alignSelf: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  cell: {
    borderRadius: amraleRadius.sm,
    backgroundColor: amraleColors.white,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  cellError: {
    borderWidth: 2,
    borderColor: amraleColors.errorOnDark,
  },
});
