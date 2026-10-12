import { router } from 'expo-router';
import { useMemo } from 'react';

import { AnnouncementCard } from '@/src/components/announcements/AnnouncementCard';
import {
  CustomerLoading,
  CustomerNotLinked,
  CustomerScreen,
  CustomerStateBlock,
} from '@/src/components/customer/customerUi';
import {
  ANNOUNCEMENT_HISTORY_DAYS,
  announcementsForCustomer,
  announcementText,
  isUnreadBy,
  personalize,
  recentAnnouncements,
} from '@/src/domain/announcements/announcements';
import { useAnnouncements } from '@/src/hooks/announcements/useAnnouncements';
import { useMyCustomer } from '@/src/hooks/customer/useMyCustomer';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';

/** Wishes, notices and delivery updates from the dairy in the last 90 days, newest first. */
export default function CustomerAnnouncementsScreen() {
  const { customer, isLoading } = useMyCustomer();
  const announcements = useAnnouncements();
  const lang = useLanguage();
  const t = useStrings('inbox').announcements;

  const shown = useMemo(
    () => (customer ? recentAnnouncements(announcementsForCustomer(announcements.all, customer.id)) : []),
    [announcements.all, customer],
  );

  return (
    <CustomerScreen title={t.title}>
      {isLoading || announcements.isLoading ? (
        <CustomerLoading />
      ) : !customer ? (
        <CustomerNotLinked />
      ) : shown.length === 0 ? (
        <CustomerStateBlock icon="bullhorn-outline" title={t.emptyTitle} text={t.emptyText(ANNOUNCEMENT_HISTORY_DAYS)} />
      ) : (
        shown.map((a) => {
          const text = announcementText(a, lang);
          return (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              title={personalize(text.title, customer.name, lang)}
              message={personalize(text.message, customer.name, lang)}
              unread={isUnreadBy(a, customer.id)}
              onPress={() => router.push({ pathname: '/(customer)/announcement-detail', params: { id: a.id } })}
            />
          );
        })
      )}
    </CustomerScreen>
  );
}
