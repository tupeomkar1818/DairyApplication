import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  CustomerCard,
  CustomerLoading,
  CustomerPrimaryButton,
  CustomerRow,
  CustomerScreen,
  CustomerSecondaryButton,
  CustomerStateBlock,
} from '@/src/components/customer/customerUi';
import { notificationLook } from '@/src/components/notifications/notificationLook';
import type { AppNotification } from '@/src/domain/notifications/entities';
import { notificationText } from '@/src/domain/notifications/notificationText';
import { useNotifications } from '@/src/hooks/notifications/useNotifications';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import type { NotificationAddress } from '@/src/infrastructure/notificationsStore';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDateTime, formatDay, formatMonth } from '@/src/utils/format';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Where a notification can take its reader next, e.g. "Open My days". */
export type NotificationAction = {
  label: string;
  icon?: IconName;
  onPress: () => void;
};

/**
 * One notification in full — the same screen in all three apps. Opening it marks it read; `actionsFor` says where
 * the reader can go from it in their app (the day it is about, the bill, the customer).
 */
export function NotificationDetail({
  id,
  address,
  isLoading,
  notLinked,
  onBack,
  actionsFor,
  noteFor,
}: {
  id: string;
  address: NotificationAddress | null;
  isLoading?: boolean;
  notLinked?: ReactNode;
  onBack: () => void;
  actionsFor: (n: AppNotification) => NotificationAction[];
  /** A line of status above the buttons, e.g. the answer already given to an order reminder. */
  noteFor?: (n: AppNotification) => string | null;
}) {
  const inbox = useNotifications(address);
  const notification = inbox.items.find((n) => n.id === id) ?? null;

  // Reading it in full is what "read" means; do it once, when it first shows.
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!notification || notification.readAt || markedRef.current === notification.id) return;
    markedRef.current = notification.id;
    inbox.markRead(notification.id);
  }, [inbox, notification]);

  const loading = isLoading || inbox.isLoading;
  const t = useStrings('inbox').detail;

  return (
    <CustomerScreen title={t.title} onBack={onBack}>
      {loading ? (
        <CustomerLoading />
      ) : !address ? (
        notLinked ?? null
      ) : !notification ? (
        <CustomerStateBlock
          icon="bell-off-outline"
          title={t.notFoundTitle}
          text={t.notFoundText}
          actionLabel={t.backToList}
          onAction={onBack}
        />
      ) : (
        <DetailBody notification={notification} actions={actionsFor(notification)} note={noteFor?.(notification) ?? null} />
      )}
    </CustomerScreen>
  );
}

function DetailBody({
  notification: n,
  actions,
  note,
}: {
  notification: AppNotification;
  actions: NotificationAction[];
  note: string | null;
}) {
  const lang = useLanguage();
  const strings = useStrings('inbox');
  const t = strings.detail;
  const look = notificationLook(n.type);
  const text = notificationText(n, lang);
  const [primary, ...others] = actions;

  return (
    <>
      <CustomerCard style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={[styles.icon, { backgroundColor: look.bg }]}>
            <MaterialCommunityIcons name={look.icon} size={26} color={look.fg} />
          </View>
          <View style={[styles.category, { backgroundColor: look.bg }]}>
            <Text style={[styles.categoryText, { color: look.fg }]}>{strings.notificationCategories[look.category]}</Text>
          </View>
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {text.title}
        </Text>
        <Text style={styles.body} selectable>
          {text.body}
        </Text>
      </CustomerCard>

      <CustomerCard>
        <CustomerRow label={t.received} value={formatDateTime(n.createdAt, lang)} />
        {n.dateYmd ? (
          <CustomerRow label={t.forDay} value={formatDay(n.dateYmd, { weekday: true, year: true, lang })} />
        ) : null}
        {n.monthYyyyMm ? <CustomerRow label={t.forMonth} value={formatMonth(n.monthYyyyMm, lang)} /> : null}
        {n.readAt ? <CustomerRow label={t.read} value={formatDateTime(n.readAt, lang)} /> : null}
      </CustomerCard>

      {note ? (
        <View style={styles.note} accessibilityLiveRegion="polite">
          <MaterialCommunityIcons name="check-circle" size={20} color="#15803D" />
          <Text style={styles.noteText}>{note}</Text>
        </View>
      ) : null}

      {primary ? (
        <View style={styles.actions}>
          <CustomerPrimaryButton label={primary.label} icon={primary.icon} onPress={primary.onPress} />
          {others.map((a) => (
            <CustomerSecondaryButton key={a.label} label={a.label} onPress={a.onPress} />
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  hero: { gap: amraleSpacing.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  category: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: amraleRadius.pill },
  categoryText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12 },
  title: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 20, lineHeight: 26, color: amraleColors.text },
  body: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 15, lineHeight: 23, color: amraleColors.text },
  actions: { gap: amraleSpacing.sm },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: amraleRadius.md,
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
  },
  noteText: { flex: 1, fontFamily: amraleTypography.fontFamily.medium, fontSize: 14, lineHeight: 20, color: amraleColors.text },
});
