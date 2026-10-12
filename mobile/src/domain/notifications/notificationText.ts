import type { AppNotification, NotificationText } from '@/src/domain/notifications/entities';
import { getLanguage, type Lang } from '@/src/i18n/language';

/**
 * Notifications in the reader's language.
 *
 * A row is written once, when the event happens, but read later — possibly by someone whose app is in the other
 * language (the admin and the customer share the same list). So each row carries its words in every language:
 * English in `title` / `body` and the rest in `translations`. Screens show `notificationText(n, lang)`.
 */

type Translatable = Pick<AppNotification, 'title' | 'body' | 'translations'>;

/** What a notification says in `lang` (the app's language by default); English for rows saved without it. */
export function notificationText(n: Translatable, lang: Lang = getLanguage()): NotificationText {
  const translated = lang === 'en' ? undefined : n.translations?.[lang];
  if (translated && typeof translated.title === 'string' && translated.title) {
    return { title: translated.title, body: typeof translated.body === 'string' ? translated.body : '' };
  }
  return { title: n.title, body: n.body };
}

/**
 * Builds rows once per language and keeps the English rows, each carrying its Marathi words. `build` must return the
 * same rows in the same order for every language — only the words may differ.
 */
export function inEveryLanguage<T extends NotificationText>(build: (lang: Lang) => T[]): (T & Translatable)[] {
  const en = build('en');
  const mr = build('mr');
  return en.map((row, i) => {
    const other = mr[i];
    return other ? { ...row, translations: { mr: { title: other.title, body: other.body } } } : row;
  });
}

/** `inEveryLanguage` for a single row. */
export function oneInEveryLanguage<T extends NotificationText>(build: (lang: Lang) => T): T & Translatable {
  return inEveryLanguage((lang) => [build(lang)])[0]!;
}
