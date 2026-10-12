import { router, useLocalSearchParams } from 'expo-router';

import { CustomerNotLinked } from '@/src/components/customer/customerUi';
import { NotificationDetail, type NotificationAction } from '@/src/components/notifications/NotificationDetail';
import type { AppNotification } from '@/src/domain/notifications/entities';
import { customerCutoffFor } from '@/src/domain/customers/daySchedule';
import { orderCutoffTimeLabel, orderReminderResponseLabel } from '@/src/domain/notifications/orderReminders';
import { useMyCustomer } from '@/src/hooks/customer/useMyCustomer';
import { useOrderReminderAnswer } from '@/src/hooks/customer/useOrderReminderAnswer';
import type { Lang } from '@/src/i18n/language';
import { strings, type Dictionary } from '@/src/i18n/strings';
import { useLanguage } from '@/src/i18n/useStrings';
import { formatDateTime, formatDay } from '@/src/utils/format';

type Words = Dictionary['inbox']['customerActions'];

/** Where a customer goes from a notification: the day it is about, their subscription, their bill, or help. */
/**
 * The evening reminder asks one thing — keep tomorrow's order as it is, or change it. Until the cut-off both answers
 * are buttons; after it, only the dairy can change the day.
 */
function orderReminderActions(
  n: AppNotification,
  respond: (ymd: string, response: 'keep' | 'change') => Promise<void>,
  t: Words,
  lang: Lang,
): NotificationAction[] {
  const ymd = n.dateYmd;
  if (!ymd) return [];
  const openDays = () => router.push({ pathname: '/(customer)/my-days', params: { month: ymd.slice(0, 7) } });
  if (Date.now() >= customerCutoffFor(ymd).getTime()) {
    return [
      {
        label: t.askDairyToChange,
        icon: 'chat-processing-outline',
        onPress: () =>
          router.push({
            pathname: '/(customer)/chat',
            params: { message: t.changeRequestMessage(formatDay(ymd, { weekday: true, lang })) },
          }),
      },
      { label: t.openMyDays, icon: 'calendar-month-outline', onPress: openDays },
    ];
  }
  const change: NotificationAction = {
    label: t.changeOrderUntil(orderCutoffTimeLabel(lang)),
    icon: 'pencil-outline',
    onPress: () => {
      void respond(ymd, 'change');
      openDays();
    },
  };
  if (n.response === 'keep') return [change];
  return [{ label: t.keepAsItIs, icon: 'check', onPress: () => void respond(ymd, 'keep') }, change];
}

function customerActions(n: AppNotification, t: Words): NotificationAction[] {
  const month = n.monthYyyyMm ?? n.dateYmd?.slice(0, 7);
  const announcementId = n.announcementId;
  const openAnnouncement: NotificationAction[] = announcementId
    ? [
        {
          label: t.openAnnouncement,
          icon: 'bullhorn-outline',
          onPress: () => router.push({ pathname: '/(customer)/announcement-detail', params: { id: announcementId } }),
        },
      ]
    : [];
  if (n.type === 'Announcement') return openAnnouncement;
  if (n.type === 'ChatMessage') {
    return [{ label: t.openChat, icon: 'chat-processing-outline', onPress: () => router.push('/(customer)/chat') }];
  }
  return [...openAnnouncement, ...customerActionsByType(n, month, t)];
}

function customerActionsByType(n: AppNotification, month: string | undefined, t: Words): NotificationAction[] {
  switch (n.type) {
    case 'OrderPlaced':
    case 'OrderCancelled':
    case 'AdditionalProductAdded':
    case 'DaySkipped':
    case 'QuantityChanged':
    case 'DeliveryCompleted':
    case 'DeliveryNotCompleted':
    case 'SubscriptionResumed':
      return [
        {
          label: t.openMyDays,
          icon: 'calendar-month-outline',
          onPress: () => router.push({ pathname: '/(customer)/my-days', params: month ? { month } : {} }),
        },
      ];
    case 'SubscriptionStarted':
    case 'SubscriptionPaused':
    case 'SubscriptionExpired':
    case 'SubscriptionExpiringIn3Days':
      return [{ label: t.openMySubscription, icon: 'calendar-sync-outline', onPress: () => router.push('/(customer)/subscription') }];
    case 'MonthlyBillGenerated':
    case 'PaymentPending':
    case 'PaymentReceived':
      return [
        {
          label: t.openMyBills,
          icon: 'receipt-text-outline',
          onPress: () => router.push({ pathname: '/(customer)/bills', params: month ? { month } : {} }),
        },
      ];
    case 'ComplaintRaised':
    case 'ComplaintAnswered':
      return [{ label: t.contactDairy, icon: 'lifebuoy', onPress: () => router.push('/(auth)/contact-admin') }];
    case 'Offer':
      return [{ label: t.openOffers, icon: 'tag-heart-outline', onPress: () => router.push('/(customer)/offers') }];
    default:
      return [];
  }
}

export default function CustomerNotificationDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const { customer, isLoading } = useMyCustomer();
  const answers = useOrderReminderAnswer(customer);
  const lang = useLanguage();
  const t = strings('inbox', lang).customerActions;
  return (
    <NotificationDetail
      id={id}
      address={customer ? { audience: 'Customer', customerId: customer.id } : null}
      isLoading={isLoading}
      notLinked={<CustomerNotLinked />}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(customer)/notifications'))}
      actionsFor={(n) => (n.type === 'OrderReminder' ? orderReminderActions(n, answers.respond, t, lang) : customerActions(n, t))}
      noteFor={(n) => {
        if (n.type !== 'OrderReminder' || !n.response) return null;
        const answer = orderReminderResponseLabel(n.response, lang);
        return n.respondedAt ? t.answerNoteAt(answer, formatDateTime(n.respondedAt, lang)) : t.answerNote(answer);
      }}
    />
  );
}
