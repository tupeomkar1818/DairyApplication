import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

/** The app-bar bell, with an unread count — the same control on the admin, delivery and customer home screens. */
export function NotificationBell({
  unread,
  onPress,
  color = amraleColors.text,
  size = 22,
}: {
  unread: number;
  onPress: () => void;
  color?: string;
  size?: number;
}) {
  const t = useStrings('inbox').bell;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={unread ? t.labelUnread(unread) : t.label}
    >
      <MaterialCommunityIcons name="bell-outline" size={size} color={color} />
      {unread ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, borderRadius: amraleRadius.md, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.78 },
  badge: {
    position: 'absolute',
    top: 6,
    right: 5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: amraleRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: amraleColors.error,
    borderWidth: 1.5,
    borderColor: amraleColors.white,
  },
  badgeText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 10, lineHeight: 12, color: amraleColors.white },
});
