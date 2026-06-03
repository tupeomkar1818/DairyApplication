import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import type { CreateCustomerRequest, CustomerListResponse, CustomerResponse, UpdateCustomerRequest } from '@/src/domain/customers/dtos';
import { services } from '@/src/infrastructure/service-registry';
import { CUSTOMERS_STORE_KEY } from '@/src/infrastructure/storage/keys';
import { subscribeStorageKey } from '@/src/infrastructure/storage/storage';

export function useCustomers() {
  const qc = useQueryClient();
  const query = useQuery<CustomerListResponse>({
    queryKey: ['customers', 'list'],
    queryFn: () => services.customers.list(),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    return subscribeStorageKey(CUSTOMERS_STORE_KEY, () => {
      void qc.invalidateQueries({ queryKey: ['customers', 'list'] });
    });
  }, [qc]);

  return query;
}

export function useCustomer(id: string | undefined) {
  const qc = useQueryClient();
  const queryKey = useMemo(() => ['customers', 'getById', id ?? ''] as const, [id]);
  const query = useQuery<CustomerResponse | null>({
    queryKey,
    queryFn: () => (id ? services.customers.getById(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!id) return;
    return subscribeStorageKey(CUSTOMERS_STORE_KEY, () => {
      void qc.invalidateQueries({ queryKey });
    });
  }, [id, qc, queryKey]);

  return query;
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation<CustomerResponse, unknown, CreateCustomerRequest>({
    mutationFn: (data) => services.customers.create(data),
    onSuccess: async (created) => {
      qc.setQueryData<CustomerListResponse>(['customers', 'list'], (prev) => {
        if (!prev) return prev;
        const nextItems = [created, ...prev.items.filter((x) => x.id !== created.id)];
        return { ...prev, items: nextItems, total: nextItems.length };
      });
      qc.setQueryData<CustomerResponse | null>(['customers', 'getById', created.id], created);
      await qc.invalidateQueries({ queryKey: ['customers', 'list'] });
    },
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation<CustomerResponse, unknown, { id: string; data: UpdateCustomerRequest }>({
    mutationFn: ({ id, data }) => services.customers.update(id, data),
    onSuccess: async (updated, vars) => {
      qc.setQueryData<CustomerListResponse>(['customers', 'list'], (prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.map((x) => (x.id === updated.id ? updated : x));
        return { ...prev, items: nextItems, total: nextItems.length };
      });
      qc.setQueryData<CustomerResponse | null>(['customers', 'getById', vars.id], updated);
      await qc.invalidateQueries({ queryKey: ['customers', 'list'] });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation<void, unknown, { id: string }>({
    mutationFn: ({ id }) => services.customers.delete(id),
    onSuccess: async (_res, vars) => {
      qc.setQueryData<CustomerListResponse>(['customers', 'list'], (prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.filter((x) => x.id !== vars.id);
        return { ...prev, items: nextItems, total: nextItems.length };
      });
      qc.setQueryData<CustomerResponse | null>(['customers', 'getById', vars.id], null);
      await qc.invalidateQueries({ queryKey: ['customers', 'list'] });
    },
  });
}

