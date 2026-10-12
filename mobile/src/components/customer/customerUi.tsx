import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { toDdMmYyyyFromFlexibleDate, toIsoYmdFromFlexibleDate } from '@/src/components/admin/customerFormDates';
import { DateInput } from '@/src/components/DateInput';
import { ResponsiveContainer } from '@/src/components/shared/ResponsiveContainer';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { RESPONSIVE, useResponsiveLayout } from '@/src/utils/responsiveLayout';
import { formatDay, formatMoney } from '@/src/utils/format';

/**
 * Shell and building blocks for the customer app, so every screen wears the same chrome: a back bar, a centred
 * column that widens on a laptop, and one card style. The delivery app has the same arrangement; keeping them
 * alike means a fix to spacing or safe areas is made once per app, not once per screen.
 */

/** Below this the screens are one column; above, they lay out side by side. */
const CUSTOMER_WIDE_MIN = 900;

export function useCustomerLayout(): { isWide: boolean; variant: 'list' | 'form' } {
  const { width } = useResponsiveLayout();
  const isWide = width >= CUSTOMER_WIDE_MIN;
  return { isWide, variant: isWide ? 'list' : 'form' };
}

export function goBackToCustomerHome(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/(customer)');
}

export function CustomerScreen({
  title,
  right,
  children,
  contentStyle,
  onBack,
}: {
  title: string;
  /** Optional trailing control in the app bar, e.g. a filter or a badge. */
  right?: ReactNode;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** Where the back arrow goes; the customer home when omitted. */
  onBack?: () => void;
}) {
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const { variant } = useCustomerLayout();
  const t = useStrings('customer');

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: headerPaddingTop }]}>
        <ResponsiveContainer variant={variant} style={styles.appBarRow}>
          <Pressable
            onPress={onBack ?? goBackToCustomerHome}
            hitSlop={6}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t.shell.goBack}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={amraleColors.blue} />
          </Pressable>
          <Text style={styles.appBarTitle} numberOfLines={1}>
            {title}
          </Text>
          {right}
        </ResponsiveContainer>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: scrollPaddingBottom(amraleSpacing.xl) }}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContainer variant={variant} style={[styles.body, contentStyle]}>
          {children}
        </ResponsiveContainer>
      </ScrollView>
    </View>
  );
}

export function CustomerCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CustomerCardHeader({
  icon,
  title,
  right,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.cardHeader}>
      <MaterialCommunityIcons name={icon} size={20} color={amraleColors.blue} />
      <Text style={styles.cardTitle} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

export function CustomerRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.rowLabelStrong]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]}>{value}</Text>
    </View>
  );
}

