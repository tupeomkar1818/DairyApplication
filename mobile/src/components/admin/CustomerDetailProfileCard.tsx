import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import {
  amraleRadius,
  amraleSpacing,
  amraleTypography,
  dairyTactileColors,
  tactileCardElevation,
} from '@/src/theme/dairyTactile';

export type CustomerDetailProfileCardProps = {
  name: string;
  memberBadge: string;
  initials: string;
  onEdit: () => void;
};

function CustomerDetailProfileCardInner({ name, memberBadge, initials, onEdit }: CustomerDetailProfileCardProps) {
  return (
    <View style={styles.card}>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel="Edit customer"
        style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="pencil-outline" size={20} color={dairyTactileColors.primaryContainer} />
      </Pressable>

      <View style={styles.avatarRing}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>

      <View style={styles.memberBadge}>
        <MaterialCommunityIcons name="check-decagram" size={16} color={dairyTactileColors.onPrimary} />
        <Text style={styles.memberBadgeText}>{memberBadge}</Text>
      </View>
    </View>
  );
}

export const CustomerDetailProfileCard = memo(CustomerDetailProfileCardInner);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: amraleSpacing.marginMobile,
    paddingTop: amraleSpacing.lg,
    paddingBottom: amraleSpacing.lg,
    paddingHorizontal: amraleSpacing.md,
    borderRadius: amraleRadius.xl,
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    alignItems: 'center',
    ...tactileCardElevation(),
  },
  editBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: amraleRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dairyTactileColors.surfaceContainer,
  },
  pressed: { opacity: 0.85 },
  avatarRing: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: dairyTactileColors.primaryContainer,
    marginBottom: amraleSpacing.md,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: dairyTactileColors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 28,
    color: dairyTactileColors.primaryContainer,
  },
  name: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 22,
    lineHeight: 28,
    color: dairyTactileColors.onSurface,
    textAlign: 'center',
    marginBottom: amraleSpacing.sm,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: amraleRadius.pill,
    backgroundColor: dairyTactileColors.primaryContainer,
  },
  memberBadgeText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: dairyTactileColors.onPrimary,
  },
});
