import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { UpdateDashboardCoverRequest } from '@/src/domain/adminDashboard/dtos';
import { services } from '@/src/infrastructure/service-registry';

export function useDashboardSettings() {
  return useQuery({
    queryKey: ['adminDashboard', 'settings'],
    queryFn: () => services.adminDashboard.getSettings(),
    staleTime: 30_000,
  });
}

export function useUpdateDashboardCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateDashboardCoverRequest) => services.adminDashboard.updateCover(data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['adminDashboard', 'settings'] });
    },
  });
}
