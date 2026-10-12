import { Platform } from 'react-native';

import { getLanguage } from '@/src/i18n/language';
import { loadNotifications } from '@/src/infrastructure/expoNotifications';

/**
 * The registry is read when it is needed, not when this file is loaded: signing in is what registers a phone,
 * so the registry would otherwise import the sign-in service which imports this file.
 */
const pushService = async () => (await import('@/src/infrastructure/service-registry')).services.push;

/**
 * Telling the dairy's server where to reach this phone.
 *
 * The server sends the evening reminder and news of an offer by push, which needs the token Expo gave this install.
 * It is registered when somebody signs in and forgotten when they sign out, so a shared phone never keeps the last
 * person's notifications.
 *
 * A phone may not be able to give a token at all — Expo Go on Android has no push, a build without an EAS project
 * id cannot ask for one, and the person may have said no to notifications. None of that is a problem worth showing:
 * the reminder is still in the app when they open it.
 */

let registered: string | null = null;

/** What the running app can tell us about itself, without importing the whole Expo config module. */
function projectId(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default as {
      expoConfig?: { extra?: { eas?: { projectId?: string } } };
      easConfig?: { projectId?: string };
    };
    return Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  } catch {
    return undefined;
  }
}

/** This install's Expo push token, or null where the phone cannot give one. */
async function pushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const notifications = loadNotifications();
  if (!notifications) return null;
  try {
    const permission = await notifications.getPermissionsAsync();
    const granted =
      permission.granted || (await notifications.requestPermissionsAsync().then((answer) => answer.granted).catch(() => false));
    if (!granted) return null;

    const id = projectId();
    const token = await notifications.getExpoPushTokenAsync(id ? { projectId: id } : undefined);
    return token?.data ?? null;
  } catch {
    // No EAS project id, no network, or a build that cannot do push: nothing to register.
    return null;
  }
}

/** Registers this phone for the dairy's push notifications. Safe to call again; never throws. */
export async function registerForPush(): Promise<void> {
  try {
    const push = await pushService();
    if (!push) return;
    const token = await pushToken();
    if (!token || token === registered) return;
    await push.register({ token, platform: Platform.OS, language: getLanguage() });
    registered = token;
  } catch {
    // The person is signed in either way; the reminder is in the app when they open it.
  }
}

/** Forgets this phone, so notifications meant for the person signing out do not follow them. */
export async function forgetPush(): Promise<void> {
  try {
    const token = registered;
    registered = null;
    const push = await pushService();
    if (!token || !push) return;
    await push.forget(token);
  } catch {
    // Signing out must not fail because the server could not be told.
  }
}
