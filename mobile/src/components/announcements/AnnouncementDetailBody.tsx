import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnnouncementMedia } from '@/src/components/announcements/AnnouncementMedia';
import { ANNOUNCEMENT_LOOK } from '@/src/components/announcements/announcementLook';
import { CustomerCard, CustomerRow } from '@/src/components/customer/customerUi';
import type { Announcement } from '@/src/domain/announcements/entities';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDateTime, formatDay } from '@/src/utils/format';

/** One announcement in full: picture or video, the message, and who sent it when. Shared by customer and admin. */
export function AnnouncementDetailBody({
  announcement: a,
  title,
  message,
  extraRows,
  children,
}: {
  announcement: Announcement;
  title: string;
  message: string;
  /** More detail rows, e.g. the admin's recipients and read count. */
  extraRows?: ReactNode;
  /** Actions under the details. */
  children?: ReactNode;
}) {
  const lang = useLanguage();
  const inbox = useStrings('inbox');
  const t = inbox.announcements;
  const look = ANNOUNCEMENT_LOOK[a.category];
  return (
    <>
      <CustomerCard style={styles.hero}>
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: look.bg }]}>
            <MaterialCommunityIcons name={look.icon} size={24} color={look.fg} />
          </View>
          <View style={[styles.chip, { backgroundColor: look.bg }]}>
            <Text style={[styles.chipText, { color: look.fg }]}>{t.categories[a.category] ?? a.category}</Text>
          </View>
        </View>
        {a.media ? <AnnouncementMedia media={a.media} height={260} /> : null}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.message} selectable>
          {message}
        </Text>
      </CustomerCard>

      <CustomerCard>
        <CustomerRow
          label={t.from}
          value={a.source === 'delivery' ? a.senderName ?? t.yourDeliveryPartner : inbox.dairyName}
        />
        <CustomerRow label={t.sent} value={formatDateTime(a.createdAt, lang)} />
        {a.dateYmd ? (
          <CustomerRow label={t.forDay} value={formatDay(a.dateYmd, { weekday: true, year: true, lang })} />
        ) : null}
        {extraRows}
      </CustomerCard>

      {children ? <View style={styles.actions}>{children}</View> : null}
    </>
  );
}

const styles = StyleSheet.create({
  hero: { gap: amraleSpacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: amraleRadius.pill },
  chipText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12 },
  title: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 20, lineHeight: 26, color: amraleColors.text },
  message: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 15, lineHeight: 23, color: amraleColors.text },
  actions: { gap: amraleSpacing.sm },
});
