/**
 * The app's language: English or Marathi, one choice for the whole phone (every app on it — admin, delivery and
 * customer — follows it). Kept free of React and storage imports so domain code and tests can read it; saving the
 * choice lives in `languageStorage.ts`.
 */

export type Lang = 'en' | 'mr';

export const LANGUAGES: readonly { code: Lang; /** The name in its own script, so each reader finds theirs. */ label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'mr', label: 'मराठी' },
];

export const DEFAULT_LANGUAGE: Lang = 'en';

let current: Lang = DEFAULT_LANGUAGE;
const listeners = new Set<() => void>();

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'mr';
}

export function getLanguage(): Lang {
  return current;
}

/** Switches every screen at once (screens reading `useStrings` / `useLanguage` re-render). */
export function setLanguage(lang: Lang): void {
  if (!isLang(lang) || lang === current) return;
  current = lang;
  listeners.forEach((l) => l());
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Marathi when the phone itself is set to Marathi; English otherwise. Used only before a choice is saved. */
export function deviceLanguage(): Lang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    return /^mr\b/i.test(locale) ? 'mr' : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}
