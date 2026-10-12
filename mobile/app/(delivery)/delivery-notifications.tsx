import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { CustomerLoading } from '@/src/components/customer/customerUi';
import { NotificationsInbox } from '@/src/components/notifications/NotificationsInbox';
import { useMyDeliveryBoy } from '@/src/hooks/delivery/useMyDeliveryBoy';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleTypography } from '@/src/theme/dairyTactile';

/** Changes to this delivery boy's customers — pauses, add-ons, quantities — that change what goes on the van. */
export default function DeliveryNotificationsScreen() {
  const t = useStrings('delivery');
  const { boy, isLoading } = useMyDeliveryBoy();
  return (
    <NotificationsInbox
      address={boy ? { audience: 'DeliveryBoy', deliveryBoyId: boy.id } : null}
      isLoading={isLoading}
      notLinked={
        isLoading ? (
          <CustomerLoading />
        ) : (
          <View style={styles.notLinked}>
            <Text style={styles.title}>{t.notLinked.title}</Text>
            <Text style={styles.text}>{t.notLinked.text}</Text>
          </View>
        )
      }
      emptyText={t.notifications.emptyText}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(delivery)'))}
      onOpen={(n) => router.push({ pathname: '/(delivery)/delivery-notification-detail', params: { id: n.id } })}
    />
  );
}

const styles = StyleSheet.create({
  notLinked: { alignItems: 'center', gap: 6, paddingVertical: 32 },
  title: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text },
  text: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted, textAlign: 'center' },
});
