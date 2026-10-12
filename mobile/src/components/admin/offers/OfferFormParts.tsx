import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { toDdMmYyyyFromFlexibleDate, toIsoYmdFromFlexibleDate } from '@/src/components/admin/customerFormDates';
import { OFFER_KIND_ICONS } from '@/src/components/admin/offers/OfferAdminParts';
import type { OfferPackRow } from '@/src/components/admin/offers/offerDraft';
import { DateInput } from '@/src/components/DateInput';
import { FieldError, FieldLabel } from '@/src/components/shared/formFields';
import { OFFER_KINDS, type OfferKind } from '@/src/domain/offers/entities';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

/** Pieces of the offer form (`app/(admin)/offer-edit.tsx`). */

/** The four kinds as cards with their hint; two across on a phone. */
export function OfferKindPicker({ value, onChange }: { value: OfferKind; onChange: (kind: OfferKind) => void }) {
  const t = useStrings('offers');
  return (
    <View style={styles.kindGrid}>
      {OFFER_KINDS.map((kind) => {
        const selected = kind === value;
        return (
          <Pressable
            key={kind}
            onPress={() => onChange(kind)}
            style={({ pressed }) => [styles.kindCard, selected && styles.kindCardSelected, pressed && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={t.kinds[kind]}
          >
            <View style={styles.kindTop}>
              <MaterialCommunityIcons name={OFFER_KIND_ICONS[kind]} size={22} color={selected ? amraleColors.white : amraleColors.blue} />
              {selected ? <MaterialCommunityIcons name="check-circle" size={18} color={amraleColors.white} /> : null}
            </View>
            <Text style={[styles.kindName, selected && styles.kindTextSelected]}>{t.kinds[kind]}</Text>
            <Text style={[styles.kindHint, selected && styles.kindTextSelected]}>{t.kindHints[kind]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A day field in YYYY-MM-DD that still lets the admin type DD/MM/YYYY: the half-typed text stays in the box while
 * the offer sees '' until the date is whole. The calendar is the shared `DatePickerModal` (inside `DateInput`).
 */
export function OfferDateField({
  label,
  value,
  onChange,
  fieldName,
  hasError,
}: {
  label: string;
  value: string;
  onChange: (ymd: string) => void;
  fieldName: string;
  hasError?: boolean;
}) {
  const [text, setText] = useState(() => toDdMmYyyyFromFlexibleDate(value));

  useEffect(() => {
    // Follow a change from outside (cleared, copied), but not our own half-typed text.
    setText((current) => ((toIsoYmdFromFlexibleDate(current) ?? '') === value ? current : toDdMmYyyyFromFlexibleDate(value)));
  }, [value]);

  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <DateInput
        label={label}
        variant="plain"
        fieldName={fieldName}
        value={text}
        hasError={hasError}
        onChange={(next) => {
          setText(next);
          onChange(toIsoYmdFromFlexibleDate(next) ?? '');
        }}
      />
    </View>
  );
}

/** A bordered row for one pack on the offer, with a remove button. */
export function OfferPackRowCard({
  row,
  onRemove,
  children,
}: {
  row: OfferPackRow;
  onRemove: () => void;
  children: ReactNode;
}) {
  const t = useStrings('offerAdmin').form;
  const name = `${row.productName} ${row.packLabel}`;
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowHead}>
        <Text style={styles.rowName}>{name}</Text>
        <Pressable
          onPress={onRemove}
          hitSlop={6}
          style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t.remove(name)}
        >
          <MaterialCommunityIcons name="close" size={18} color={amraleColors.error} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

/** − n + for a combo pack's quantity. */
export function OfferQuantityStepper({ name, value, onChange }: { name: string; value: string; onChange: (next: string) => void }) {
  const t = useStrings('offerAdmin').form;
  const n = Math.max(0, Math.floor(Number(value) || 0));
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>{t.quantity}</Text>
      <View style={styles.stepControls}>
        <Pressable
          onPress={() => onChange(String(Math.max(1, n - 1)))}
          disabled={n <= 1}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed, n <= 1 && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={t.decrease(name)}
        >
          <MaterialCommunityIcons name="minus" size={18} color={amraleColors.text} />
        </Pressable>
        <Text style={styles.stepValue}>{n}</Text>
        <Pressable
          onPress={() => onChange(String(Math.min(99, n + 1)))}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t.increase(name)}
        >
          <MaterialCommunityIcons name="plus" size={18} color={amraleColors.text} />
        </Pressable>
      </View>
    </View>
  );
}

/** Problems for one part of the form, one line each. */
export function OfferProblems({ messages }: { messages: readonly string[] }) {
  if (!messages.length) return null;
  return (
    <View style={styles.problems} accessibilityLiveRegion="polite">
      {messages.map((m) => (
        <FieldError key={m} message={m} />
      ))}
    </View>
  );
}

/** Small "Add pack"-style button with an icon. */
export function OfferAddButton({ label, icon, onPress }: { label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialCommunityIcons name={icon} size={20} color={amraleColors.blue} />
      <Text style={styles.addBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kindGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kindCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '46%',
    minWidth: 120,
    gap: 4,
    padding: 12,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
  },
  kindCardSelected: { backgroundColor: amraleColors.blue, borderColor: amraleColors.blue },
  kindTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kindName: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.text },
  kindHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, lineHeight: 17, color: amraleColors.textMuted },
  kindTextSelected: { color: amraleColors.white },
  field: { gap: 6 },
  rowCard: {
    gap: 8,
    padding: 12,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.inputBgLight,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
  },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stepLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },
  stepControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: amraleRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
  },
  stepValue: { minWidth: 28, textAlign: 'center', fontFamily: amraleTypography.fontFamily.bold, fontSize: 17, color: amraleColors.text },
  problems: { gap: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: amraleColors.blue,
    backgroundColor: 'rgba(0, 85, 199, 0.04)',
  },
  addBtnText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.blue },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});
