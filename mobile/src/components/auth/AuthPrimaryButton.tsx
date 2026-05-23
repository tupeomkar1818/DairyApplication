import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'inverse' | 'filled';
  showArrow?: boolean;
  /** Fully rounded pill shape (OTP screen) */
  pill?: boolean;
  compact?: boolean;
};

export function AuthPrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'inverse',
  showArrow = false,
  pill = false,
  compact = false,
}: Props) {
  const isDisabled = disabled || loading;
  const isFilled = variant === 'filled';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        compact && styles.btnCompact,
        pill && styles.btnPill,
        isFilled ? styles.btnFilled : styles.btnInverse,
        isDisabled && (isFilled ? styles.btnFilledDisabled : styles.btnInverseDisabled),
        pressed && !isDisabled && styles.btnPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={isFilled ? amraleColors.white : amraleColors.blue} />
      ) : (
        <View style={styles.row}>
          <Text style={[styles.label, isFilled ? styles.labelFilled : styles.labelInverse, isDisabled && styles.labelDisabled]}>
            {label}
          </Text>
          {showArrow ? (
            <MaterialCommunityIcons
              name="arrow-right"
              size={20}
              color={isFilled ? amraleColors.white : amraleColors.blue}
              style={styles.arrow}
            />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '100%',
    marginTop: 20,
    borderRadius: amraleRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  btnPill: {
    borderRadius: amraleRadius.pill,
  },
  btnCompact: {
    marginTop: 0,
  },
  btnInverse: {
    backgroundColor: amraleColors.white,
  },
  btnFilled: {
    backgroundColor: amraleColors.blue,
    shadowColor: amraleColors.blue,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  btnInverseDisabled: {
    backgroundColor: amraleColors.buttonDisabled,
  },
  btnFilledDisabled: {
    backgroundColor: amraleColors.buttonDisabledFilled,
  },
  btnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  arrow: { marginTop: 1 },
  label: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  labelInverse: { color: amraleColors.blue },
  labelFilled: { color: amraleColors.white },
  labelDisabled: { opacity: 0.65 },
});
