import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { Announcement } from '@/src/domain/announcements/entities';
import { services } from '@/src/infrastructure/service-registry';
import { ANNOUNCEMENTS_STORE_KEY } from '@/src/infrastructure/storage/keys';
import { subscribeStorageKey } from '@/src/infrastructure/storage/storage';

/** Stable empty value while loading — a fresh `[]` each render would re-fire every effect that depends on it. */
const EMPTY = Object.freeze([]) as unknown as Announcement[];

const QUERY_KEY = ['announcements'] as const;

/** Every announcement, kept live: a message the admin sends (or a delivery marked) shows up in open apps at once. */
export function useAnnouncements() {
  const qc = useQueryClient();

  useEffect(
    () =>
      // Only a phone keeping its own records writes this key; with the server, a send invalidates instead.
      subscribeStorageKey(ANNOUNCEMENTS_STORE_KEY, () => {
        void qc.invalidateQueries({ queryKey: QUERY_KEY });
      }),
    [qc],
  );

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => services.announcements.list(),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEY });

  const send = useMutation({ mutationFn: (a: Announcement) => services.announcements.save(a), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => services.announcements.delete(id), onSuccess: invalidate });
  const markRead = useMutation({
    mutationFn: ({ id, customerId }: { id: string; customerId: string }) => services.announcements.markRead(id, customerId),
    onSuccess: invalidate,
  });

  return {
    all: query.data ?? EMPTY,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
    send,
    remove,
    markRead,
  };
}
