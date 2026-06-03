import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { CreateProductRequest, ProductListResponse, ProductResponse, UpdateProductRequest } from '@/src/domain/products/dtos';
import { services } from '@/src/infrastructure/service-registry';
import { PRODUCTS_STORE_KEY } from '@/src/infrastructure/storage/keys';
import { subscribeStorageKey } from '@/src/infrastructure/storage/storage';

export function useProducts() {
  const qc = useQueryClient();
  const query = useQuery<ProductListResponse>({
    queryKey: ['products', 'list'],
    queryFn: () => services.products.list(),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    return subscribeStorageKey(PRODUCTS_STORE_KEY, () => {
      void qc.invalidateQueries({ queryKey: ['products', 'list'] });
    });
  }, [qc]);

  return query;
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation<ProductResponse, unknown, CreateProductRequest>({
    mutationFn: (data) => services.products.create(data),
    onSuccess: async (created) => {
      qc.setQueryData<ProductListResponse>(['products', 'list'], (prev) => {
        if (!prev) return prev;
        const nextItems = [created, ...prev.items.filter((x) => x.id !== created.id)];
        return { ...prev, items: nextItems, total: nextItems.length };
      });
      await qc.invalidateQueries({ queryKey: ['products', 'list'] });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation<ProductResponse, unknown, { id: string; data: UpdateProductRequest }>({
    mutationFn: ({ id, data }) => services.products.update(id, data),
    onSuccess: async (updated) => {
      qc.setQueryData<ProductListResponse>(['products', 'list'], (prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.map((x) => (x.id === updated.id ? updated : x));
        return { ...prev, items: nextItems, total: nextItems.length };
      });
      await qc.invalidateQueries({ queryKey: ['products', 'list'] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation<void, unknown, { id: string }>({
    mutationFn: ({ id }) => services.products.delete(id),
    onSuccess: async (_res, vars) => {
      qc.setQueryData<ProductListResponse>(['products', 'list'], (prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.filter((x) => x.id !== vars.id);
        return { ...prev, items: nextItems, total: nextItems.length };
      });
      await qc.invalidateQueries({ queryKey: ['products', 'list'] });
    },
  });
}

