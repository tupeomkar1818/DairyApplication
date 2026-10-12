import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnnouncementCard } from '@/src/components/announcements/AnnouncementCard';
import {
  CustomerLoading,
  CustomerPrimaryButton,
  CustomerScreen,
  CustomerStateBlock,
} from '@/src/components/customer/customerUi';
import { announcementText, reachOf } from '@/src/domain/announcements/announcements';
import { useAnnouncements } from '@/src/hooks/announcements/useAnnouncements';
import { useCustomers } from '@/src/hooks/customers';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

/** Everything the dairy has sent customers (and delivery updates), with how many have read each. */
export default function AdminAnnouncementsScreen() {
  const { sent } = useLocalSearchParams<{ sent?: string }>();
  const announcements = useAnnouncements();
  const t = useStrings('admin').announcements;
  const customers = useCustomers();
  const customerIds = useMemo(() => (customers.data?.items ?? []).map((c) => c.id), [customers.data?.items]);

  const list = useMemo(
    () => [...announcements.all].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    [announcements.all],
  );

  return (
    <CustomerScreen
      title={t.title}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(admin)'))}
    >
      {sent ? (
        <View style={styles.sentBanner}>
          <Text style={styles.sentText}>{t.sentBanner(Number(sent))}</Text>
        </View>
      ) : null}

      <CustomerPrimaryButton
        label={t.newButton}
        icon="bullhorn-outline"
        onPress={() => router.push('/(admin)/admin-announcement-compose')}
      />

      {announcements.isLoading ? (
        <CustomerLoading />
      ) : list.length === 0 ? (
        <CustomerStateBlock
          icon="bullhorn-outline"
          title={t.emptyTitle}
          text={t.emptyText}
        />
      ) : (
        list.map((a) => {
          const reach = reachOf(a, customerIds);
          const chosenIds = a.audience.kind === 'customers' ? a.audience.customerIds : null;
          const to = !chosenIds
            ? t.allCustomers
            : chosenIds.length === 1
              ? customers.data?.items.find((c) => c.id === chosenIds[0])?.name ?? t.customerCount(1)
              : t.customerCount(chosenIds.length);
          return (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              title={announcementText(a).title}
              message={announcementText(a).message}
              onPress={() => router.push({ pathname: '/(admin)/admin-announcement-detail', params: { id: a.id } })}
              footer={
                <Text style={styles.reach}>{t.reach(to, reach.read, reach.recipients)}</Text>
              }
            />
          );
        })
      )}
    </CustomerScreen>
  );
}

const styles = StyleSheet.create({
  sentBanner: { padding: 12, borderRadius: amraleRadius.md, backgroundColor: '#dcf3e5' },
  sentText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: '#16623a' },
  reach: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12, color: amraleColors.blue },
});
