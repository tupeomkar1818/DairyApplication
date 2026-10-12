import { useCallback, useRef, useState } from 'react';

import { buildDayStatusDeliveries, NothingPlannedError, type MarkDayStatus } from '@/src/components/delivery/markDayStatus';
import { canMarkDeliveryDay } from '@/src/components/delivery/deliveryWindow';
import { addOnLabel, addOnsForDate } from '@/src/domain/customers/addOns';
import { plannedLinesOn } from '@/src/domain/customers/daySchedule';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { notifyDeliveryMarked } from '@/src/domain/notifications/events';
import { useUpdateCustomer } from '@/src/hooks/customers';
import { strings } from '@/src/i18n/strings';

function itemsLabel(customer: CustomerResponse, ymd: string): string {
  const planned = plannedLinesOn(customer, ymd).map(({ plan, quantity }) =>
    addOnLabel({ productName: plan.productName, quantityLabel: plan.quantityLabel, numberOfItems: quantity }),
  );
  return [...planned, ...addOnsForDate(customer, ymd).map((o) => addOnLabel(o))].join(', ');
}

/**
 * Marks a customer's day Delivered / Not delivered from the delivery app — the run sheet and a stop's order screen
 * both go through here, so a stop is written, guarded and announced to the customer the same way from either.
 */
export function useMarkDeliveryDay(input: { actorName: string | undefined; today: string }) {
  const { actorName, today } = input;
  const updateCustomer = useUpdateCustomer();
  const [busyCustomerId, setBusyCustomerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Synchronous double-tap guard: state updates land too late to block a second tap. */
  const busyRef = useRef(false);

  const mark = useCallback(
    async (customer: CustomerResponse, ymd: string, next: MarkDayStatus): Promise<boolean> => {
      if (busyRef.current || !canMarkDeliveryDay(ymd, today)) return false;
      busyRef.current = true;
      setBusyCustomerId(customer.id);
      setError(null);
      try {
        const label = itemsLabel(customer, ymd);
        const { deliveries, extraOrders } = buildDayStatusDeliveries({ customer, ymd, next, actorName });
        await updateCustomer.mutateAsync({ id: customer.id, data: { deliveries, extraOrders } });
        notifyDeliveryMarked({
          customerId: customer.id,
          customerName: customer.name,
          dateYmd: ymd,
          delivered: next === 'Delivered',
          itemsLabel: label,
          deliveryBoyName: actorName,
        });
        return true;
      } catch (err) {
        setError(err instanceof NothingPlannedError ? err.message : strings('delivery').markDay.couldNotUpdate(customer.name));
        return false;
      } finally {
        busyRef.current = false;
        setBusyCustomerId(null);
      }
    },
    [actorName, today, updateCustomer],
  );

  return { mark, busyCustomerId, error, clearError: () => setError(null) };
}
