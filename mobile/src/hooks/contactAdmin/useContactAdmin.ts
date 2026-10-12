import { useQuery } from '@tanstack/react-query';

import type { ContactAdminQuery } from '@/src/domain/contactAdmin/validations';
import { useLanguage } from '@/src/i18n/useStrings';
import { services } from '@/src/infrastructure/service-registry';

export function useContactAdmin(query?: ContactAdminQuery) {
  // The page is written in the app language, so each language is its own cache entry.
  const lang = useLanguage();
  return useQuery({
    queryKey: ['contactAdmin', 'details', lang, query ?? {}],
    queryFn: () => services.contactAdmin.getContactAdmin(query),
    staleTime: 60_000,
  });
}
