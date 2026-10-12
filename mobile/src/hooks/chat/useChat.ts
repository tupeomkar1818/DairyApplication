import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { ChatAuthor, ChatMessage } from '@/src/domain/chat/entities';
import { services } from '@/src/infrastructure/service-registry';
import { CHAT_STORE_KEY } from '@/src/infrastructure/storage/keys';
import { subscribeStorageKey } from '@/src/infrastructure/storage/storage';

/** Stable empty value while loading — a fresh `[]` each render would re-fire every effect that depends on it. */
const EMPTY = Object.freeze([]) as unknown as ChatMessage[];

const QUERY_KEY = ['chat'] as const;

/** All chat messages, kept live: a reply appears in the other app as soon as it is sent. */
export function useChat() {
  const qc = useQueryClient();

  useEffect(
    () =>
      // Only a phone keeping its own records writes this key; with the server, sending invalidates instead.
      subscribeStorageKey(CHAT_STORE_KEY, () => {
        void qc.invalidateQueries({ queryKey: QUERY_KEY });
      }),
    [qc],
  );

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => services.chat.list(),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEY });

  const send = useMutation({
    mutationFn: (input: { customerId: string; from: ChatAuthor; text: string; senderName?: string }) => services.chat.send(input),
    onSuccess: invalidate,
  });
  const markRead = useMutation({
    mutationFn: ({ customerId, reader }: { customerId: string; reader: ChatAuthor }) => services.chat.markRead(customerId, reader),
    onSuccess: invalidate,
  });

  return {
    all: query.data ?? EMPTY,
    isLoading: query.isLoading,
    send,
    markRead,
  };
}
