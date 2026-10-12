import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

import { AnnouncementDetailBody } from '@/src/components/announcements/AnnouncementDetailBody';
import {
  CustomerLoading,
  CustomerNotLinked,
  CustomerPrimaryButton,
  CustomerScreen,
  CustomerStateBlock,
} from '@/src/components/customer/customerUi';
import {
  announcementsForCustomer,
  announcementText,
  isUnreadBy,
  personalize,
} from '@/src/domain/announcements/announcements';
import { useAnnouncements } from '@/src/hooks/announcements/useAnnouncements';
import { useMyCustomer } from '@/src/hooks/customer/useMyCustomer';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';

export default function CustomerAnnouncementDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const { customer, isLoading } = useMyCustomer();
  const announcements = useAnnouncements();
  const lang = useLanguage();
  const inbox = useStrings('inbox');
  const t = inbox.announcements;

  // Only the customer's own announcements can be opened, even with a guessed link.
  const announcement = customer
    ? announcementsForCustomer(announcements.all, customer.id).find((a) => a.id === id) ?? null
    : null;

  const markedRef = useRef<string | null>(null);
  const { markRead } = announcements;
  useEffect(() => {
    if (!customer || !announcement || !isUnreadBy(announcement, customer.id) || markedRef.current === announcement.id) return;
    markedRef.current = announcement.id;
    markRead.mutate({ id: announcement.id, customerId: customer.id });
  }, [announcement, customer, markRead]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(customer)/announcements'));
  const text = announcement ? announcementText(announcement, lang) : null;

  return (
    <CustomerScreen title={t.detailTitle} onBack={goBack}>
      {isLoading || announcements.isLoading ? (
        <CustomerLoading />
      ) : !customer ? (
        <CustomerNotLinked />
      ) : !announcement || !text ? (
        <CustomerStateBlock
          icon="bullhorn-outline"
          title={t.notFoundTitle}
          text={t.notFoundText}
          actionLabel={t.backToList}
          onAction={goBack}
        />
      ) : (
        <AnnouncementDetailBody
          announcement={announcement}
          title={personalize(text.title, customer.name, lang)}
          message={personalize(text.message, customer.name, lang)}
        >
          {announcement.category === 'Payment' ? (
            <CustomerPrimaryButton
              label={inbox.customerActions.openMyBills}
              icon="receipt-text-outline"
              onPress={() => router.push('/(customer)/bills')}
            />
          ) : announcement.category === 'Delivery' || announcement.category === 'Order' ? (
            <CustomerPrimaryButton
              label={inbox.customerActions.openMyDays}
              icon="calendar-month-outline"
              onPress={() =>
                router.push({
                  pathname: '/(customer)/my-days',
                  params: announcement.dateYmd ? { month: announcement.dateYmd.slice(0, 7) } : {},
                })
              }
            />
          ) : null}
        </AnnouncementDetailBody>
      )}
    </CustomerScreen>
  );
}
