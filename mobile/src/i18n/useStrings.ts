import { useSyncExternalStore } from 'react';

import { getLanguage, subscribeLanguage, type Lang } from '@/src/i18n/language';
import { strings, type Dictionary, type Namespace } from '@/src/i18n/strings';

/** The current language; the component re-renders when it changes. Put it in memo deps that build text. */
export function useLanguage(): Lang {
  return useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
}

/** One namespace's wording in the current language: `const t = useStrings('billing'); t.title`. */
export function useStrings<N extends Namespace>(namespace: N): Dictionary[N] {
  return strings(namespace, useLanguage());
}
