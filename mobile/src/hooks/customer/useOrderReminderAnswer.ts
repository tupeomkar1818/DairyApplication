import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { AppNotification, OrderReminderResponse } from '@/src/domain/notifications/entities';
import { buildOrderReminder, orderReminderKey } from '@/src/domain/notifications/orderReminders';
import { strings } from '@/src/i18n/strings';
import { formatDay } from '@/src/utils/format';
import { useNotifications } from '@/src/hooks/notifications/useNotifications';
import { services } from '@/src/infrastructure/service-registry';

/**
 * The signed-in customer's answers to the evening reminder: "keep tomorrow's order as it is" or "change it".
 * Used by the dashboard prompt, the notification screen and the phone notification's buttons, so an answer given in
 * one place shows in all of them.
 */
export function useOrderReminderAnswer(customer: CustomerResponse | null) {
  const qc = useQueryClient();
  const inbox = useNotifications(customer ? { audience: 'Customer', customerId: customer.id } : null);
  const [saving, setSaving] = useState(false);

  const reminderFor = useCallback(
    (ymd: string): AppNotification | null =>
      customer ? (inbox.items.find((n) => n.subjectKey === orderReminderKey(customer.id, ymd)) ?? null) : null,
    [customer, inbox.items],
  );

  const respond = useCallback(
    async (ymd: string, response: OrderReminderResponse, target?: CustomerResponse) => {
      const who = target ?? customer;
      if (!who) return;
      setSaving(true);
      try {
        const reminder = buildOrderReminder(who, ymd) ?? {
          audience: 'Customer' as const,
          customerId: who.id,
          type: 'OrderReminder' as const,
          title: strings('customer').orderReminder.fallbackTitle(formatDay(ymd, { weekday: true })),
          body: strings('customer').orderReminder.fallbackBody,
          dateYmd: ymd,
          subjectKey: orderReminderKey(who.id, ymd),
        };
        await services.notifications.recordReminderResponse({
          reminder: { ...reminder, customerId: who.id, dateYmd: ymd, subjectKey: orderReminderKey(who.id, ymd) },
          response,
          customerName: who.name,
          // Where the dairy’s server keeps the rows, the answer is written on the reminder already in the inbox.
          existing: inbox.items.find((n) => n.subjectKey === orderReminderKey(who.id, ymd)) ?? null,
        });
        await qc.invalidateQueries({ queryKey: ['notifications'] });
      } finally {
        setSaving(false);
      }
    },
    [customer, inbox.items, qc],
  );

  return useMemo(() => ({ reminderFor, respond, saving }), [reminderFor, respond, saving]);
}
