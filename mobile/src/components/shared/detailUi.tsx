import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  amraleRadius,
  amraleSpacing,
  amraleTypography,
  dairyTactileColors,
  tactileCardElevation,
} from '@/src/theme/dairyTactile';

/**
 * Presentational pieces shared by the admin detail screens (Customer Details, Delivery Boy Details) so both use the
 * same cards, field rows, status pills, stat tiles and tab pills.
 */

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type DetailPillTone = 'green' | 'red' | 'blue' | 'gray' | 'amber';

export const DETAIL_PILL_TONES: Record<DetailPillTone, { bg: string; fg: string }> = {
  green: { bg: 'rgba(22, 163, 74, 0.12)', fg: '#15803D' },
  red: { bg: 'rgba(225, 29, 72, 0.1)', fg: dairyTactileColors.error },
  blue: { bg: 'rgba(0, 85, 199, 0.1)', fg: dairyTactileColors.primaryContainer },
  gray: { bg: 'rgba(100, 116, 139, 0.14)', fg: dairyTactileColors.onSurfaceVariant },
  amber: { bg: 'rgba(217, 119, 6, 0.12)', fg: '#B45309' },
};

/** White card with an icon tile, a title and an optional action on the right. */
export function DetailSectionCard({
  title,
  icon,
  right,
  children,
  style,
}: {
  title: string;
  icon: IconName;
  right?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHeader}>
        <View style={styles.iconTile}>
          <MaterialCommunityIcons name={icon} size={18} color={dairyTactileColors.primaryContainer} />
        </View>
        <Text style={styles.sectionTitle} numberOfLines={2}>
          {title}
        </Text>
        {right ? <View style={styles.sectionRight}>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}

/** Pill-shaped header action, e.g. the "Edit" link on a section card. */
export function DetailCardAction({ label, icon, onPress }: { label: string; icon?: IconName; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.cardAction, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={16} color={dairyTactileColors.primaryContainer} /> : null}
      <Text style={styles.cardActionText}>{label}</Text>
    </Pressable>
  );
}

/** Wrapper for `DetailInfo` items: one column on phones, two when `wide`. */
export function DetailInfoGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

/** One labelled field. Pass `children` instead of `value` to render a pill or custom content. */
export function DetailInfo({
  label,
  value,
  wide,
  full,
  accent,
  children,
}: {
  label: string;
  value?: string;
  wide: boolean;
  /** Full row even on wide screens (long values such as an address). */
  full?: boolean;
  accent?: boolean;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.info, wide && !full ? styles.infoHalf : styles.infoFull]}>
      <Text style={styles.infoLabel}>{label}</Text>
      {children ?? (
        <Text
          style={[styles.infoValue, value === '—' && styles.infoValueEmpty, accent && styles.infoValueAccent]}
          numberOfLines={4}
        >
          {value}
        </Text>
      )}
    </View>
  );
}

/** Small status pill (Active / Blocked / Paid …). */
export function DetailStatusPill({ tone, label, icon }: { tone: DetailPillTone; label: string; icon?: IconName }) {
  const colors = DETAIL_PILL_TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={14} color={colors.fg} /> : null}
      <Text style={[styles.pillText, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

/** Number tile for the summary rows (present days, net payable …). */
export function DetailStatTile({
  label,
  value,
  tone,
  style,
}: {
  label: string;
  value: string;
  /** Tints the tile and its value, e.g. green for a paid amount. */
  tone?: DetailPillTone;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = tone ? DETAIL_PILL_TONES[tone] : null;
  return (
    <View style={[styles.statTile, colors ? { backgroundColor: colors.bg, borderColor: 'transparent' } : null, style]}>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.statValue, colors ? { color: colors.fg } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Tab pill used by the detail screens' tab strips. */
export function DetailTabPill({
  label,
  active,
  onPress,
  compact,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabPill,
        compact && styles.tabPillCompact,
        active ? styles.tabPillActive : styles.tabPillInactive,
        pressed && styles.pressed,
      ]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tabText, active ? styles.tabTextActive : styles.tabTextInactive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    padding: amraleSpacing.md,
    borderRadius: amraleRadius.lg,
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    gap: 4,
    ...tactileCardElevation(),
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: amraleRadius.md,
    backgroundColor: dairyTactileColors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
    color: dairyTactileColors.onSurface,
  },
  sectionRight: { flexShrink: 0 },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.pill,
    backgroundColor: dairyTactileColors.surfaceContainer,
  },
  cardActionText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 13,
    color: dairyTactileColors.primaryContainer,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 },
  info: {
    paddingVertical: 10,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: dairyTactileColors.outlineVariant,
  },
  infoFull: { width: '100%' },
  // Two columns: half the row minus half the column gap.
  infoHalf: { width: '48%', flexGrow: 1 },
  infoLabel: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: dairyTactileColors.onSurfaceVariant,
  },
  infoValue: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    lineHeight: 21,
    color: dairyTactileColors.onSurface,
  },
  infoValueEmpty: { color: dairyTactileColors.outline, fontFamily: amraleTypography.fontFamily.regular },
  infoValueAccent: { color: dairyTactileColors.primaryContainer },

  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: amraleRadius.pill,
  },
  pillText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13 },

  statTile: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '47%',
    minWidth: 0,
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: amraleRadius.lg,
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
  },
  statLabel: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: dairyTactileColors.onSurfaceVariant,
  },
  statValue: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    color: dairyTactileColors.onSurface,
  },

  tabPill: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: amraleRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tabPillCompact: { paddingHorizontal: 14 },
  tabPillActive: { backgroundColor: dairyTactileColors.primaryContainer, borderColor: dairyTactileColors.primaryContainer },
  tabPillInactive: { backgroundColor: dairyTactileColors.surfaceContainer, borderColor: dairyTactileColors.outlineVariant },
  tabText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14 },
  tabTextActive: { color: dairyTactileColors.onPrimary },
  tabTextInactive: { color: dairyTactileColors.onSurface, opacity: 0.85 },

  pressed: { opacity: 0.85 },
});
