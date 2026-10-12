import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import type { AppNotification } from '@/src/domain/notifications/entities';
import { notificationsFor, unreadCount, type NotificationAddress } from '@/src/infrastructure/notificationsStore';
import { services } from '@/src/infrastructure/service-registry';
import { NOTIFICATIONS_STORE_KEY } from '@/src/infrastructure/storage/keys';
import { subscribeStorageKey } from '@/src/infrastructure/storage/storage';

/** Stable empty value while loading — a fresh `[]` each render would re-fire every effect that depends on it. */
const EMPTY = Object.freeze([]) as unknown as AppNotification[];

const QUERY_KEY = ['notifications'] as const;

/** Every row there is — the dairy's reports read these; a phone keeping its own rows already has them all. */
const LOG_QUERY_KEY = ['notifications', 'all'] as const;

/**
 * One reader's inbox. `address` says whose: the signed-in customer, the signed-in delivery boy, or the admin.
 * Pass `null` while the reader is still unknown (session loading) — the hook then returns an empty inbox.
 */
export function useNotifications(address: NotificationAddress | null) {
  const qc = useQueryClient();

  useEffect(
    () =>
      subscribeStorageKey(NOTIFICATIONS_STORE_KEY, () => {
        void qc.invalidateQueries({ queryKey: QUERY_KEY });
      }),
    [qc],
  );

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => services.notifications.list(),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  // The server hands over this reader’s rows already; on a phone the one list is filtered here.
  const items = useMemo(
    () => (address ? notificationsFor(query.data ?? EMPTY, address) : EMPTY),
    [address, query.data],
  );

  const markRead = useMutation({
    mutationFn: (id: string) => services.notifications.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (address) await services.notifications.markAllRead(address);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return {
    items,
    unread: unreadCount(items),
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
    markRead: (id: string) => markRead.mutate(id),
    markAllRead: () => markAllRead.mutate(),
  };
}

/**
 * Every stored notification, for the admin's reports (e.g. customers' answers to the evening reminder).
 * Shares the inbox query, so opening a report does not read storage again.
 */
export function useNotificationLog() {
  const qc = useQueryClient();

  useEffect(
    () =>
      subscribeStorageKey(NOTIFICATIONS_STORE_KEY, () => {
        void qc.invalidateQueries({ queryKey: QUERY_KEY });
      }),
    [qc],
  );

  // With the server, the dairy asks for every row; on a phone the one list is already every row.
  const everyRow = services.notifications.listAll;
  const query = useQuery({
    queryKey: everyRow ? LOG_QUERY_KEY : QUERY_KEY,
    queryFn: () => (everyRow ? everyRow.call(services.notifications) : services.notifications.list()),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  return { items: query.data ?? EMPTY, isLoading: query.isLoading, isError: query.isError };
}
