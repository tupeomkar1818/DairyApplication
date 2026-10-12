import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput as RNTextInput, View } from 'react-native';
import { TextInput } from 'react-native-paper';

import { DatePickerModal } from '@/src/components/shared/DatePickerModal';
import { formInputStyles } from '@/src/components/shared/formFields';
import { amraleColors } from '@/src/theme/dairyTactile';
import { formFieldAttrs } from '@/src/theme/platformStyles';
import { useStrings } from '@/src/i18n/useStrings';

export type DateInputValueFormat = 'DD/MM/YYYY';

/** Strips non-digits, caps at 8, inserts slashes as DD/MM/YYYY while typing. */
export function formatDdMmYyyyFromInput(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DateInput({
  label,
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  maxIsoDate = '2100-12-31',
  dense,
  mode = 'outlined',
  outlineStyle,
  activeOutlineColor = amraleColors.blue,
  fieldName,
  variant = 'paper',
  icon = 'calendar-outline',
  hasError = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxIsoDate?: string;
  dense?: boolean;
  mode?: React.ComponentProps<typeof TextInput>['mode'];
  outlineStyle?: object;
  activeOutlineColor?: string;
  /** DOM id/name stem; defaults to a slug from `label`. */
  fieldName?: string;
  /** `plain` renders the rounded row used by the admin forms (label comes from `FieldLabel`); `paper` keeps Paper's own input. */
  variant?: 'paper' | 'plain';
  /** Leading icon of the `plain` row. */
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** `plain` only: draws the row in the error colour. */
  hasError?: boolean;
}) {
  const t = useStrings('common');
  const [open, setOpen] = useState(false);

  // Last selectable year: never past `maxIsoDate`, and at most 5 years ahead (generic date field, e.g. joining date).
  const maxYear = Number(maxIsoDate.slice(0, 4)) || 2100;
  const yearsAhead = Math.max(0, Math.min(5, maxYear - new Date().getFullYear()));

  const resolvedFieldName =
    fieldName ?? `date-${label.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'field'}`;

  return (
    <>
      {variant === 'plain' ? (
        <View style={[formInputStyles.inputRow, hasError && formInputStyles.inputRowError]}>
          <MaterialCommunityIcons name={icon} size={20} color={amraleColors.blue} />
          <RNTextInput
            {...formFieldAttrs(resolvedFieldName, { autoComplete: 'birthdate-full' })}
            placeholder={placeholder}
            placeholderTextColor={amraleColors.textSubtle}
            value={value}
            onChangeText={(t) => onChange(formatDdMmYyyyFromInput(t))}
            keyboardType="number-pad"
            style={formInputStyles.inputText}
            accessibilityLabel={label}
          />
          <Pressable
            onPress={() => setOpen(true)}
            hitSlop={4}
            // A full-size touch target (hitSlop alone does not enlarge it on web); the negative margin keeps the icon aligned.
            style={styles.plainPickerBtn}
            accessibilityRole="button"
            accessibilityLabel={t.a11y.pickDateFor(label)}
          >
            <MaterialCommunityIcons name="calendar" size={20} color={amraleColors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <TextInput
          {...formFieldAttrs(resolvedFieldName, { autoComplete: 'birthdate-full' })}
          dense={dense}
          mode={mode}
          label={label}
          placeholder={placeholder}
          value={value}
          onChangeText={(t) => onChange(formatDdMmYyyyFromInput(t))}
          keyboardType="number-pad"
          outlineStyle={[{ borderRadius: 16 }, outlineStyle]}
          activeOutlineColor={activeOutlineColor}
          right={<TextInput.Icon icon="calendar" onPress={() => setOpen(true)} forceTextInputFocus={false} />}
        />
      )}

      {/* Shared JS picker on every platform — see DatePickerModal for why the native picker is not used. */}
      <DatePickerModal
        visible={open}
        value={value}
        yearsAhead={yearsAhead}
        onSelect={onChange}
        onDismiss={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  plainPickerBtn: { width: 40, height: 40, marginRight: -10, alignItems: 'center', justifyContent: 'center' },
});
