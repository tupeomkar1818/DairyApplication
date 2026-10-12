import AsyncStorage from '@react-native-async-storage/async-storage';

import { syncDeviceReminders } from '@/src/infrastructure/deviceReminders';
import { services } from '@/src/infrastructure/service-registry';

/**
 * A one-time clean slate: every device drops the data it built up during testing (sample customers, delivery
 * partners, products, orders, notifications, chats, sign-ins) the first time it runs this version, so the dairy starts
 * with only what it adds itself. It runs once per device; bump `DATA_EPOCH` to wipe everything again.
 */

export const DATA_EPOCH_KEY = 'DAIRY_DATA_EPOCH';
export const DATA_EPOCH = '2026-09-16-fresh-start';

/** Every key the app writes starts with this (the epoch marker itself is kept). */
const APP_KEY_PREFIX = 'DAIRY_';

let running: Promise<boolean> | null = null;

/** Clears all app data if this device has not started fresh yet; true when it did. Safe to call more than once. */
export function runFreshStartOnce(): Promise<boolean> {
  if (!running) {
    running = (async () => {
      if ((await AsyncStorage.getItem(DATA_EPOCH_KEY)) === DATA_EPOCH) return false;

      // Sign out first: on a phone the session lives in secure storage, outside the keys cleared below.
      await services.auth.logout().catch(() => undefined);
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(APP_KEY_PREFIX) && k !== DATA_EPOCH_KEY);
      if (keys.length) await AsyncStorage.multiRemove(keys);
      // Reminders a phone scheduled for the old customers must not fire.
      await syncDeviceReminders(null, []).catch(() => undefined);

      await AsyncStorage.setItem(DATA_EPOCH_KEY, DATA_EPOCH);
      return true;
    })().catch(() => {
      // A failed wipe is retried on the next start rather than blocking the app.
      running = null;
      return false;
    });
  }
  return running;
}
