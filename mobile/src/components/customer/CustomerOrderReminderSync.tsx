import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';

import { upcomingOrderReminders } from '@/src/domain/notifications/orderReminders';
import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import { useMyCustomer } from '@/src/hooks/customer/useMyCustomer';
import { useOrderReminderAnswer } from '@/src/hooks/customer/useOrderReminderAnswer';
import { useNow } from '@/src/hooks/useNow';
import {
  addDeviceReminderResponseListener,
  getDeviceReminderPermission,
  requestDeviceReminderPermission,
  syncDeviceReminders,
} from '@/src/infrastructure/deviceReminders';

/**
 * Keeps this device's 6 pm IST order reminders in step with the signed-in customer's orders, and handles the answers
 * given from the notification itself. Renders nothing; mounted once in the customer app.
 *
 * Each reminder is shown once, at 6 pm IST — shown by the phone in its own time zone — and never again that day.
 * - Phones: the next two weeks of reminders are scheduled on the phone (rescheduled whenever the orders change), so
 *   they arrive with the app closed. The phone asks for notification permission the first time.
 * - Web: a pop-up if the tab is open at that moment, once the customer has turned reminders on.
 */
export function CustomerOrderReminderSync() {
  const { customer } = useMyCustomer();
  const answers = useOrderReminderAnswer(customer);
  const now = useNow(60_000);
  const today = todayYmd(now);

  // Only what the reminders are made from — a change to anything else must not reschedule them.
  const signature = customer
    ? JSON.stringify([
        customer.id,
        customer.status,
        customer.appAccessEnabled,
        customer.subscriptionPlans,
        customer.subscriptionExceptions,
        customer.extraOrders,
        customer.deliveries?.map((d) => d.deliveryDate),
      ])
    : '';
  const reminders = useMemo(
    () => (customer ? upcomingOrderReminders(customer) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` stands in for the customer's order fields
    [signature, today],
  );

  const askedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!customer) {
        await syncDeviceReminders(null, []);
        return;
      }
      let permission = await getDeviceReminderPermission();
      // A phone asks once, on its own; a browser only lets a tap ask (the dashboard has a "Turn on" button).
      if (permission === 'undetermined' && Platform.OS !== 'web' && !askedRef.current) {
        askedRef.current = true;
        permission = await requestDeviceReminderPermission();
      }
      if (cancelled || permission !== 'granted') return;
      await syncDeviceReminders(customer.id, reminders);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [customer, reminders]);

  // Answers from the notification's buttons.
  const latest = useRef({ customer, answers });
  latest.current = { customer, answers };
  const handled = useRef(new Set<string>());
  useEffect(
    () =>
      addDeviceReminderResponseListener((r) => {
        const { customer: me, answers: a } = latest.current;
        if (!me || me.id !== r.customerId || handled.current.has(r.key)) return;
        handled.current.add(r.key);
        if (r.action === 'keep') {
          void a.respond(r.ymd, 'keep', me);
          router.push('/(customer)');
        } else if (r.action === 'change') {
          void a.respond(r.ymd, 'change', me);
          router.push({ pathname: '/(customer)/my-days', params: { month: r.ymd.slice(0, 7) } });
        } else {
          router.push('/(customer)');
        }
      }),
    [],
  );

  return null;
}
