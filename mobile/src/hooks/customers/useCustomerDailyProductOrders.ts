import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import type {
  CustomerDailyProductOrderLineDto,
  CustomerSubscriptionPlanDto,
  UpsertCustomerDailyProductOrderLineRequest,
} from '@/src/domain/customers/dtos';
import { UpsertCustomerDailyProductOrderLineRequestSchema } from '@/src/domain/customers/validations';
import { loadDailyProductOrderLines, saveDailyProductOrderLines } from '@/src/infrastructure/customerDailyProductOrdersStore';
import { CUSTOMER_DAILY_PRODUCT_ORDERS_STORE_PREFIX } from '@/src/infrastructure/storage/keys';
import { subscribeStorageKey } from '@/src/infrastructure/storage/storage';

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

  const persist = useCallback(
    async (next: CustomerDailyProductOrderLineDto[]) => {
      if (!customerId) return;
      await saveDailyProductOrderLines(customerId, next);
      qc.setQueryData(queryKey, next);
    },
    [customerId, qc, queryKey],
  );

  const upsert = useCallback(
    async (payload: UpsertCustomerDailyProductOrderLineRequest) => {
      if (!customerId) return;
      const parsed = UpsertCustomerDailyProductOrderLineRequestSchema.parse(payload);
      const prev = ((query.data ?? []) as CustomerDailyProductOrderLineDto[]) ?? [];
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
      const next = [...without, row];
      await persist(next);
    },
    [customerId, persist, query.data],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!customerId) return;
      const prev = ((query.data ?? []) as CustomerDailyProductOrderLineDto[]) ?? [];
      const next = prev.filter((x) => x.id !== id);
      await persist(next);
    },
    [customerId, persist, query.data],
  );

  const replaceLinesForDate = useCallback(
    async (dateYmd: string, nextForDate: CustomerDailyProductOrderLineDto[]) => {
      if (!customerId) return;
      const prev = ((query.data ?? []) as CustomerDailyProductOrderLineDto[]) ?? [];
      const rest = prev.filter((x) => x.dateYmd !== dateYmd);
      const next = [...rest, ...nextForDate];
      await persist(next);
    },
    [customerId, persist, query.data],
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

  const safeLines = (query.data ?? []) as CustomerDailyProductOrderLineDto[];
  const ready = !!customerId ? query.isFetched : true;

  // keep API stable for callers
  return { lines: safeLines, ready, upsert, remove, seedDayFromProfilePlans };
}