export function CustomerPrimaryButton({
  label,
  icon,
  onPress,
  disabled,
  busy,
  style,
}: {
  label: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [styles.primaryBtn, style, pressed && styles.pressed, (disabled || busy) && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? (
        <ActivityIndicator color={amraleColors.white} size="small" />
      ) : (
        <>
          {icon ? <MaterialCommunityIcons name={icon} size={18} color={amraleColors.white} /> : null}
          <Text style={styles.primaryBtnText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function CustomerSecondaryButton({
  label,
  onPress,
  disabled,
  tone = 'default',
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.secondaryBtn, style, pressed && styles.pressed, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.secondaryBtnText, tone === 'danger' && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

export function CustomerChoiceChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  label?: string;
}) {
  return (
    <View style={styles.chipBlock}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.chipRow}>
        {options.map((o) => {
          const selected = o.key === value;
          return (
            <Pressable
              key={o.key}
              onPress={() => onChange(o.key)}
              style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function CustomerStepper({
  label,
  value,
  onChange,
  min = 1,
  max = 20,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}) {
  const t = useStrings('customer');
  return (
    <View style={styles.chipBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed, value <= min && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={t.shell.decrease(label)}
        >
          <MaterialCommunityIcons name="minus" size={20} color={amraleColors.text} />
        </Pressable>
        <Text style={styles.stepValue}>{value}</Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed, value >= max && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={t.shell.increase(label)}
        >
          <MaterialCommunityIcons name="plus" size={20} color={amraleColors.text} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * A focused panel for one change: slides up from the bottom on a phone, sits centred on a wide screen. Keeps each
 * change (quantity, dates, pause, stop) to a short form of its own instead of every form on the page at once.
 */
export function CustomerSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { isWide } = useCustomerLayout();
  const { bottom } = useScreenSafeInsets();
  const c = useStrings('common');
  return (
    <Modal visible={visible} transparent animationType={isWide ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={[styles.sheetBackdrop, isWide && styles.sheetBackdropWide]} onPress={onClose} accessibilityLabel={c.actions.close}>
        <Pressable
          style={[styles.sheet, isWide ? styles.sheetWide : { paddingBottom: 16 + bottom }]}
          onPress={() => undefined}
          accessible={false}
        >
          <View style={styles.sheetHead}>
            <View style={styles.sheetTitles}>
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {title}
              </Text>
              {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={c.actions.close}
            >
              <MaterialCommunityIcons name="close" size={22} color={amraleColors.textMuted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * A date field that speaks YYYY-MM-DD: the app's date picker works in DD/MM/YYYY, and every customer rule (cut-off,
 * skips, subscription dates) works in ISO days.
 */
export function CustomerDateField({
  label,
  value,
  onChange,
  fieldName,
}: {
  label: string;
  /** YYYY-MM-DD, or '' when nothing is chosen. */
  value: string;
  onChange: (nextYmd: string) => void;
  fieldName: string;
}) {
  return (
    <View style={styles.chipBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <DateInput
        label={label}
        variant="plain"
        fieldName={fieldName}
        value={value ? toDdMmYyyyFromFlexibleDate(value) : ''}
        onChange={(ddmmyyyy) => onChange(toIsoYmdFromFlexibleDate(ddmmyyyy) ?? '')}
      />
    </View>
  );
}

export function CustomerStateBlock({
  icon,
  title,
  text,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.centered}>
      <MaterialCommunityIcons name={icon} size={40} color={amraleColors.textSubtle} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
      {actionLabel && onAction ? <CustomerPrimaryButton label={actionLabel} onPress={onAction} style={styles.emptyBtn} /> : null}
    </View>
  );
}

export function CustomerLoading() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={amraleColors.blue} size="large" />
    </View>
  );
}

/** Shown when the signed-in mobile number has no customer record. */
export function CustomerNotLinked() {
  const t = useStrings('customer');
  return (
    <CustomerStateBlock icon="account-question-outline" title={t.shell.notLinkedTitle} text={t.shell.notLinkedText} />
  );
}

/** "₹1,586" — the shared money format (see `src/utils/format`). */
export function money(amount: number): string {
  return formatMoney(amount);
}

/** "16 Sep" / "Wed, 16 Sep" — the shared day format (see `src/utils/format`). */
export function dayLabel(ymd: string, options?: { weekday?: boolean }): string {
  return formatDay(ymd, options);
}

export const CUSTOMER_WIDE_BREAKPOINT = CUSTOMER_WIDE_MIN;
export const CUSTOMER_TABLET_MIN = RESPONSIVE.tabletMin;

export const customerStyles = StyleSheet.create({
  cardGap: { gap: 12 },
  rowWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  half: { flex: 1, minWidth: 0 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: amraleColors.surface },
  appBar: {
    paddingBottom: amraleSpacing.sm,
    backgroundColor: amraleColors.white,
    borderBottomWidth: 1,
    borderBottomColor: amraleColors.inputBorderLight,
  },
  appBarRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: amraleSpacing.md },
  appBarTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    color: amraleColors.blue,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: amraleSpacing.md, paddingTop: amraleSpacing.md, gap: 12 },

  card: {
    gap: 6,
    padding: 14,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    color: amraleColors.text,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    color: amraleColors.textMuted,
  },
  rowLabelStrong: { fontFamily: amraleTypography.fontFamily.semiBold, color: amraleColors.text },
  rowValue: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  rowValueStrong: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.blue },

  fieldLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },
  chipBlock: { gap: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  chipSelected: { backgroundColor: amraleColors.blue, borderColor: amraleColors.blue },
  chipText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  chipTextSelected: { color: amraleColors.white },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: amraleRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
  },
  stepValue: {
    minWidth: 32,
    textAlign: 'center',
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    color: amraleColors.text,
  },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.blue,
  },
  primaryBtnText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.white },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
  },
  secondaryBtnText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  dangerText: { color: amraleColors.error },

  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheetBackdropWide: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: {
    maxHeight: '88%',
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: amraleColors.white,
  },
  sheetWide: { width: '100%', maxWidth: 480, borderRadius: 22, paddingBottom: 16 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  sheetTitles: { flex: 1, minWidth: 0, paddingTop: 8, gap: 2 },
  sheetTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.text },
  sheetSubtitle: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },
  sheetBody: { gap: 14, paddingBottom: 4 },

  centered: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    color: amraleColors.text,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    color: amraleColors.textMuted,
    textAlign: 'center',
  },
  emptyBtn: { marginTop: 8 },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.5 },
});
