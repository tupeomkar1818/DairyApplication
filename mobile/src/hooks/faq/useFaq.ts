import { useQuery } from '@tanstack/react-query';

import type { FaqListQuery } from '@/src/domain/faq/validations';
import { useLanguage } from '@/src/i18n/useStrings';
import { services } from '@/src/infrastructure/service-registry';

export function useFaqList(query?: FaqListQuery) {
  // The questions are written in the app language, so each language is its own cache entry.
  const lang = useLanguage();
  return useQuery({
    queryKey: ['faq', 'list', lang, query ?? {}],
    queryFn: () => services.faq.listFaqs(query),
    staleTime: 60_000,
  });
}
