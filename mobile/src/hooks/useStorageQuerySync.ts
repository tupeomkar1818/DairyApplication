import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  ADMIN_DASHBOARD_SETTINGS_STORE_KEY,
  DELIVERY_BOYS_STORE_KEY,
  PRODUCT_CATEGORIES_STORE_KEY,
} from '@/src/infrastructure/storage/keys';
import { subscribeStorageKey } from '@/src/infrastructure/storage/storage';

/**
 * Stores whose screens must follow edits made elsewhere — another screen, or another app open in another tab — and
 * the queries that read them. Customers, products and notifications subscribe in their own hooks; these did not, so
 * an admin's attendance or salary entry reached the delivery app only after a restart.
 */
const SYNCED_STORES: readonly { storageKey: string; queryKey: readonly string[] }[] = [
  { storageKey: DELIVERY_BOYS_STORE_KEY, queryKey: ['deliveryBoys'] },
  { storageKey: ADMIN_DASHBOARD_SETTINGS_STORE_KEY, queryKey: ['adminDashboard'] },
  { storageKey: PRODUCT_CATEGORIES_STORE_KEY, queryKey: ['productCategories'] },
];

/** Mounted once at the app root. */
export function useStorageQuerySync(): void {
  const qc = useQueryClient();
  useEffect(() => {
    const unsubscribers = SYNCED_STORES.map(({ storageKey, queryKey }) =>
      subscribeStorageKey(storageKey, () => {
        void qc.invalidateQueries({ queryKey: [...queryKey] });
      }),
    );
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [qc]);
}
