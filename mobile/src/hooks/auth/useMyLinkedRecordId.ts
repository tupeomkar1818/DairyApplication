import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { linkedRecordIdForUser } from '@/src/infrastructure/accountLinks';
import { USERS_STORE_KEY } from '@/src/infrastructure/storage/keys';
import { subscribeStorageKey } from '@/src/infrastructure/storage/storage';

/**
 * The customer / delivery-partner record the signed-in login belongs to. Finding "my record" by this id rather than
 * by the session's mobile number keeps it found after the admin changes that person's number.
 */
export function useMyLinkedRecordId(userId: string | undefined): { recordId: string | null; isLoading: boolean } {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['auth', 'linkedRecord', userId ?? ''],
    queryFn: () => linkedRecordIdForUser(userId),
    enabled: !!userId,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(
    () =>
      subscribeStorageKey(USERS_STORE_KEY, () => {
        void qc.invalidateQueries({ queryKey: ['auth', 'linkedRecord'] });
      }),
    [qc],
  );

  return { recordId: query.data ?? null, isLoading: !!userId && query.isLoading };
}
