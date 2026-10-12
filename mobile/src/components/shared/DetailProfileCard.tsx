import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import {
  amraleRadius,
  amraleSpacing,
  amraleTypography,
  dairyTactileColors,
  tactileCardElevation,
} from '@/src/theme/dairyTactile';
import { useStrings } from '@/src/i18n/useStrings';

export type DetailProfileCardProps = {
  name: string;
  /** Pill beside the name, e.g. "Active Member" or a delivery boy's status. */
  memberBadge: string;
  initials: string;
  /** Secondary line, e.g. "#CUST-C2C6 · +91 99999 99999". */
  subtitle?: string;
  /** Badge icon; defaults to the verified check. */
  badgeIcon?: ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** Accessibility label of the edit button, e.g. "Edit customer". */
  editLabel?: string;
  onEdit: () => void;
  /** Lets the dairy forget this person’s app PIN, so they sign in with their own number again. */
  onResetPin?: () => void;
  resetPinLabel?: string;
};

/**
 * Compact detail-screen header (avatar · name · badge · subtitle · edit) shared by the Customer and Delivery Boy
 * detail screens. It stays pinned above the tabs, so it is a single ~80px row instead of a tall centered card that
 * pushed every tab's content into the lower half of phones.
 */
function DetailProfileCardInner({
  name,
  memberBadge,
  initials,
  subtitle,
  badgeIcon = 'check-decagram',
  editLabel,
  onEdit,
  onResetPin,
  resetPinLabel,
}: DetailProfileCardProps) {
  const t = useStrings('common');
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.memberBadge}>
            <MaterialCommunityIcons name={badgeIcon} size={13} color={dairyTactileColors.onPrimary} />
            <Text style={styles.memberBadgeText}>{memberBadge}</Text>
          </View>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {onResetPin ? (
        <Pressable
          onPress={onResetPin}
          accessibilityRole="button"
          accessibilityLabel={resetPinLabel ?? t.actions.resetPin}
          style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="lock-reset" size={20} color={dairyTactileColors.primaryContainer} />
        </Pressable>
      ) : null}

      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={editLabel ?? t.actions.edit}
        style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="pencil-outline" size={20} color={dairyTactileColors.primaryContainer} />
      </Pressable>
    </View>
  );
}

export const DetailProfileCard = memo(DetailProfileCardInner);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: amraleSpacing.marginMobile,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: amraleRadius.xl,
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    ...tactileCardElevation(),
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: dairyTactileColors.primaryContainer,
    backgroundColor: dairyTactileColors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    color: dairyTactileColors.primaryContainer,
  },
  info: { flex: 1, minWidth: 0, gap: 4 },
  name: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    color: dairyTactileColors.onSurface,
  },
  // Wraps so the id/mobile drops under the badge on narrow phones.
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: 4 },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: amraleRadius.pill,
    backgroundColor: dairyTactileColors.primaryContainer,
  },
  memberBadgeText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: dairyTactileColors.onPrimary,
  },
  subtitle: {
    flexShrink: 1,
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    color: dairyTactileColors.onSurfaceVariant,
  },
  editBtn: {
    width: 44,
    height: 44,
    borderRadius: amraleRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dairyTactileColors.surfaceContainer,
  },
  pressed: { opacity: 0.85 },
});
