import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Menu } from 'react-native-paper';

import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { formFieldAttrs } from '@/src/theme/platformStyles';
import { useStrings } from '@/src/i18n/useStrings';

/**
 * Controls bar and list states shared by the admin list screens (Products, Customers, Delivery Boys), so all three
 * search, sort, filter and report counts the same way.
 */

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type AdminListSortOption<T extends string> = {
  key: T;
  /** Full label in the menu, e.g. "Name (A to Z)". */
  label: string;
  /** Short label on the button for tablets/desktops, e.g. "A to Z". */
  short: string;
  icon: IconName;
};

export type AdminListFilterChip<T extends string> = {
  key: T;
  label: string;
  count: number;
};

export function AdminListControls<S extends string, F extends string>({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchFieldName,
  sortOptions,
  sortBy,
  onSortChange,
  chips,
  activeChip,
  onChipChange,
  summaryText,
  addLabel,
  onAdd,
  isMobile,
  containerStyle,
}: {
  searchValue: string;
  onSearchChange: (next: string) => void;
  searchPlaceholder: string;
  /** DOM id/name stem for the search box on web. */
  searchFieldName: string;
  /** Omit the three sort props on a screen that has nothing to sort by. */
  sortOptions?: readonly AdminListSortOption<S>[];
  sortBy?: S;
  onSortChange?: (next: S) => void;
  chips: readonly AdminListFilterChip<F>[];
  activeChip: F;
  onChipChange: (next: F) => void;
  /** e.g. "8 products · 6 active" or "Showing 3 of 8". */
  summaryText: string;
  /** Omit both to hide the add button (e.g. a read-only screen). */
  addLabel?: string;
  onAdd?: () => void;
  isMobile: boolean;
  /** Centered column style from `useAdminListGrid`. */
  containerStyle: object;
}) {
  const t = useStrings('common');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const currentSort = sortOptions?.find((o) => o.key === sortBy) ?? sortOptions?.[0];

  const addButton =
    addLabel && onAdd ? (
      <Pressable onPress={onAdd} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]} accessibilityRole="button">
        <MaterialCommunityIcons name="plus" size={18} color={amraleColors.white} />
        <Text style={styles.addBtnText}>{addLabel}</Text>
      </Pressable>
    ) : null;

  const chipRow = chips.map((chip) => {
    const selected = activeChip === chip.key;
    return (
      <Pressable
        key={chip.key}
        onPress={() => onChipChange(chip.key)}
        style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{chip.label}</Text>
        <Text style={[styles.chipCount, selected && styles.chipCountSelected]}>{chip.count}</Text>
      </Pressable>
    );
  });

  return (
    <View style={[styles.controls, containerStyle]}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color={amraleColors.textSubtle} />
          <TextInput
            {...formFieldAttrs(searchFieldName, { autoComplete: 'off' })}
            value={searchValue}
            onChangeText={onSearchChange}
            placeholder={searchPlaceholder}
            placeholderTextColor={amraleColors.textSubtle}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchValue ? (
            <Pressable onPress={() => onSearchChange('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.a11y.clearSearch}>
              <MaterialCommunityIcons name="close-circle" size={18} color={amraleColors.textSubtle} />
            </Pressable>
          ) : null}
        </View>

        {currentSort && sortOptions ? (
          <Menu
          visible={sortMenuOpen}
          onDismiss={() => setSortMenuOpen(false)}
          anchor={
            <Pressable
              onPress={() => setSortMenuOpen(true)}
              style={({ pressed }) => [styles.sortBtn, !isMobile && styles.sortBtnWide, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Sort: ${currentSort.label}`}
            >
              <MaterialCommunityIcons name={currentSort.icon} size={20} color={amraleColors.blue} />
              {/* Phones show the icon only so search keeps the width. */}
              {isMobile ? null : <Text style={styles.sortBtnText}>{currentSort.short}</Text>}
            </Pressable>
          }
        >
          {sortOptions.map((o) => (
            <Menu.Item
              key={o.key}
              title={o.label}
              leadingIcon={o.icon}
              trailingIcon={o.key === sortBy ? 'check' : undefined}
              onPress={() => {
                onSortChange?.(o.key);
                setSortMenuOpen(false);
              }}
            />
          ))}
          </Menu>
        ) : null}

        {isMobile ? null : addButton}
      </View>

      {isMobile ? (
        <>
          <View style={styles.metaRow}>
            <Text style={styles.summary} numberOfLines={2}>
              {summaryText}
            </Text>
            {addButton}
          </View>
          {/* Wrapped, not a sideways scroller: on a phone the last filters sat off-screen behind a swipe.
              No flex: 1 here — in this column it collapses the row to zero height on iOS/Android and the list covers the chips. */}
          <View style={[styles.chipRow, styles.chipRowWrapColumn]}>{chipRow}</View>
        </>
      ) : (
        <View style={styles.metaRow}>
          <View style={[styles.chipRow, styles.chipRowWrap]}>{chipRow}</View>
          <Text style={styles.summary} numberOfLines={1}>
            {summaryText}
          </Text>
        </View>
      )}
    </View>
  );
}

/** Empty list (nothing yet, or nothing matching the filters). */
export function AdminListEmptyState({
  icon,
  title,
  text,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  text: string;
  /** Omit both to show the message without a button (e.g. an empty section inside a detail card). */
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons name={icon} size={40} color={amraleColors.textSubtle} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={({ pressed }) => [styles.emptyBtn, pressed && styles.pressed]} accessibilityRole="button">
          <Text style={styles.emptyBtnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The list could not be loaded at all. */
export function AdminListErrorState({ title, onRetry }: { title: string; onRetry: () => void }) {
  const t = useStrings('common');
  return (
    <View style={styles.centered}>
      <MaterialCommunityIcons name="cloud-alert-outline" size={40} color={amraleColors.textSubtle} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Pressable onPress={onRetry} style={({ pressed }) => [styles.emptyBtn, pressed && styles.pressed]} accessibilityRole="button">
        <Text style={styles.emptyBtnText}>{t.actions.retryShort}</Text>
      </Pressable>
    </View>
  );
}

/** Round icon button used for the per-card actions (call / edit / delete). */
export function AdminListIconButton({
  icon,
  label,
  tone,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  tone: 'blue' | 'green' | 'red';
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = ICON_TONES[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.iconCircle, { backgroundColor: disabled ? DISABLED_TONE.bg : colors.bg }]}>
        <MaterialCommunityIcons name={icon} size={18} color={disabled ? DISABLED_TONE.fg : colors.fg} />
      </View>
    </Pressable>
  );
}

const ICON_TONES = {
  blue: { bg: amraleColors.inputBgLight, fg: amraleColors.blue },
  green: { bg: 'rgba(22, 163, 74, 0.12)', fg: '#15803D' },
  red: { bg: 'rgba(186, 26, 26, 0.10)', fg: amraleColors.error },
} as const;

const DISABLED_TONE = { bg: 'rgba(100, 116, 139, 0.10)', fg: amraleColors.textSubtle } as const;

/** Card chrome shared by the list cards, so every list card has the same surface, radius and shadow. */
export const adminListCardStyles = StyleSheet.create({
  card: {
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.lg,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.06)',
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardDimmed: { opacity: 0.72 },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
  name: { flexShrink: 1, fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: 4 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: amraleColors.textMuted,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: amraleRadius.pill },
  badgeText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 11, lineHeight: 15 },
  iconCol: { gap: 6 },
  iconRow: { flexDirection: 'row', gap: 6 },
});

const styles = StyleSheet.create({
  controls: {
    paddingHorizontal: amraleSpacing.md,
    paddingTop: amraleSpacing.md,
    paddingBottom: amraleSpacing.md,
    gap: 12,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
    color: amraleColors.text,
    paddingVertical: 10,
  },
  sortBtn: {
    minWidth: 48,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  sortBtnWide: { paddingHorizontal: 14 },
  sortBtnText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.text },
  addBtn: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.blue,
    shadowColor: amraleColors.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  addBtnText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 13, color: amraleColors.white },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summary: { flexShrink: 1, fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipRowWrap: { flex: 1, minWidth: 0, flexWrap: 'wrap' },
  chipRowWrapColumn: { flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  chipSelected: { backgroundColor: amraleColors.blue, borderColor: amraleColors.blue },
  chipText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.text },
  chipTextSelected: { color: amraleColors.white },
  chipCount: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: amraleRadius.pill,
    overflow: 'hidden',
    textAlign: 'center',
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 11,
    color: amraleColors.textMuted,
    backgroundColor: amraleColors.inputBgLight,
  },
  chipCountSelected: { color: amraleColors.white, backgroundColor: 'rgba(255, 255, 255, 0.22)' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: amraleSpacing.lg },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 48 },
  emptyTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text, textAlign: 'center' },
  emptyText: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted, textAlign: 'center' },
  emptyBtn: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: amraleRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: amraleColors.blue,
  },
  emptyBtnText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.white },

  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 34, height: 34, borderRadius: amraleRadius.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.88 },
});
