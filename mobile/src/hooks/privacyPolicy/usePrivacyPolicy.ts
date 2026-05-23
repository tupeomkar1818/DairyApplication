import { useQuery } from '@tanstack/react-query';

import type { PrivacyPolicyQuery } from '@/src/domain/privacyPolicy/validations';
import { services } from '@/src/infrastructure/service-registry';

export function usePrivacyPolicy(query?: PrivacyPolicyQuery) {
  return useQuery({
    queryKey: ['privacyPolicy', 'document', query ?? {}],
    queryFn: () => services.privacyPolicy.getPrivacyPolicy(query),
    staleTime: 60_000,
  });
}
