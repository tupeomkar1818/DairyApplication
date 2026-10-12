import AsyncStorage from '@react-native-async-storage/async-storage';

import { deviceLanguage, getLanguage, isLang, setLanguage, subscribeLanguage, type Lang } from '@/src/i18n/language';

/**
 * Remembers the chosen language on this phone. The key deliberately does not start with `DAIRY_`, so the one-time
 * data clean-up (`freshStart`) keeps it.
 */
export const LANGUAGE_STORE_KEY = 'AMRALE_APP_LANGUAGE_V1';

let loading: Promise<Lang> | null = null;

/** Applies the saved language (or the phone's language the first time) before the first screen draws. */
export function loadSavedLanguage(): Promise<Lang> {
  if (!loading) {
    loading = (async () => {
      let saved: string | null = null;
      try {
        saved = await AsyncStorage.getItem(LANGUAGE_STORE_KEY);
      } catch {
        // Unreadable storage: fall back to the phone's language for this run.
      }
      setLanguage(isLang(saved) ? saved : deviceLanguage());
      // From now on every change is saved, wherever it is made.
      subscribeLanguage(() => {
        void AsyncStorage.setItem(LANGUAGE_STORE_KEY, getLanguage()).catch(() => undefined);
      });
      return getLanguage();
    })();
  }
  return loading;
}
