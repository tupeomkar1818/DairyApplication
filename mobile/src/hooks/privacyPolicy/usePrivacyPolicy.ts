import { useQuery } from '@tanstack/react-query';

import type { PrivacyPolicyQuery } from '@/src/domain/privacyPolicy/validations';
import { useLanguage } from '@/src/i18n/useStrings';
import { services } from '@/src/infrastructure/service-registry';

export function usePrivacyPolicy(query?: PrivacyPolicyQuery) {
  // The policy is written in the app language, so each language is its own cache entry.
  const lang = useLanguage();
  return useQuery({
    queryKey: ['privacyPolicy', 'document', lang, query ?? {}],
    queryFn: () => services.privacyPolicy.getPrivacyPolicy(query),
    staleTime: 60_000,
  });
}
