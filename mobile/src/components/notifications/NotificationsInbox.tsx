import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  CustomerCard,
  CustomerLoading,
  CustomerScreen,
  CustomerStateBlock,
} from '@/src/components/customer/customerUi';
import { notificationLook } from '@/src/components/notifications/notificationLook';
import type { AppNotification } from '@/src/domain/notifications/entities';
import { notificationText } from '@/src/domain/notifications/notificationText';
import { useNotifications } from '@/src/hooks/notifications/useNotifications';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import type { NotificationAddress } from '@/src/infrastructure/notificationsStore';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDateTime } from '@/src/utils/format';

/**
 * One inbox screen for all three apps. `address` says whose rows to show; tapping a row opens it in full through
 * `onOpen` (each app routes to its own notification detail screen).
 */
export function NotificationsInbox({
  address,
  isLoading,
  notLinked,
  emptyText,
  onBack,
  onOpen,
}: {
  address: NotificationAddress | null;
  /** The reader is still being worked out (session / profile loading). */
  isLoading?: boolean;
  /** Shown when the reader could not be identified. */
  notLinked?: ReactNode;
  emptyText: string;
  onBack?: () => void;
  /** Opens the notification in full. */
  onOpen: (n: AppNotification) => void;
}) {
  const inbox = useNotifications(address);
  const lang = useLanguage();
  const t = useStrings('inbox').inbox;

  return (
    <CustomerScreen
      title={t.title}
      onBack={onBack}
      right={
        inbox.unread > 0 ? (
          <Pressable
            onPress={inbox.markAllRead}
            hitSlop={6}
            style={({ pressed }) => [styles.markAll, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t.markAllLabel}
          >
            <Text style={styles.markAllText}>{t.markAll}</Text>
          </Pressable>
        ) : null
      }
    >
      {isLoading || inbox.isLoading ? (
        <CustomerLoading />
      ) : !address ? (
        notLinked ?? null
      ) : inbox.items.length === 0 ? (
        <CustomerStateBlock icon="bell-outline" title={t.emptyTitle} text={emptyText} />
      ) : (
        inbox.items.map((n) => {
          const look = notificationLook(n.type);
          const unread = !n.readAt;
          const text = notificationText(n, lang);
          return (
            <Pressable
              key={n.id}
              onPress={() => onOpen(n)}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t.rowLabel(text.title, text.body.replace(/\.\s*$/, ''), unread)}
            >
              <CustomerCard style={unread ? styles.unread : undefined}>
                <View style={styles.row}>
                  <View style={[styles.icon, { backgroundColor: unread ? look.bg : '#f1f3f6' }]}>
                    <MaterialCommunityIcons name={look.icon} size={20} color={unread ? look.fg : amraleColors.textSubtle} />
                  </View>
                  <View style={styles.text}>
                    <Text style={[styles.title, !unread && styles.titleRead]} numberOfLines={2}>
                      {text.title}
                    </Text>
                    <Text style={styles.body} numberOfLines={2}>
                      {text.body}
                    </Text>
                    <Text style={styles.when}>{formatDateTime(n.createdAt, lang)}</Text>
                  </View>
                  <View style={styles.trailing}>
                    {unread ? <View style={styles.dot} /> : null}
                    <MaterialCommunityIcons name="chevron-right" size={22} color={amraleColors.textSubtle} />
                  </View>
                </View>
              </CustomerCard>
            </Pressable>
          );
        })
      )}
    </CustomerScreen>
  );
}

const styles = StyleSheet.create({
  markAll: { paddingHorizontal: 8, minHeight: 44, justifyContent: 'center' },
  markAllText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.blue },
  unread: { borderColor: 'rgba(37, 99, 235, 0.35)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  titleRead: { fontFamily: amraleTypography.fontFamily.semiBold, color: amraleColors.textMuted },
  body: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, lineHeight: 18, color: amraleColors.textMuted },
  when: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textSubtle },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dot: { width: 8, height: 8, borderRadius: amraleRadius.pill, backgroundColor: amraleColors.blue },
  pressed: { opacity: 0.88 },
});
