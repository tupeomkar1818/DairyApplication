import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CounterDay, CounterSale, DeskUser, Manager } from '@/src/domain/counter/entities';
import type { PlaceSaleRequest } from '@/src/domain/counter/service.interface';
import { services } from '@/src/infrastructure/service-registry';

/**
 * The counter, for the screens.
 *
 * A sale is not a query: placing one takes money, so it is a mutation and never retried on its own. What the
 * server answers is what goes on the bill.
 */

const counter = () => {
  const service = services.counter;
  if (!service) throw new Error('The counter needs the dairy’s server.');
  return service;
};

export const counterKeys = {
  salesOn: (ymd?: string) => ['counter', 'sales', ymd ?? 'today'] as const,
  day: (from?: string, to?: string) => ['counter', 'day', from ?? 'today', to ?? from ?? 'today'] as const,
  deskUsers: ['counter', 'desk-users'] as const,
  managers: ['counter', 'managers'] as const,
};

export function useCounterSales(ymd?: string) {
  return useQuery<{ ymd: string; items: CounterSale[] }>({
    queryKey: counterKeys.salesOn(ymd),
    queryFn: () => counter().salesOn(ymd),
    // A counter changes every few minutes; the desk should not have to pull to refresh after every bill.
    staleTime: 30_000,
  });
}

export function useCounterDay(range?: { from: string; to?: string }) {
  return useQuery<CounterDay>({
    queryKey: counterKeys.day(range?.from, range?.to),
    queryFn: () => counter().day(range),
    staleTime: 60_000,
  });
}

export function usePlaceSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PlaceSaleRequest) => counter().placeSale(data),
    retry: 0,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['counter', 'sales'] });
      void qc.invalidateQueries({ queryKey: ['counter', 'day'] });
    },
  });
}

export function useMarkPrinted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => counter().markPrinted(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['counter', 'sales'] }),
  });
}

export function useDeskUsers() {
  return useQuery<DeskUser[]>({ queryKey: counterKeys.deskUsers, queryFn: () => counter().listDeskUsers() });
}

export function useAddDeskUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<DeskUser>) => counter().addDeskUser(data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: counterKeys.deskUsers }),
  });
}

export function useUpdateDeskUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DeskUser> }) => counter().updateDeskUser(id, data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: counterKeys.deskUsers }),
  });
}

export function useRemoveDeskUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => counter().removeDeskUser(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: counterKeys.deskUsers }),
  });
}

export function useManagers() {
  return useQuery<Manager[]>({ queryKey: counterKeys.managers, queryFn: () => counter().listManagers() });
}

export function useAddManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; mobile: string }) => counter().addManager(data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: counterKeys.managers }),
  });
}

export function useRemoveManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => counter().removeManager(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: counterKeys.managers }),
  });
}
