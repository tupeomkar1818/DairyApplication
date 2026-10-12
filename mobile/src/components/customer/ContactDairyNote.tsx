import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dayLabel } from '@/src/components/customer/customerUi';
import { orderCutoffLabel } from '@/src/domain/customers/daySchedule';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

/**
 * Shown where a day is closed by the evening cut-off: the customer can no longer change it in the app, but the dairy
 * can — so the note says so and opens the chat with the request already written, or the contact page to call.
 */
export function ContactDairyNote({
  dayYmd,
  message,
  compact,
  onBeforeNavigate,
}: {
  /** The closed day, used for the default text and the chat message. */
  dayYmd?: string;
  message?: string;
  /** A single line with the chat link, for inside a day card. */
  compact?: boolean;
  /** Close a sheet first, so the chat does not open underneath it. */
  onBeforeNavigate?: () => void;
}) {
  const t = useStrings('customer').contactDairy;
  const cutoff = orderCutoffLabel();
  const day = dayYmd ? dayLabel(dayYmd, { weekday: true }) : '';
  const text = message ?? (day ? t.closedFor(day, cutoff) : t.closed(cutoff));

  const openChat = () => {
    onBeforeNavigate?.();
    router.push({
      pathname: '/(customer)/chat',
      params: { message: day ? t.chatMessageFor(day) : t.chatMessage },
    });
  };
  const openContact = () => {
    onBeforeNavigate?.();
    router.push('/(auth)/contact-admin');
  };

  if (compact) {
    return (
      <View style={styles.compact}>
        <MaterialCommunityIcons name="lock-clock" size={14} color={AMBER_FG} />
        <Text style={styles.compactText}>{day ? t.compactFor(day, cutoff) : t.compact(cutoff)}</Text>
        <Pressable onPress={openChat} hitSlop={6} accessibilityRole="link" accessibilityLabel={t.compactLinkA11y(day || t.thisDay)}>
          <Text style={styles.link}>{t.compactLink}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <View style={styles.head}>
        <MaterialCommunityIcons name="lock-clock" size={20} color={AMBER_FG} />
        <Text style={styles.text}>{text}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={openChat}
          style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t.chatA11y}
        >
          <MaterialCommunityIcons name="chat-processing-outline" size={16} color={amraleColors.white} />
          <Text style={styles.btnPrimaryText}>{t.chat}</Text>
        </Pressable>
        <Pressable
          onPress={openContact}
          style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t.callA11y}
        >
          <MaterialCommunityIcons name="phone-outline" size={16} color={AMBER_FG} />
          <Text style={styles.btnSecondaryText}>{t.call}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const AMBER_FG = '#8a5300';

const styles = StyleSheet.create({
  box: {
    gap: 10,
    padding: 12,
    borderRadius: amraleRadius.md,
    backgroundColor: '#fff4e0',
    borderWidth: 1,
    borderColor: '#f6d9a6',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  text: { flex: 1, fontFamily: amraleTypography.fontFamily.medium, fontSize: 14, lineHeight: 20, color: '#5c3a00' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    flexGrow: 1,
    flexBasis: 130,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.pill,
  },
  btnPrimary: { backgroundColor: AMBER_FG },
  btnPrimaryText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.white },
  btnSecondary: { backgroundColor: amraleColors.white, borderWidth: 1, borderColor: '#f6d9a6' },
  btnSecondaryText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: AMBER_FG },
  compact: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  compactText: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  link: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12, color: amraleColors.blue, textDecorationLine: 'underline' },
  pressed: { opacity: 0.88 },
});
