import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CustomerResponse, UpdateCustomerRequest } from '@/src/domain/customers/dtos';
import { services } from '@/src/infrastructure/service-registry';

/**
 * The signed-in customer's own record, straight from the dairy's server.
 *
 * The server will not hand a customer the whole list — one household must never see another's orders or bills —
 * so it answers "my record" on its own address. On a phone that keeps its records itself there is no such address,
 * and `useMyCustomer` finds the record in the list instead.
 */

const QUERY_KEY = ['customers', 'mine'] as const;

type MineService = { getMine?: () => Promise<CustomerResponse | null> };

/** True when the dairy's server is answering, which is the only place "my record" exists. */
export function hasMyCustomerEndpoint(): boolean {
  return typeof (services.customers as MineService).getMine === 'function';
}

export function useMyCustomerRecord(enabled: boolean): {
  customer: CustomerResponse | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  save: (data: UpdateCustomerRequest) => Promise<void>;
  isSaving: boolean;
} {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => (services.customers as MineService).getMine!(),
    enabled: enabled && hasMyCustomerEndpoint(),
    staleTime: 30_000,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomerRequest }) => services.customers.update(id, data),
    onSuccess: (updated) => {
      qc.setQueryData(QUERY_KEY, updated);
      // Anything else reading customers (the dairy's own screens in the same app) sees the change too.
      void qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const customer = query.data ?? null;
  return {
    customer,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
    save: async (data) => {
      if (!customer) return;
      await update.mutateAsync({ id: customer.id, data });
    },
    isSaving: update.isPending,
  };
}
