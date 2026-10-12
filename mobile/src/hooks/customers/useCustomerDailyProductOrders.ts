import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import type {
  CustomerDailyProductOrderLineDto,
  CustomerSubscriptionPlanDto,
  UpsertCustomerDailyProductOrderLineRequest,
} from '@/src/domain/customers/dtos';
import { UpsertCustomerDailyProductOrderLineRequestSchema } from '@/src/domain/customers/validations';
import {
  loadDailyProductOrderLines,
  updateDailyProductOrderLines,
} from '@/src/infrastructure/customerDailyProductOrdersStore';
import { CUSTOMER_DAILY_PRODUCT_ORDERS_STORE_PREFIX } from '@/src/infrastructure/storage/keys';
import { subscribeStorageKey } from '@/src/infrastructure/storage/storage';

/** Stable empty value while loading / on error — a fresh `[]` per render would re-fire every effect that depends on it. */
const EMPTY_LINES = Object.freeze([]) as unknown as CustomerDailyProductOrderLineDto[];

function newLineId(): string {
  return `dord_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function useCustomerDailyProductOrders(
  customerId: string | undefined,
) {
  const qc = useQueryClient();

  const queryKey = useMemo(() => ['customers', 'dailyProductOrders', customerId ?? ''] as const, [customerId]);
  const storageKey = customerId ? `${CUSTOMER_DAILY_PRODUCT_ORDERS_STORE_PREFIX}:${customerId}` : null;

  useEffect(() => {
    if (!storageKey || !customerId) return;
    return subscribeStorageKey(storageKey, () => {
      void qc.invalidateQueries({ queryKey });
    });
  }, [customerId, qc, queryKey, storageKey]);

  const query = useQuery({
    queryKey,
    queryFn: () => loadDailyProductOrderLines(customerId!),
    enabled: !!customerId,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  /** Applies `updater` to the latest stored lines (serialized per customer), then mirrors the result into the cache. */
  const commit = useCallback(
    async (updater: (prev: CustomerDailyProductOrderLineDto[]) => CustomerDailyProductOrderLineDto[]) => {
      if (!customerId) return;
      const next = await updateDailyProductOrderLines(customerId, updater);
      qc.setQueryData(queryKey, next);
    },
    [customerId, qc, queryKey],
  );

  const upsert = useCallback(
    async (payload: UpsertCustomerDailyProductOrderLineRequest) => {
      if (!customerId) return;
      const parsed = UpsertCustomerDailyProductOrderLineRequestSchema.parse(payload);
      await commit((prev) => {
        const existing = parsed.id ? prev.find((x) => x.id === parsed.id) : undefined;
        const row: CustomerDailyProductOrderLineDto = {
          id: parsed.id ?? newLineId(),
          createdAtIso: existing?.createdAtIso ?? new Date().toISOString(),
          dateYmd: parsed.dateYmd,
          productName: parsed.productName,
          quantityLabel: parsed.quantityLabel,
          unitType: parsed.unitType,
          quantity: parsed.quantity,
        };
        const without = parsed.id ? prev.filter((x) => x.id !== parsed.id) : prev;
        return [...without, row];
      });
    },
    [commit, customerId],
  );

  const remove = useCallback(
    async (id: string) => {
      await commit((prev) => prev.filter((x) => x.id !== id));
    },
    [commit],
  );

  const replaceLinesForDate = useCallback(
    async (dateYmd: string, nextForDate: CustomerDailyProductOrderLineDto[]) => {
      await commit((prev) => [...prev.filter((x) => x.dateYmd !== dateYmd), ...nextForDate]);
    },
    [commit],
  );

  const seedDayFromProfilePlans = useCallback(
    async (dateYmd: string, plans: CustomerSubscriptionPlanDto[]) => {
      if (!customerId || !plans.length) return;
      const rows: CustomerDailyProductOrderLineDto[] = plans.map((p) => ({
        id: newLineId(),
        dateYmd,
        productName: p.productName,
        quantityLabel: p.quantityLabel,
        unitType: p.unitType,
        quantity: Math.max(1, Math.floor(Number(p.numberOfItems ?? 1))),
      }));
      await replaceLinesForDate(dateYmd, rows);
    },
    [customerId, replaceLinesForDate],
  );

  const safeLines = query.data ?? EMPTY_LINES;
  const ready = !!customerId ? query.isFetched : true;

  // keep API stable for callers
  return { lines: safeLines, ready, upsert, remove, seedDayFromProfilePlans };
}
