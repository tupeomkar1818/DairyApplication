import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { ContactChannel } from '@/src/domain/contactAdmin/entities';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleSpacing, amraleTypography, dairyTactileColors } from '@/src/theme/dairyTactile';

type ChannelLook = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  fg: string;
  bg: string;
};

/** Each way of reaching the dairy has its own colour, so the rows are told apart at a glance. */
const LOOK: Record<ContactChannel['type'], ChannelLook> = {
  call: { icon: 'phone', fg: amraleColors.blue, bg: dairyTactileColors.surfaceContainer },
  whatsapp: { icon: 'whatsapp', fg: '#128C4A', bg: '#DDF5E6' },
  email: { icon: 'email-outline', fg: '#9A4F00', bg: '#FFEBD2' },
  website: { icon: 'web', fg: '#0F766E', bg: '#DDF3F0' },
};

/** "+91 99224 43636" from a wa.me link, so the WhatsApp row shows a number rather than just "Chat Now". */
export function whatsappNumberFromUri(uri: string): string | null {
  const digits = String(uri ?? '').match(/wa\.me\/(\d+)/)?.[1];
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return `+${digits}`;
}

function displayValue(channel: ContactChannel): string {
  if (channel.type === 'whatsapp' && /^chat now$/i.test(channel.value.trim())) {
    return whatsappNumberFromUri(channel.actionUri) ?? channel.value;
  }
  return channel.value;
}

type Props = {
  channel: ContactChannel;
  /** Draws a separator above the row (every row but the first in a list). */
  divider?: boolean;
};

export function ContactChannelCard({ channel, divider }: Props) {
  const t = useStrings('help');
  const look = LOOK[channel.type];
  const title = t.contact.channels[channel.type];
  const value = displayValue(channel);
  // Small phones: the row's whole width goes to the value, so "support@amraledairy.com" stays on one line.
  const narrow = useWindowDimensions().width < 360;

  return (
    <Pressable
      onPress={() => void Linking.openURL(channel.actionUri).catch(() => undefined)}
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}
      accessibilityRole={channel.type === 'website' ? 'link' : 'button'}
      accessibilityLabel={t.contact.channelLabel(title, value)}
      accessibilityHint={t.contact.hints[channel.type]}
    >
      <View style={[styles.iconWrap, { backgroundColor: look.bg }]}>
        <MaterialCommunityIcons name={look.icon} size={22} color={look.fg} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.value, narrow && channel.type === 'email' && styles.valueSmall]} numberOfLines={2} selectable>
          {value}
        </Text>
      </View>
      {/* A small arrow rather than a button label: the value gets the width, so an email address never breaks. */}
      {narrow ? null : (
        <MaterialCommunityIcons name="chevron-right" size={24} color={amraleColors.textSubtle} style={styles.chevron} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: amraleSpacing.md,
    minHeight: 72,
    paddingHorizontal: amraleSpacing.md,
    paddingVertical: 12,
    backgroundColor: amraleColors.white,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: dairyTactileColors.outlineVariant,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0, gap: 2 },
  title: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    color: amraleColors.textMuted,
  },
  value: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    lineHeight: 21,
    color: amraleColors.text,
  },
  valueSmall: { fontSize: 13.5 },
  chevron: { flexShrink: 0, marginRight: -6 },
  pressed: { backgroundColor: dairyTactileColors.surfaceContainerLow },
});
