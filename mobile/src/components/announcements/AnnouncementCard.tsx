import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AnnouncementMedia } from '@/src/components/announcements/AnnouncementMedia';
import { ANNOUNCEMENT_LOOK } from '@/src/components/announcements/announcementLook';
import { CustomerCard } from '@/src/components/customer/customerUi';
import type { Announcement } from '@/src/domain/announcements/entities';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDateTime } from '@/src/utils/format';

/** One announcement in a list — the same row in the customer's Announcements and the admin's sent list. */
export function AnnouncementCard({
  announcement: a,
  title,
  message,
  unread,
  footer,
  onPress,
}: {
  announcement: Announcement;
  /** Already personalized for the reader. */
  title: string;
  message: string;
  unread?: boolean;
  /** Extra line under the message, e.g. "Sent to 12 · 8 read". */
  footer?: ReactNode;
  onPress: () => void;
}) {
  const lang = useLanguage();
  const t = useStrings('inbox').announcements;
  const look = ANNOUNCEMENT_LOOK[a.category];
  const label = t.categories[a.category] ?? a.category;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t.cardLabel(label, title, !!unread)}
    >
      <CustomerCard style={[styles.card, unread && styles.unread]}>
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: look.bg }]}>
            <MaterialCommunityIcons name={look.icon} size={20} color={look.fg} />
          </View>
          <View style={[styles.chip, { backgroundColor: look.bg }]}>
            <Text style={[styles.chipText, { color: look.fg }]}>{label}</Text>
          </View>
          <View style={styles.spacer} />
          {unread ? (
            <View style={styles.newPill}>
              <Text style={styles.newText}>{t.newBadge}</Text>
            </View>
          ) : null}
        </View>

        {a.media ? <AnnouncementMedia media={a.media} preview height={150} /> : null}

        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.message} numberOfLines={3}>
          {message}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta} numberOfLines={1}>
            {a.source === 'delivery' ? (a.senderName ? t.fromSender(a.senderName) : t.fromYourDeliveryPartner) : t.fromDairy} ·{' '}
            {formatDateTime(a.createdAt, lang)}
          </Text>
        </View>
        {footer}
      </CustomerCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  unread: { borderColor: 'rgba(37, 99, 235, 0.35)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: amraleRadius.pill },
  chipText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12 },
  spacer: { flex: 1 },
  newPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: amraleRadius.pill, backgroundColor: amraleColors.blue },
  newText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 11, color: amraleColors.white },
  title: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, lineHeight: 22, color: amraleColors.text },
  message: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 20, color: amraleColors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  meta: { flex: 1, fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textSubtle },
  pressed: { opacity: 0.88 },
});
