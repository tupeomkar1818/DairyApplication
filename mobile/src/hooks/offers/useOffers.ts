import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { Offer } from '@/src/domain/offers/entities';
import { services } from '@/src/infrastructure/service-registry';
import { OFFERS_STORE_KEY } from '@/src/infrastructure/storage/keys';
import { subscribeStorageKey } from '@/src/infrastructure/storage/storage';

/** Stable empty value while loading — a fresh `[]` each render would re-fire every effect that depends on it. */
const EMPTY = Object.freeze([]) as unknown as Offer[];

export const OFFERS_QUERY_KEY = ['offers'] as const;

/**
 * Every offer this app may see, kept live: an offer the admin starts or ends shows up in open screens at once. Bills
 * take `all` as their `offers`, so a bill never shows without its offer discounts once this has loaded.
 */
export function useOffers() {
  const qc = useQueryClient();

  useEffect(
    () =>
      // Only a phone keeping its own offers writes this key; with the dairy's server, saving invalidates instead.
      subscribeStorageKey(OFFERS_STORE_KEY, () => {
        void qc.invalidateQueries({ queryKey: OFFERS_QUERY_KEY });
      }),
    [qc],
  );

  const query = useQuery({
    queryKey: OFFERS_QUERY_KEY,
    queryFn: () => services.offers.list(),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: OFFERS_QUERY_KEY });

  const save = useMutation({
    // An offer already on the list is edited; anything else is new. The answer carries the id it was saved under,
    // which the dairy's server may have chosen itself.
    mutationFn: (offer: Offer) =>
      (query.data ?? []).some((o) => o.id === offer.id) ? services.offers.update(offer.id, offer) : services.offers.create(offer),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => services.offers.delete(id), onSuccess: invalidate });

  return {
    all: query.data ?? EMPTY,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
    save,
    remove,
  };
}
