import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateDeliveryBoyRequest, DeliveryBoyListResponse, DeliveryBoyResponse, UpdateDeliveryBoyRequest } from '@/src/domain/deliveryBoys/dtos';
import { services } from '@/src/infrastructure/service-registry';

export function useDeliveryBoys() {
  return useQuery<DeliveryBoyListResponse>({
    queryKey: ['deliveryBoys', 'list'],
    queryFn: () => services.deliveryBoys.list(),
    staleTime: 10_000,
  });
}

export function useDeliveryBoy(id: string | undefined) {
  return useQuery<DeliveryBoyResponse | null>({
    queryKey: ['deliveryBoys', 'getById', id ?? ''],
    queryFn: () => (id ? services.deliveryBoys.getById(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useCreateDeliveryBoy() {
  const qc = useQueryClient();
  return useMutation<DeliveryBoyResponse, unknown, CreateDeliveryBoyRequest>({
    mutationFn: (data) => services.deliveryBoys.create(data),
    onSuccess: async (created) => {
      qc.setQueryData<DeliveryBoyListResponse>(['deliveryBoys', 'list'], (prev) => {
        if (!prev) return prev;
        const nextItems = [created, ...prev.items.filter((x) => x.id !== created.id)];
        return { ...prev, items: nextItems, total: nextItems.length };
      });
      qc.setQueryData<DeliveryBoyResponse | null>(['deliveryBoys', 'getById', created.id], created);
      await qc.invalidateQueries({ queryKey: ['deliveryBoys', 'list'] });
    },
  });
}

export function useUpdateDeliveryBoy() {
  const qc = useQueryClient();
  return useMutation<DeliveryBoyResponse, unknown, { id: string; data: UpdateDeliveryBoyRequest }>({
    mutationFn: ({ id, data }) => services.deliveryBoys.update(id, data),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['deliveryBoys', 'getById', vars.id] });
      await qc.cancelQueries({ queryKey: ['deliveryBoys', 'list'] });

      const prevOne = qc.getQueryData<DeliveryBoyResponse | null>(['deliveryBoys', 'getById', vars.id]);
      const prevList = qc.getQueryData<DeliveryBoyListResponse>(['deliveryBoys', 'list']);

      if (prevOne) {
        qc.setQueryData<DeliveryBoyResponse | null>(['deliveryBoys', 'getById', vars.id], { ...prevOne, ...vars.data } as DeliveryBoyResponse);
      }
      if (prevList) {
        qc.setQueryData<DeliveryBoyListResponse>(['deliveryBoys', 'list'], {
          ...prevList,
          items: prevList.items.map((x) => (x.id === vars.id ? ({ ...x, ...vars.data } as DeliveryBoyResponse) : x)),
          total: prevList.total,
        });
      }

      return { prevOne, prevList };
    },
    onSuccess: async (updated, vars) => {
      qc.setQueryData<DeliveryBoyListResponse>(['deliveryBoys', 'list'], (prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.map((x) => (x.id === updated.id ? updated : x));
        return { ...prev, items: nextItems, total: nextItems.length };
      });
      qc.setQueryData<DeliveryBoyResponse | null>(['deliveryBoys', 'getById', vars.id], updated);
      await qc.invalidateQueries({ queryKey: ['deliveryBoys', 'list'] });
    },
    onError: async (_err, vars, ctx) => {
      if (!ctx) return;
      qc.setQueryData<DeliveryBoyResponse | null>(['deliveryBoys', 'getById', vars.id], (ctx as any).prevOne ?? null);
      qc.setQueryData<DeliveryBoyListResponse>(['deliveryBoys', 'list'], (ctx as any).prevList);
    },
  });
}

export function useDeleteDeliveryBoy() {
  const qc = useQueryClient();
  return useMutation<void, unknown, { id: string }>({
    mutationFn: ({ id }) => services.deliveryBoys.delete(id),
    onSuccess: async (_res, vars) => {
      qc.setQueryData<DeliveryBoyListResponse>(['deliveryBoys', 'list'], (prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.filter((x) => x.id !== vars.id);
        return { ...prev, items: nextItems, total: nextItems.length };
      });
      qc.setQueryData<DeliveryBoyResponse | null>(['deliveryBoys', 'getById', vars.id], null);
      await qc.invalidateQueries({ queryKey: ['deliveryBoys', 'list'] });
    },
  });
}

