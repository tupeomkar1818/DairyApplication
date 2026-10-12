import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

/**
 * Shared building blocks for admin add/edit forms (products, customers) so every form looks the same:
 * section cards, labels, inline errors, option chips, toggle cards and plain rounded inputs.
 */

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function FormSection({
  title,
  icon,
  children,
  right,
  onLayout,
}: {
  title: string;
  icon: IconName;
  children: ReactNode;
  /** Optional header action (e.g. an "Edit" link on a details screen). */
  right?: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  return (
    <View style={styles.section} onLayout={onLayout}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name={icon} size={18} color={amraleColors.blue} />
        <Text style={styles.sectionTitle}>{title}</Text>
        {right ? <View style={styles.sectionRight}>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}

export function FieldLabel({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{children}</Text>
      {right}
    </View>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? <Text style={styles.fieldError}>{message}</Text> : null;
}

/** Single-choice chips. */
export function OptionChips<T extends string>({
  options,
  value,
  onChange,
  labelFor,
}: {
  options: readonly T[];
  value: T | '';
  onChange: (next: T) => void;
  labelFor?: (option: T) => string;
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map((o) => {
        const selected = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{labelFor ? labelFor(o) : o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Multi-choice chips (a check mark shows on selected ones). */
export function MultiOptionChips<T extends string>({
  options,
  values,
  onToggle,
  labelFor,
}: {
  options: readonly T[];
  values: readonly T[];
  onToggle: (option: T) => void;
  labelFor?: (option: T) => string;
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map((o) => {
        const selected = values.includes(o);
        return (
          <Pressable
            key={o}
            onPress={() => onToggle(o)}
            style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
          >
            {selected ? <MaterialCommunityIcons name="check" size={14} color={amraleColors.white} /> : null}
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{labelFor ? labelFor(o) : o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A tappable row with an on/off check, for yes/no settings. */
export function ToggleCard({
  icon,
  label,
  hint,
  value,
  onChange,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.toggleCard, value && styles.toggleCardOn, pressed && styles.pressed]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <MaterialCommunityIcons name={icon} size={22} color={amraleColors.blue} />
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
      <MaterialCommunityIcons
        name={value ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
        size={24}
        color={value ? amraleColors.blue : amraleColors.textSubtle}
      />
    </Pressable>
  );
}

/**
 * Props for `DeferredTextInput` (Paper's TextInput) inside a `formInputStyles.inputRow`: strips Paper's flat-mode
 * fill and underline so the field looks like a plain rounded input. Pair with `style={formInputStyles.inputText}`.
 */
export const plainTextInputProps = {
  mode: 'flat',
  dense: true,
  underlineColor: 'transparent',
  activeUnderlineColor: 'transparent',
  textColor: amraleColors.text,
  selectionColor: amraleColors.blue,
  contentStyle: {
    paddingHorizontal: 0,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
  },
} as const;

export const formInputStyles = StyleSheet.create({
  /** Rounded field row: leading icon + input (or a value for pickers) + optional trailing icon. */
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.inputBgLight,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  inputRowError: { borderColor: amraleColors.error },
  inputRowMultiline: { alignItems: 'flex-start', paddingVertical: 12 },
  /** Read-only rows (auto-filled values). */
  inputRowReadonly: { backgroundColor: amraleColors.white, borderStyle: 'dashed' },
  inputText: {
    flex: 1,
    minWidth: 0,
    height: 44,
    // Paper's flat TextInput reads its 16px side padding from `style.paddingHorizontal`; zero it.
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
    color: amraleColors.text,
  },
  /** Plain text value inside a pressable picker row. */
  inputValue: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
    color: amraleColors.text,
  },
  placeholder: { color: amraleColors.textSubtle },
});

const styles = StyleSheet.create({
  section: {
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.lg,
    padding: amraleSpacing.md,
    gap: amraleSpacing.md,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.06)',
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  sectionRight: { flexShrink: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },
  fieldError: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.error },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  chipSelected: { backgroundColor: amraleColors.blue, borderColor: amraleColors.blue },
  chipText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.text },
  chipTextSelected: { color: amraleColors.white },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  toggleCardOn: { borderColor: 'rgba(53, 81, 161, 0.35)', backgroundColor: 'rgba(53, 81, 161, 0.04)' },
  toggleText: { flex: 1, minWidth: 0, gap: 2 },
  toggleLabel: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 15, color: amraleColors.text },
  toggleHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  pressed: { opacity: 0.88 },
});
