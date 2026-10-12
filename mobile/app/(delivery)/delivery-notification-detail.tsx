import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NotificationDetail, type NotificationAction } from '@/src/components/notifications/NotificationDetail';
import type { AppNotification } from '@/src/domain/notifications/entities';
import { useMyDeliveryBoy } from '@/src/hooks/delivery/useMyDeliveryBoy';
import { strings } from '@/src/i18n/strings';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDay } from '@/src/utils/format';

/** A change to a customer's day: the delivery boy opens the run sheet for that day. */
function deliveryActions(n: AppNotification): NotificationAction[] {
  const date = n.dateYmd;
  const t = strings('delivery');
  return [
    {
      label: date ? t.notifications.openRunSheetFor(formatDay(date)) : t.openRunSheet,
      icon: 'map-marker-path',
      onPress: () => router.push({ pathname: '/(delivery)/run', params: date ? { date } : {} }),
    },
  ];
}

export default function DeliveryNotificationDetailScreen() {
  const t = useStrings('delivery');
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const { boy, isLoading } = useMyDeliveryBoy();
  const address = useMemo(() => (boy ? { audience: 'DeliveryBoy' as const, deliveryBoyId: boy.id } : null), [boy]);
  return (
    <NotificationDetail
      id={id}
      address={address}
      isLoading={isLoading}
      notLinked={
        <View style={styles.notLinked}>
          <Text style={styles.title}>{t.notLinked.title}</Text>
          <Text style={styles.text}>{t.notLinked.text}</Text>
        </View>
      }
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(delivery)/delivery-notifications'))}
      actionsFor={deliveryActions}
    />
  );
}

const styles = StyleSheet.create({
  notLinked: { alignItems: 'center', gap: 6, paddingVertical: 32 },
  title: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text },
  text: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted, textAlign: 'center' },
});
