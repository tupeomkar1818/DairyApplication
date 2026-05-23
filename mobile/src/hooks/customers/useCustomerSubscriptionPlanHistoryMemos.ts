import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { AppendCustomerSubscriptionPlanHistoryMemoRequest, CustomerSubscriptionPlanHistoryMemoDto } from '@/src/domain/customers/dtos';
import { AppendCustomerSubscriptionPlanHistoryMemoRequestSchema } from '@/src/domain/customers/validations';
import {
  loadSubscriptionPlanHistoryMemos,
  saveSubscriptionPlanHistoryMemos,
} from '@/src/infrastructure/customerSubscriptionPlanHistoryMemoStore';

function newMemoId(): string {
  return `submemo_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function subscriptionPlanHistoryMemosQueryKey(customerId: string | undefined) {
  return ['customers', 'subscriptionPlanHistoryMemos', customerId ?? ''] as const;
}

export function useCustomerSubscriptionPlanHistoryMemos(customerId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: subscriptionPlanHistoryMemosQueryKey(customerId),
    queryFn: () => loadSubscriptionPlanHistoryMemos(customerId!),
    enabled: !!customerId,
    staleTime: 5_000,
  });

  const append = useMutation({
    mutationFn: async (payload: AppendCustomerSubscriptionPlanHistoryMemoRequest): Promise<CustomerSubscriptionPlanHistoryMemoDto[]> => {
      if (!customerId) throw new Error('customerId required');
      const parsedReq = AppendCustomerSubscriptionPlanHistoryMemoRequestSchema.parse(payload);
      const prev = await loadSubscriptionPlanHistoryMemos(customerId);
      const row: CustomerSubscriptionPlanHistoryMemoDto = {
        id: newMemoId(),
        createdAt: new Date().toISOString(),
        kind: parsedReq.kind,
        message: parsedReq.message,
        closedLineProductName: parsedReq.closedLineProductName,
        closedLineEndBeforeDisplay: parsedReq.closedLineEndBeforeDisplay,
        closedLineEndAfterDisplay: parsedReq.closedLineEndAfterDisplay,
        addedLineProductName: parsedReq.addedLineProductName,
      };
      const next = [row, ...prev];
      await saveSubscriptionPlanHistoryMemos(customerId, next);
      return next;
    },
    onSuccess: async (_data, _vars, _ctx) => {
      if (customerId) {
        await qc.invalidateQueries({ queryKey: subscriptionPlanHistoryMemosQueryKey(customerId) });
      }
    },
  });

  const memos = useMemo(() => {
    const data = query.data;
    if (!data?.length) return [];
    return [...data].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [query.data]);

  return {
    memos,
    isLoading: query.isLoading,
    appendMemo: append.mutateAsync,
    isAppending: append.isPending,
  };
}
