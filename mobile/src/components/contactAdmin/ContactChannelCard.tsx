import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ContactChannel } from '@/src/domain/contactAdmin/entities';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

const ICONS: Record<ContactChannel['type'], keyof typeof MaterialCommunityIcons.glyphMap> = {
  call: 'phone',
  whatsapp: 'whatsapp',
  email: 'email-outline',
};

type Props = {
  channel: ContactChannel;
};

export function ContactChannelCard({ channel }: Props) {
  return (
    <Pressable
      onPress={() => Linking.openURL(channel.actionUri)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${channel.label}: ${channel.value}`}
    >
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name={ICONS[channel.type]} size={22} color={amraleColors.blue} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.label}>{channel.label}</Text>
        <Text style={styles.value}>{channel.value}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: amraleSpacing.md,
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.xl,
    padding: amraleSpacing.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    shadowColor: amraleColors.cardShadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: amraleColors.inputBgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
  label: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: amraleColors.blue,
    marginBottom: 4,
  },
  value: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 17,
    color: amraleColors.text,
  },
  pressed: { opacity: 0.88 },
});
