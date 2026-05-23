import { useQuery } from '@tanstack/react-query';

import { services } from '@/src/infrastructure/service-registry';

export function useMyProfile(enabled = true) {
  return useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => services.profile.getMyProfile(),
    enabled,
    staleTime: 30_000,
  });
}
