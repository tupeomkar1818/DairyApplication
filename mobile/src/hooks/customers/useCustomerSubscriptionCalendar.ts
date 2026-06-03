import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import type { AppendSubscriptionCalendarEntryRequest, CustomerSubscriptionCalendarEntryDto } from '@/src/domain/customers/dtos';
import { AppendSubscriptionCalendarEntryRequestSchema } from '@/src/domain/customers/validations';
import { loadCalendarEntries, saveCalendarEntries } from '@/src/infrastructure/customerSubscriptionCalendarStore';
import { subscribeStorageKey } from '@/src/infrastructure/storage/storage';
import { CUSTOMER_SUBSCRIPTION_CALENDAR_STORE_PREFIX } from '@/src/infrastructure/storage/keys';

function newEntryId(): string {
  return `cal_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function useCustomerSubscriptionCalendar(customerId: string | undefined) {
  const qc = useQueryClient();

  const queryKey = useMemo(
    () => ['customers', 'subscriptionCalendar', customerId ?? ''] as const,
    [customerId],
  );
  const storageKey = customerId ? `${CUSTOMER_SUBSCRIPTION_CALENDAR_STORE_PREFIX}:${customerId}` : null;

  const query = useQuery({
    queryKey,
    queryFn: () => loadCalendarEntries(customerId!),
    enabled: !!customerId,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!storageKey || !customerId) return;
    return subscribeStorageKey(storageKey, () => {
      void qc.invalidateQueries({ queryKey });
    });
  }, [customerId, qc, queryKey, storageKey]);

  const append = useMutation({
    mutationFn: async (payload: AppendSubscriptionCalendarEntryRequest) => {
      if (!customerId) return;
      const parsed = AppendSubscriptionCalendarEntryRequestSchema.parse(payload);
      const row: CustomerSubscriptionCalendarEntryDto = {
        id: newEntryId(),
        dateYmd: parsed.dateYmd,
        kind: parsed.kind,
        title: parsed.title,
        subtitle: parsed.subtitle,
      };
      const prev = (query.data ?? []) as CustomerSubscriptionCalendarEntryDto[];
      const next = [...prev, row];
      await saveCalendarEntries(customerId, next);
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(queryKey, next);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!customerId) return;
      const prev = (query.data ?? []) as CustomerSubscriptionCalendarEntryDto[];
      const next = prev.filter((e) => e.id !== id);
      await saveCalendarEntries(customerId, next);
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(queryKey, next);
    },
  });

  const safeEntries = (query.data ?? []) as CustomerSubscriptionCalendarEntryDto[];
  const ready = !!customerId ? query.isFetched : true;

  return {
    entries: safeEntries,
    ready,
    append: useCallback((p: AppendSubscriptionCalendarEntryRequest) => append.mutateAsync(p), [append.mutateAsync]),
    remove: useCallback((id: string) => remove.mutateAsync(id), [remove.mutateAsync]),
  };
}
