import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { amraleColors, amraleRadius, amraleTypography, dairyTactileColors } from '@/src/theme/dairyTactile';
import { useStrings } from '@/src/i18n/useStrings';

/**
 * ‹ period › row used by the screens that can look back at earlier days or months. Matches the month navigators on
 * the Delivery Boy detail tabs.
 */
export function PeriodStepper({
  label,
  hint,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  onPressLabel,
  prevLabel,
  nextLabel,
}: {
  label: string;
  /** Second line under the label, e.g. "Tap for today". */
  hint?: string;
  onPrev: () => void;
  onNext: () => void;
  /** True at the oldest period with data — there is nothing further back to show. */
  prevDisabled?: boolean;
  /** True at the current period — there is nothing ahead to show. */
  nextDisabled?: boolean;
  onPressLabel?: () => void;
  prevLabel?: string;
  nextLabel?: string;
}) {
  const t = useStrings('common');
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPrev}
        disabled={prevDisabled}
        style={({ pressed }) => [styles.btn, prevDisabled && styles.disabled, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={prevLabel ?? t.actions.previous}
      >
        <MaterialCommunityIcons name="chevron-left" size={22} color={amraleColors.text} />
      </Pressable>

      <Pressable
        onPress={onPressLabel}
        disabled={!onPressLabel}
        style={({ pressed }) => [styles.center, onPressLabel && pressed && styles.pressed]}
        accessibilityRole={onPressLabel ? 'button' : undefined}
      >
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={styles.hint} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </Pressable>

      <Pressable
        onPress={onNext}
        disabled={nextDisabled}
        style={({ pressed }) => [styles.btn, nextDisabled && styles.disabled, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={nextLabel ?? t.actions.next}
      >
        <MaterialCommunityIcons name="chevron-right" size={22} color={amraleColors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Capped and centered: on a wide screen a full-width row pushes the arrows metres away from the label they move.
  row: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: dairyTactileColors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 44 },
  label: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    color: amraleColors.text,
  },
  hint: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: amraleColors.textMuted,
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
});
