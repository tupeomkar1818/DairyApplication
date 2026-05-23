import { useQuery } from '@tanstack/react-query';

import type { FaqListQuery } from '@/src/domain/faq/validations';
import { services } from '@/src/infrastructure/service-registry';

export function useFaqList(query?: FaqListQuery) {
  return useQuery({
    queryKey: ['faq', 'list', query ?? {}],
    queryFn: () => services.faq.listFaqs(query),
    staleTime: 60_000,
  });
}
