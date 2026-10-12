import { en, type Dictionary } from '@/src/i18n/en';
import { getLanguage, type Lang } from '@/src/i18n/language';
import { mr } from '@/src/i18n/mr';

export type { Dictionary } from '@/src/i18n/en';
export type Namespace = keyof Dictionary;

const DICTIONARIES: Record<Lang, Dictionary> = { en, mr };

/**
 * One namespace's wording in the current language (or `lang`), for code outside React: validation messages,
 * errors thrown by services, notification text. Read it when the text is needed, not once at module load, or it
 * will not follow a language change. In components use `useStrings`, which also re-renders on a change.
 */
export function strings<N extends Namespace>(namespace: N, lang: Lang = getLanguage()): Dictionary[N] {
  return DICTIONARIES[lang][namespace];
}

/** The whole dictionary for a language (tests and tooling). */
export function dictionaryFor(lang: Lang): Dictionary {
  return DICTIONARIES[lang];
}
