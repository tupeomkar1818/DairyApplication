import { useQuery } from '@tanstack/react-query';

import type { ContactAdminQuery } from '@/src/domain/contactAdmin/validations';
import { services } from '@/src/infrastructure/service-registry';

export function useContactAdmin(query?: ContactAdminQuery) {
  return useQuery({
    queryKey: ['contactAdmin', 'details', query ?? {}],
    queryFn: () => services.contactAdmin.getContactAdmin(query),
    staleTime: 60_000,
  });
}
