import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { AnnouncementDetailBody } from '@/src/components/announcements/AnnouncementDetailBody';
import {
  CustomerLoading,
  CustomerRow,
  CustomerScreen,
  CustomerSecondaryButton,
  CustomerStateBlock,
} from '@/src/components/customer/customerUi';
import { announcementText, reachOf } from '@/src/domain/announcements/announcements';
import { useAnnouncements } from '@/src/hooks/announcements/useAnnouncements';
import { useCustomers } from '@/src/hooks/customers';
import { useStrings } from '@/src/i18n/useStrings';

export default function AdminAnnouncementDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const announcements = useAnnouncements();
  const customers = useCustomers();
  const t = useStrings('admin');
  const td = t.announcementDetail;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const announcement = announcements.all.find((a) => a.id === id) ?? null;
  const items = useMemo(() => customers.data?.items ?? [], [customers.data?.items]);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(admin)/admin-announcements'));

  if (announcements.isLoading) {
    return (
      <CustomerScreen title={td.title} onBack={goBack}>
        <CustomerLoading />
      </CustomerScreen>
    );
  }

  if (!announcement) {
    return (
      <CustomerScreen title={td.title} onBack={goBack}>
        <CustomerStateBlock icon="bullhorn-outline" title={td.notFound} actionLabel={td.backToList} onAction={goBack} />
      </CustomerScreen>
    );
  }

  const reach = reachOf(announcement, items.map((c) => c.id));
  const readers = items.filter((c) => announcement.readBy?.[c.id]).map((c) => c.name);
  const to =
    announcement.audience.kind === 'all'
      ? t.announcements.allCustomers
      : announcement.audience.customerIds
          .map((cid) => items.find((c) => c.id === cid)?.name ?? td.formerCustomer)
          .join(', ');

  return (
    <CustomerScreen title={td.title} onBack={goBack}>
      <AnnouncementDetailBody
        announcement={announcement}
        title={announcementText(announcement).title}
        message={announcementText(announcement).message}
        extraRows={
          <>
            <CustomerRow label={td.to} value={to} />
            <CustomerRow label={td.read} value={td.readOf(reach.read, reach.recipients)} />
            {readers.length ? <CustomerRow label={td.readBy} value={readers.join(', ')} /> : null}
          </>
        }
      >
        <CustomerSecondaryButton
          label={confirmDelete ? td.confirmDelete : td.delete}
          tone="danger"
          disabled={announcements.remove.isPending}
          onPress={async () => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            await announcements.remove.mutateAsync(announcement.id);
            goBack();
          }}
        />
      </AnnouncementDetailBody>
    </CustomerScreen>
  );
}
